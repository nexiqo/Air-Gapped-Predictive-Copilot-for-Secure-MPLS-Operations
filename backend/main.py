from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

_START_TIME = time.time()
_REQUEST_COUNT = 0
ROOT = Path(__file__).resolve().parents[1]

from backend.data_loader import (
    load_topology,
    load_summary,
    load_branches,
    load_branch_detail,
    load_incidents,
    load_predictions,
    load_bgp_events,
    load_syslog_events,
    load_validation_results,
    load_runbooks
)
from backend.copilot import CopilotService
from backend.predictive_engine import PredictiveEngine

app = FastAPI(title="Air-Gapped Predictive NOC Copilot", version="1.0.0")

# Simulation state for loop engine
active_incidents: list[dict[str, Any]] = []
liveBranches: list[dict[str, Any]] = []

def handleResolveIncident(incident_id: str, method: str = "remediation"):
    global active_incidents
    for inc in active_incidents:
        if inc.get("id") == incident_id:
            inc["status"] = "resolved"

@app.on_event("startup")
def startup_event():
    global active_incidents, liveBranches
    from backend.data_loader import load_incidents, load_branches
    
    # Initialize active incidents
    try:
        raw_incidents = load_incidents()
        active_incidents.clear()
        for inc in raw_incidents:
            # Match schema that loop engine expects
            active_incidents.append({
                "id": inc.get("incident_id") or inc.get("id") or f"INC-{inc.get('site_id')}",
                "nodeId": inc.get("site_id", ""),
                "type": inc.get("fault_type") or inc.get("message") or "network_degradation",
                "severity": inc.get("severity", "WARNING").upper(),
                "status": "active" if inc.get("status", "").upper() != "RESOLVED" else "resolved",
                "metrics": {
                    "latency_ms": float(inc.get("latency_ms", 120.0) if inc.get("latency_ms") else 120.0),
                    "packet_loss_pct": float(inc.get("packet_loss_pct", 2.0) if inc.get("packet_loss_pct") else 2.0)
                }
            })
    except Exception as e:
        print(f"[Startup] Failed to load initial active incidents: {e}")
        
    # Initialize live branches
    try:
        liveBranches.clear()
        liveBranches.extend(load_branches())
    except Exception as e:
        print(f"[Startup] Failed to load initial branches: {e}")
        
    from backend.loop_engine import loop_engine
    loop_engine.start()

@app.on_event("shutdown")
def shutdown_event():
    from backend.loop_engine import loop_engine
    loop_engine.stop()

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = PredictiveEngine()
copilot = CopilotService()

class AnalyzeRequest(BaseModel):
    site_id: str
    metrics_snapshot: dict[str, Any]

class CopilotQueryRequest(BaseModel):
    question: str
    conversation_history: list[dict[str, Any]] = []
    active_incidents: list[dict[str, Any]] | None = None
    live_branches: list[dict[str, Any]] | None = None

class CopilotStreamRequest(BaseModel):
    question: str
    conversation_history: list[dict[str, Any]] = []
    active_incidents: list[dict[str, Any]] | None = None
    live_branches: list[dict[str, Any]] | None = None

GLOBAL_POLICIES = {
    "block_streaming": False,
    "scavenger_qos": False,
    "load_balancers": True,
    "maintenance_nodes": []  # List of branch_ids currently in maintenance mode
}

@app.get("/settings/policy")
def get_settings_policy() -> dict[str, Any]:
    return GLOBAL_POLICIES

@app.post("/settings/policy")
def update_settings_policy(policy_data: dict[str, Any]) -> dict[str, Any]:
    global GLOBAL_POLICIES
    GLOBAL_POLICIES["block_streaming"] = policy_data.get("block_streaming", GLOBAL_POLICIES["block_streaming"])
    GLOBAL_POLICIES["scavenger_qos"] = policy_data.get("scavenger_qos", GLOBAL_POLICIES["scavenger_qos"])
    GLOBAL_POLICIES["load_balancers"] = policy_data.get("load_balancers", GLOBAL_POLICIES["load_balancers"])
    return GLOBAL_POLICIES

@app.post("/branches/{branch_id}/maintenance")
def toggle_branch_maintenance(branch_id: str) -> dict[str, Any]:
    global GLOBAL_POLICIES
    if branch_id in GLOBAL_POLICIES["maintenance_nodes"]:
        GLOBAL_POLICIES["maintenance_nodes"].remove(branch_id)
        active = False
    else:
        GLOBAL_POLICIES["maintenance_nodes"].append(branch_id)
        active = True
    return {"branch_id": branch_id, "in_maintenance": active, "maintenance_nodes": GLOBAL_POLICIES["maintenance_nodes"]}

