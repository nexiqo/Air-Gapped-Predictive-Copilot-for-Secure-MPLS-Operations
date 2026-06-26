from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

from api.copilot import CopilotService
from api.predictive_engine import PredictiveEngine
from api.topology_models import NetworkTopology, NetworkSummary, BranchDetail, ReportData


ROOT = Path(__file__).resolve().parents[1]
DEMO_CSV = ROOT / "data" / "telemetry" / "demo_metrics.csv"

app = FastAPI(title="Air-Gapped Predictive NOC Copilot", version="0.1.0")
engine = PredictiveEngine()
copilot = CopilotService()


class TelemetrySnapshot(BaseModel):
    site: str = Field(default="branch-a")
    link: str = Field(default="hub1-branch-a")
    interface_util_pct: float
    latency_ms: float
    jitter_ms: float
    packet_loss_pct: float
    bgp_flaps_5m: int = 0
    ospf_events_5m: int = 0
    tunnel_rekeys_15m: int = 0
    error_rate_pct: float = 0.0
    queue_depth_pct: float = 0.0


def latest_demo_snapshot() -> dict[str, Any]:
    with DEMO_CSV.open("r", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise RuntimeError("Demo telemetry file is empty. Run scripts/generate_demo_data.py first.")
    latest = rows[-1]
    numeric_fields = {
        "interface_util_pct",
        "latency_ms",
        "jitter_ms",
        "packet_loss_pct",
        "bgp_flaps_5m",
        "ospf_events_5m",
        "tunnel_rekeys_15m",
        "error_rate_pct",
        "queue_depth_pct",
    }
    parsed: dict[str, Any] = {}
    for key, value in latest.items():
        if key in numeric_fields:
            parsed[key] = float(value)
        else:
            parsed[key] = value
    return parsed


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "offline-first"}


@app.get("/demo/latest")
def demo_latest() -> dict[str, Any]:
    snapshot = latest_demo_snapshot()
    assessment = engine.assess(snapshot)
    return {"snapshot": snapshot, "assessment": assessment.to_dict()}


@app.post("/analyze")
def analyze(snapshot: TelemetrySnapshot) -> dict[str, Any]:
    payload = snapshot.model_dump()
    assessment = engine.assess(payload)
    response = copilot.build_response("What is likely to fail next and why?", assessment, payload)
    return {"assessment": assessment.to_dict(), "copilot": response}


@app.get("/query")
def query(q: str = Query(..., min_length=3)) -> dict[str, Any]:
    snapshot = latest_demo_snapshot()
    assessment = engine.assess(snapshot)
    response = copilot.build_response(q, assessment, snapshot)
    return {"question": q, "response": response}


@app.get("/topology")
def get_topology() -> NetworkTopology:
    """Get full network topology with nodes, edges, and real-time status"""
    return NetworkTopology.generate_demo_topology()


@app.get("/summary")
def get_network_summary() -> NetworkSummary:
    """Get network-wide summary including critical issues and predictions"""
    return NetworkSummary.generate_demo_summary()


@app.get("/branches")
def get_branches() -> dict[str, Any]:
    """Get list of all branches with summary information"""
    topology = NetworkTopology.generate_demo_topology()
    branches = []
    for node_id, node_data in topology.nodes.items():
        if node_data.type in ["BRANCH", "HUB", "DATACENTER"]:
            branches.append({
                "id": node_id,
                "name": node_data.name,
                "type": node_data.type,
                "location": node_data.location,
                "status": node_data.status,
                "latency_ms": node_data.metrics.latency_ms,
                "packet_loss_pct": node_data.metrics.packet_loss_pct,
                "utilization_pct": node_data.metrics.utilization_pct,
                "has_prediction": node_data.prediction is not None
            })
    return {"branches": branches}


@app.get("/branches/{branch_id}")
def get_branch_detail(branch_id: str) -> BranchDetail:
    """Get detailed information for a specific branch"""
    topology = NetworkTopology.generate_demo_topology()
    if branch_id not in topology.nodes:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Branch {branch_id} not found")
    
    return BranchDetail.from_topology_node(topology, branch_id)


@app.get("/alerts")
def get_alerts(severity: str | None = None) -> dict[str, Any]:
    """Get current alerts with optional severity filter"""
    topology = NetworkTopology.generate_demo_topology()
    alerts = []
    
    for node_id, node_data in topology.nodes.items():
        if node_data.status in ["CRITICAL", "WARNING"]:
            alert_severity = "critical" if node_data.status == "CRITICAL" else "warning"
            if severity is None or alert_severity == severity.lower():
                alerts.append({
                    "id": f"alert-{node_id}",
                    "entity_id": node_id,
                    "entity_name": node_data.name,
                    "severity": alert_severity,
                    "type": "node_health",
                    "message": f"{node_data.name} is in {node_data.status} state",
                    "timestamp": "2026-06-26T14:00:00Z",
                    "metrics": {
                        "latency_ms": node_data.metrics.latency_ms,
                        "packet_loss_pct": node_data.metrics.packet_loss_pct,
                        "utilization_pct": node_data.metrics.utilization_pct
                    },
                    "prediction": node_data.prediction.dict() if node_data.prediction else None
                })
    
    for edge in topology.edges:
        if edge.status in ["DEGRADED", "CRITICAL"]:
            alert_severity = "critical" if edge.status == "CRITICAL" else "warning"
            if severity is None or alert_severity == severity.lower():
                alerts.append({
                    "id": f"alert-{edge.id}",
                    "entity_id": edge.id,
                    "entity_name": f"{edge.source} → {edge.target}",
                    "severity": alert_severity,
                    "type": "link_health",
                    "message": f"Link {edge.source} → {edge.target} is {edge.status}",
                    "timestamp": "2026-06-26T14:00:00Z",
                    "metrics": {
                        "latency_ms": edge.metrics.latency_ms,
                        "utilization_pct": edge.metrics.utilization_pct
                    },
                    "prediction": None
                })
    
    return {"alerts": alerts}


@app.get("/reports")
def get_reports(report_type: str = "executive") -> ReportData:
    """Get various types of network reports"""
    return ReportData.generate_report(report_type)
