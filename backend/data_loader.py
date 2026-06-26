from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

def load_topology() -> dict[str, Any]:
    path = DATA_DIR / "topology.json"
    if not path.exists():
        return {"nodes": {}, "edges": []}
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    
    nodes_dict = {}
    predictions = load_predictions()
    pred_map = {(p.get("predicted_at_site"), p.get("predicted_fault_type")): p for p in predictions}
    
    raw_nodes = data.get("nodes", [])
    if isinstance(raw_nodes, list):
        for node in raw_nodes:
            node_id = node.get("id")
            if not node_id:
                continue
                
            status = node.get("status", "healthy").upper()
            if status == "HEALTHY":
                status = "NORMAL"
                
            name = node.get("label", node_id.replace("branch-", "").replace("hub-", "").title())
            
            coords = None
            if "lat" in node and "lon" in node:
                coords = [float(node["lat"]), float(node["lon"])]
            elif "coordinates" in node:
                coords = node["coordinates"]
                
            m = node.get("metrics", {})
            metrics = {
                "latency_ms": m.get("latency_ms", 0.0),
                "packet_loss_pct": m.get("packet_loss_pct", 0.0),
                "utilization_pct": m.get("bandwidth_util_pct", 0.0),
                "jitter_ms": m.get("jitter_ms", 0.0)
            }
            
            prediction = None
            raw_pred = node.get("prediction")
            if raw_pred:
                issue = raw_pred.get("issue")
                pred_row = pred_map.get((node_id, issue))
                
                rec_actions = []
                reasoning = ""
                if pred_row:
                    reasoning = pred_row.get("reasoning", "")
                    for i in range(1, 9):
                        act = pred_row.get(f"recommended_action_{i}")
                        if act:
                            rec_actions.append(act)
                else:
                    rec_actions = ["Check node config and baseline template"]
                    
                prediction = {
                    "issue": issue.upper().replace("_", " ") if issue else "UNKNOWN ANOMALY",
                    "confidence": float(raw_pred.get("confidence", 0.8)),
                    "eta_minutes": float(raw_pred.get("eta_minutes", 10.0)),
                    "severity": raw_pred.get("severity", "MEDIUM").lower(),
                    "reasoning": reasoning,
                    "recommended_actions": rec_actions
                }
            
            nodes_dict[node_id] = {
                "id": node_id,
                "name": name,
                "type": node.get("type", "branch").upper(),
                "location": f"{node.get('city', '')}, {node.get('state', '')}".strip(", "),
                "coordinates": coords,
                "status": status,
                "metrics": metrics,
                "prediction": prediction,
                "connected_services": node.get("services", []),
                "incidents": []
            }
            
    raw_edges = data.get("edges", [])
    edges_list = []
    for edge in raw_edges:
        edge_id = edge.get("id")
        source = edge.get("source")
        target = edge.get("target")
        
        status = edge.get("status", "healthy").upper()
        if status == "HEALTHY":
            status = "NORMAL"
            
        m = edge.get("metrics", {})
        metrics = {
            "latency_ms": m.get("latency_ms", 0.0),
            "utilization_pct": m.get("util_pct", 0.0),
            "jitter_ms": m.get("jitter_ms", 0.0),
            "packet_loss_pct": m.get("packet_loss_pct", 0.0)
        }
        
        edges_list.append({
            "id": edge_id,
            "source": source,
            "target": target,
            "type": edge.get("type", "mpls-access").upper().replace("-", "_"),
            "bandwidth": f"{edge.get('capacity_mbps', 1000) / 1000} Gbps",
            "status": status,
            "metrics": metrics,
            "prediction": None
        })
        
    return {
        "generated_at": data.get("generated_at", ""),
        "simulation_window": data.get("simulation_window", {}),
        "summary": data.get("summary", {}),
        "nodes": list(nodes_dict.values()),
        "edges": edges_list
    }

def load_summary() -> dict[str, Any]:
    path = DATA_DIR / "network_summary.json"
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def load_branches() -> list[dict[str, Any]]:
    path = DATA_DIR / "branch_details.json"
    with path.open("r", encoding="utf-8") as f:
        details = json.load(f)
    
    branches = []
    for branch_id, info in details.items():
        risk_score = info.get("risk_score", 0.0)
        status = info.get("current_status", "healthy").upper()
        if status == "HEALTHY":
            status = "NORMAL"
            
        location = f"{info.get('city', '')}, {info.get('state', '')}".strip(", ")
        if not location:
            location = info.get("region", "India")
            
        has_prediction = len(info.get("active_predictions", [])) > 0
        
        branches.append({
            "id": branch_id,
            "name": info.get("name", branch_id.replace("branch-", "").title()),
            "region": info.get("region", ""),
            "location": location,
            "type": "BRANCH" if "branch" in branch_id else "HUB" if "hub" in branch_id else "DATACENTER",
            "status": status,
            "latency_ms": info.get("current_metrics", {}).get("latency_ms", 0.0),
            "packet_loss_pct": info.get("current_metrics", {}).get("packet_loss_pct", 0.0),
            "utilization_pct": info.get("current_metrics", {}).get("bandwidth_util_pct", 0.0),
            "risk_score": risk_score,
            "predicted_issue": info.get("active_predictions", [{}])[0].get("predicted_fault_type", "None") if info.get("active_predictions") else "None",
            "sla": info.get("sla_status", "COMPLIANT"),
            "current_metrics": info.get("current_metrics", {}),
            "has_prediction": has_prediction
        })
    return branches