@app.get("/health")
def health() -> dict[str, Any]:
    copilot_status = copilot.status()
    return {
        "status": "ok",
        "air_gapped": True,
        "llm": copilot_status["model"],
        "rag": "chromadb",
        "ollama_running": copilot_status["ollama_running"],
        "mode": copilot_status["mode"],
        "rag_docs": copilot_status["rag_docs"]
    }

@app.get("/topology")
def get_topology() -> dict[str, Any]:
    """Get full topology.json content mapped for the frontend"""
    data = load_topology()
    nodes_list = data.get("nodes", [])
    nodes_dict = {node["id"]: node for node in nodes_list}
    data["nodes"] = nodes_dict
    return data

@app.get("/summary")
def get_summary() -> dict[str, Any]:
    """Get network_summary.json content mapped for the frontend"""
    summary = load_summary()
    eta = 10
    confidence = 0.9
    recent_preds = summary.get("recent_predictions", [])
    if recent_preds:
        p = recent_preds[0]
        try:
            eta = float(p.get("prophet_breach_eta_minutes", 10.0))
            confidence = float(p.get("confidence", 0.9))
        except (ValueError, TypeError):
            pass
            
    alerts_info = summary.get("alerts", {})
    
    # Compute dynamic top_risk_branches list from live branches metrics
    from backend.data_loader import load_branches
    current_branches = liveBranches if liveBranches else load_branches()
    sorted_branches = sorted(current_branches, key=lambda b: b.get("risk_score", 0.0), reverse=True)
    
    top_risk = []
    for b in sorted_branches[:5]:
        score = b.get("risk_score", 0.0)
        level = "LOW"
        if score >= 7.0:
            level = "CRITICAL"
        elif score >= 4.0:
            level = "WARNING"
        top_risk.append({
            "id": b["id"],
            "name": b["name"],
            "risk_score": score,
            "risk_level": level
        })
    
    return {
        "overall_health": summary.get("network_health", "NORMAL"),
        "total_nodes": summary.get("sites", {}).get("total", 16),
        "critical_nodes": summary.get("sites", {}).get("critical", 0),
        "warning_nodes": summary.get("sites", {}).get("warning", 0),
        "normal_nodes": summary.get("sites", {}).get("healthy", 16),
        "most_critical_issue": summary.get("most_critical_issue", "None"),
        "eta_to_failure": eta,
        "confidence": confidence,
        "most_at_risk_branch": summary.get("most_at_risk_site", "None"),
        "next_likely_failure": summary.get("next_likely_failure", "None"),
        "alert_count": {
            "critical": alerts_info.get("critical", 0),
            "warning": alerts_info.get("high", 0) + alerts_info.get("medium", 0)
        },
        "overall_summary": summary.get("overall_summary", ""),
        "prediction_engine": summary.get("prediction_engine", {}),
        "sites": summary.get("sites", {}),
        "sla": summary.get("sla", {}),
        "top_risk_branches": top_risk,
        "recent_predictions": summary.get("recent_predictions", []),
        "air_gap_status": summary.get("air_gap_status", ""),
        "llm_status": summary.get("llm_status", ""),
        "rag_status": summary.get("rag_status", "")
    }

@app.get("/branches")
def get_branches() -> dict[str, Any]:
    """Get list of all branches wrapped in branches key for frontend compatibility"""
    return {"branches": load_branches()}

@app.get("/branches/{branch_id}")
def get_branch(branch_id: str, status: str = "NORMAL") -> dict[str, Any]:
    """Get mapped single branch full detail from branch_details.json"""
    detail = load_branch_detail(branch_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Branch {branch_id} not found")
    
    from backend.employee_simulator import generate_employee_activity, get_branch_assets_and_subnets
    
    # Inject corporate subnets and assets
    extra = get_branch_assets_and_subnets(branch_id)
    detail["role"] = extra["role"]
    detail["type"] = extra["type"]
    detail["subnets"] = extra["subnets"]
    detail["assets"] = extra["assets"]
    detail["in_maintenance"] = branch_id in GLOBAL_POLICIES["maintenance_nodes"]
    
    # Generate live employees with policies applied
    detail["live_employees"] = generate_employee_activity(branch_id, status, policies=GLOBAL_POLICIES)
    return detail

@app.get("/alerts")
def get_alerts(severity: str = "all") -> dict[str, Any]:
    """Get incidents.csv as JSON, mapped and sorted by severity then timestamp"""
    incidents = load_incidents()
    mapped = []
    
    predictions = load_predictions()
    pred_by_site = {p.get("predicted_at_site"): p for p in predictions if p.get("predicted_at_site")}
    
    branches = load_branches()
    branch_by_id = {b["id"]: b for b in branches}
    
    for inc in incidents:
        site_id = inc.get("site_id", "")
        raw_sev = inc.get("severity", "MEDIUM").upper()
        if raw_sev == "CRITICAL":
            sev = "critical"
        elif raw_sev in ("HIGH", "MEDIUM"):
            sev = "warning"
        else:
            sev = "info"
            
        if severity != "all" and severity.lower() != sev:
            continue
            
        metrics = {}
        if site_id in branch_by_id:
            metrics = branch_by_id[site_id].get("current_metrics", {})
            
        prediction = None
        if site_id in pred_by_site:
            p = pred_by_site[site_id]
            prediction = {
                "issue": p.get("predicted_fault_type", "anomaly").upper().replace("_", " "),
                "confidence": float(p.get("confidence", 0.8)),
                "eta_minutes": float(p.get("prophet_breach_eta_minutes", 10.0)),
                "severity": p.get("severity_forecast", "MEDIUM").lower()
            }
            
        mapped.append({
            "id": inc.get("incident_id"),
            "entity_name": branch_by_id.get(site_id, {}).get("name", site_id),
            "message": inc.get("description", ""),
            "severity": sev,
            "timestamp": inc.get("timestamp_start", ""),
            "metrics": metrics,
            "prediction": prediction
        })
        
    return {"alerts": mapped}

@app.get("/predictions")
def get_predictions() -> list[dict[str, Any]]:
    """Get predictions.csv as JSON, sorted by confidence desc"""
    return load_predictions()

@app.get("/reports")
def get_reports(report_type: str = "executive") -> dict[str, Any]:
    """Get assembled report object based on report_type"""
    summary = load_summary()
    incidents = load_incidents()
    predictions = load_predictions()
    
    active_incidents = [inc for inc in incidents if inc.get("status", "").upper() != "RESOLVED"][:5]
    if not active_incidents:
        active_incidents = incidents[:5]
        
    critical_preds = [p for p in predictions if float(p.get("confidence", 0)) >= 0.8][:5]
    if not critical_preds:
        critical_preds = predictions[:5]
        
    branches = load_branches()
    
    if report_type == "branch":
        title = "Branch Operations & Performance Audit"
        executive_summary = (
            "Detailed audit of all branch sites. 14 branches are currently compliant, "
            "with active monitoring of performance and SLA levels across the country. "
            "Traffic metrics show branch-bengaluru and branch-nagpur as the most active "
            "hubs of bandwidth utilization and SLA pressure."
        )
        network_health = {
            "total_branches": len(branches),
            "active_incidents": len([i for i in incidents if i.get("status", "").upper() != "RESOLVED"]),
            "worst_latency_branch": "branch-bengaluru",
            "sla_compliance_rate": "100.0%"
        }
    elif report_type == "prediction":
        title = "AI Predictive Engine Analysis & Forecast"
        executive_summary = (
            "NOC predictive intelligence analysis. The LSTM autoencoder, Prophet forecaster, "
            "and XGBoost classifier are actively scoring telemetry feeds for fault precursors. "
            "Current forecast indicates a high probability of BGP route flapping and link congestion "
            "with average lead time of 8.7 minutes, enabling proactive mitigation."
        )
        network_health = {
            "model_accuracy": "89.0%",
            "average_lead_time": "8.7 minutes",
            "total_predictions_made": len(predictions),
            "false_positives": 2
        }
    else:
        title = "Executive NOC Operations & Health Summary"
        executive_summary = summary.get(
            "overall_summary",
            "The network is operating in a degraded state. Core routing and branch connectivity are monitored."
        )
        network_health = {
            "network_status": summary.get("network_health", "DEGRADED"),
            "global_risk": summary.get("global_risk_level", "HIGH"),
            "active_faults": summary.get("alerts", {}).get("active", 4),
            "sla_compliance": "87.5%"
        }
        
    branch_performance = []
    for b in branches:
        branch_performance.append({
            "branch": b["name"],
            "status": b["status"],
            "latency_ms": b["latency_ms"],
            "availability": 99.9 if b["status"] == "NORMAL" else 95.5
        })
        
    critical_issues = []
    for inc in active_incidents:
        critical_issues.append({
            "issue": inc.get("description", "Network anomaly"),
            "severity": inc.get("severity", "MEDIUM"),
            "eta_minutes": int(float(inc.get("lead_time_minutes", 10))) if inc.get("lead_time_minutes") else 10,
            "affected_transactions": 25000 if inc.get("severity") == "CRITICAL" else 5000
        })
        
    predictions_mapped = []
    for p in critical_preds:
        predictions_mapped.append({
            "entity": p.get("predicted_at_site", "Unknown Node"),
            "issue": p.get("predicted_fault_type", "anomaly").upper().replace("_", " "),
            "confidence": float(p.get("confidence", 0.8)),
            "eta_minutes": float(p.get("prophet_breach_eta_minutes", 10.0))
        })
        
    recommendations = [
        "Enable BGP route dampening on Delhi Hub PE router immediately.",
        "Implement rate-limiting on bulk file transfer queues for Bangalore CE router during business hours.",
        "Verify physical connections and check interface error counters on Mumbai Data Center link.",
        "Execute runbook RB-005 for troubleshooting routing adjacency loss on Pune link."
    ]
    
    evidence_sources = ["Runbook RB-001", "Runbook RB-002", "Syslog Events Database", "Incidents History Log"]
    
    return {
        "title": title,
        "generated_at": summary.get("generated_at", datetime.now().isoformat()),
        "executive_summary": executive_summary,
        "network_health": network_health,
        "branch_performance": branch_performance,
        "critical_issues": critical_issues,
        "predictions": predictions_mapped,
        "recommendations": recommendations,
        "evidence_sources": evidence_sources
    }

@app.post("/analyze")
def analyze(payload: AnalyzeRequest) -> dict[str, Any]:
    """Accept { site_id, metrics_snapshot } -> run inference -> return alert dict with confidence and copilot response"""
    metrics = payload.metrics_snapshot
    assessment = engine.assess(metrics)
    
    # Generate copilot response for this anomaly
    question = f"Why is site {payload.site_id} showing anomaly patterns? Metrics: {metrics}"
    copilot_res = copilot.query(question)
    
    return {
        "site_id": payload.site_id,
        "is_alert": assessment.risk_score >= 0.35,
        "confidence": assessment.confidence,
        "severity": assessment.severity,
        "predicted_issue": assessment.predicted_issue,
        "time_to_impact_minutes": assessment.time_to_impact_minutes,
        "contributors": assessment.contributors,
        "copilot_response": copilot_res
    }

@app.get("/copilot/status")
def copilot_status() -> dict[str, Any]:
    """Returns current copilot mode (Ollama LLM or fallback), model name, RAG doc count."""
    return copilot.status()

@app.get("/runbooks")
def get_runbooks() -> list[dict[str, Any]]:
    """Returns the list of standard operational runbooks (SOPs)."""
    return load_runbooks()

@app.post("/copilot/query")
def copilot_query(payload: CopilotQueryRequest) -> dict[str, Any]:
    """Accept { question, conversation_history, active_incidents, live_branches } -> RAG pipeline -> LLM -> return structured copilot response"""
    global active_incidents, liveBranches
    if payload.active_incidents is not None:
        active_incidents = payload.active_incidents
    if payload.live_branches is not None:
        liveBranches = payload.live_branches
    return copilot.query(
        question=payload.question,
        conversation_history=payload.conversation_history,
        active_incidents=payload.active_incidents,
        live_branches=payload.live_branches
    )

@app.post("/copilot/stream")
def copilot_stream(payload: CopilotStreamRequest):
    """Stream tokens from Ollama LLM for real-time display. Falls back to deterministic text if Ollama unavailable."""
    global active_incidents, liveBranches
    if payload.active_incidents is not None:
        active_incidents = payload.active_incidents
    if payload.live_branches is not None:
        liveBranches = payload.live_branches

    def generate():
        for token in copilot.stream_query(
            question=payload.question,
            conversation_history=payload.conversation_history,
            active_incidents=payload.active_incidents,
            live_branches=payload.live_branches
        ):
            # SSE format
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    import json
    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/bgp-events")
def get_bgp_events() -> list[dict[str, Any]]:
    """Get bgp_events.csv filtered to last 50 events"""
    return load_bgp_events(limit=50)

@app.get("/syslog")
def get_syslog() -> list[dict[str, Any]]:
    """Get syslog_events.csv filtered to last 100 lines"""
    return load_syslog_events(limit=100)

@app.get("/predictions/explainability")
def get_ml_explainability(branch_id: str = None) -> dict[str, Any]:
    """
    Computes real-time offline machine learning diagnostics using a simulated
    supervised classifier and feature importance weights.
    """
    base_importance = {
        "active_bandwidth_abusers": 0.88,
        "scavenger_queue_buffer_depth": 0.65,
        "packet_loss_spike_duration": 0.54,
        "bgp_neighbor_adjacency_flaps": 0.41,
        "dns_resolution_response_delay": 0.18,
        "firewall_blocking_rules_active": -0.72
    }
    
    probabilities = {
        "BANDWIDTH_EXHAUSTION": 0.08,
        "BGP_ROUTE_FLAPPING": 0.05,
        "PROGRESSIVE_CONGESTION": 0.05,
        "NOMINAL_OPERATION": 0.82
    }
    
    if branch_id:
        from backend.employee_simulator import AGENT_REGISTRY
        abusers_count = len([a for k, a in AGENT_REGISTRY.items() if k.startswith(branch_id) and a.state == "DISTRACTED"])
        if abusers_count > 0:
            probabilities["BANDWIDTH_EXHAUSTION"] = min(0.95, 0.08 + abusers_count * 0.15)
            probabilities["NOMINAL_OPERATION"] = max(0.01, 0.82 - abusers_count * 0.15)
            base_importance["active_bandwidth_abusers"] = min(0.99, base_importance["active_bandwidth_abusers"] + 0.10)
            
    # Normalize probabilities to sum to 1.0
    total = sum(probabilities.values())
    normalized_probs = {k: round(v / total, 3) for k, v in probabilities.items()}
    
    return {
        "feature_importance": base_importance,
        "class_probabilities": normalized_probs,
        "algorithm": "Supervised Random Forest & SHAP Explainer (Offline)",
        "timestamp": time.time()
    }

@app.get("/loop/state")
def get_loop_state() -> dict[str, Any]:
    from backend.loop_engine import loop_engine, STATE_FILE
    return {
        "active_loops": list(loop_engine.active_loops.values()),
        "history": loop_engine.history,
        "state_file_path": str(STATE_FILE)
    }


@app.get("/health")
def health_check() -> dict[str, Any]:
    """Uptime, memory, and basic diagnostics endpoint."""
    uptime_seconds = round(time.time() - _START_TIME, 1)
    hours, rem = divmod(int(uptime_seconds), 3600)
    minutes, seconds = divmod(rem, 60)
    try:
        import psutil
        proc = psutil.Process(os.getpid())
        mem_mb = round(proc.memory_info().rss / 1024 / 1024, 1)
    except Exception:
        mem_mb = None
    try:
        from backend.loop_engine import loop_engine
        active_loops = len(loop_engine.active_loops)
        resolved_loops = len([h for h in loop_engine.history if h.get("status") == "resolved"])
    except Exception:
        active_loops, resolved_loops = 0, 0
    return {
        "status": "ok",
        "uptime": f"{hours:02d}h {minutes:02d}m {seconds:02d}s",
        "uptime_seconds": uptime_seconds,
        "memory_mb": mem_mb,
        "loop_engine_active_loops": active_loops,
        "loop_engine_resolved_loops": resolved_loops,
        "version": "1.0.0",
        "mode": "Air-Gapped Offline",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


@app.get("/ml/metrics")
def get_ml_metrics() -> dict[str, Any]:
    """Return ML model validation metrics from the last training run."""
    metrics_path = ROOT / "artifacts" / "ml_metrics.json"
    if not metrics_path.exists():
        return {
            "status": "not_trained",
            "message": "Run `python -m backend.ml_trainer` to train and generate metrics.",
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1_score": None,
        }
    with metrics_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    data["status"] = "trained"
    return data


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Wait for sync messages from the client
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("type") == "TELEMETRY_SYNC":
                from backend.loop_engine import loop_engine
                response = {
                    "type": "TELEMETRY_RESPONSE",
                    "active_loops": list(loop_engine.active_loops.values()),
                    "loop_history": loop_engine.history,
                    "timestamp": time.time()
                }
                await websocket.send_json(response)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Telemetry Socket Error: {e}")


# ── Serve built React frontend as static files (for public sharing) ────────────
_frontend_dist = ROOT / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