def load_branch_detail(branch_id: str) -> dict[str, Any] | None:
    path = DATA_DIR / "branch_details.json"
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        details = json.load(f)
    info = details.get(branch_id)
    if not info:
        return None
        
    status = info.get("current_status", "healthy").upper()
    if status == "HEALTHY":
        status = "NORMAL"
        
    location = f"{info.get('city', '')}, {info.get('state', '')}".strip(", ")
    
    prediction = None
    active_preds = info.get("active_predictions", [])
    if active_preds:
        p = active_preds[0]
        rec_actions = []
        for i in range(1, 9):
            act = p.get(f"recommended_action_{i}")
            if act:
                rec_actions.append(act)
        if not rec_actions and p.get("recommended_action_1"):
            rec_actions = [p["recommended_action_1"]]
            
        prediction = {
            "issue": p.get("predicted_fault_type", "Unknown Anomaly").upper().replace("_", " "),
            "confidence": float(p.get("confidence", 0.8)),
            "eta_minutes": float(p.get("prophet_breach_eta_minutes", 10.0)),
            "severity": p.get("severity_forecast", "MEDIUM").lower(),
            "reasoning": p.get("reasoning", ""),
            "recommended_actions": rec_actions
        }
        
    incidents = []
    for inc in info.get("recent_incidents", []):
        inc_status = inc.get("status", "resolved").upper()
        incidents.append({
            "id": inc.get("incident_id"),
            "type": inc.get("fault_type", "anomaly").upper().replace("_", " "),
            "status": inc_status
        })
        
    curr_metrics = info.get("current_metrics", {})
    metrics = {
        "latency_ms": curr_metrics.get("latency_ms", 0.0),
        "packet_loss_pct": curr_metrics.get("packet_loss_pct", 0.0),
        "utilization_pct": curr_metrics.get("bandwidth_util_pct", 0.0),
        "jitter_ms": curr_metrics.get("jitter_ms", 0.0)
    }
    
    node_mapped = {
        "id": branch_id,
        "name": info.get("name", branch_id.replace("branch-", "").title()),
        "status": status,
        "type": "BRANCH" if "branch" in branch_id else "HUB" if "hub" in branch_id else "DATACENTER",
        "location": location,
        "metrics": metrics,
        "connected_services": info.get("services", []),
        "prediction": prediction,
        "incidents": incidents
    }
    
    return {"node": node_mapped}

def load_incidents() -> list[dict[str, Any]]:
    path = DATA_DIR / "incidents.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        incidents = list(reader)
    
    # Sort order for severity
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    
    def sort_key(inc: dict[str, Any]):
        sev = inc.get("severity", "MEDIUM").upper()
        # sort by severity first, then by timestamp_start descending
        return (severity_order.get(sev, 2), inc.get("timestamp_start", ""))
    
    incidents.sort(key=sort_key)
    return incidents

def load_predictions() -> list[dict[str, Any]]:
    path = DATA_DIR / "predictions.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        predictions = list(reader)
    
    def sort_key(pred: dict[str, Any]):
        try:
            return -float(pred.get("confidence", 0.0))
        except ValueError:
            return 0.0
            
    predictions.sort(key=sort_key)
    return predictions

def load_bgp_events(limit: int = 50) -> list[dict[str, Any]]:
    path = DATA_DIR / "bgp_events.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        events = list(reader)
    
    # Sort events by timestamp descending (if available) or keep order and slice last 50
    # Let's return the last 'limit' items
    return events[-limit:]

def load_syslog_events(limit: int = 100) -> list[dict[str, Any]]:
    path = DATA_DIR / "syslog_events.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        logs = list(reader)
    
    return logs[-limit:]

def load_runbooks() -> list[dict[str, Any]]:
    path = DATA_DIR / "runbooks.json"
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def load_validation_results() -> list[dict[str, Any]]:
    path = DATA_DIR / "validation_results.json"
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def load_netflow() -> list[dict[str, Any]]:
    path = DATA_DIR / "netflow.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)
