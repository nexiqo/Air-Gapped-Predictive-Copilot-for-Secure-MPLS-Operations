from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "telemetry" / "features.csv"

NODES_DEF = {
    "mumbai-hub": {"name": "Mumbai Hub - NOC", "type": "HUB", "location": "Mumbai, Maharashtra", "coordinates": [19.0760, 72.8777]},
    "dc-core": {"name": "Data Center - Core Banking", "type": "DATACENTER", "location": "Mumbai Data Center", "coordinates": [19.0176, 72.8562]},
    "bangalore-branch": {"name": "Bangalore Branch - Tech Hub", "type": "BRANCH", "location": "Bangalore, Karnataka", "coordinates": [12.9716, 77.5946]},
    "chennai-branch": {"name": "Chennai Branch - South Ops", "type": "BRANCH", "location": "Chennai, Tamil Nadu", "coordinates": [13.0827, 80.2707]},
    "hyderabad-branch": {"name": "Hyderabad Branch - AP Ops", "type": "BRANCH", "location": "Hyderabad, Telangana", "coordinates": [17.3850, 78.4867]},
    "ahmedabad-branch": {"name": "Ahmedabad Branch - West Ops", "type": "BRANCH", "location": "Ahmedabad, Gujarat", "coordinates": [23.0225, 72.5714]},
    "delhi-branch": {"name": "Delhi Branch - North Ops", "type": "BRANCH", "location": "Delhi", "coordinates": [28.6139, 77.2090]},
    "kochi-branch": {"name": "Kochi Branch - Kerala Ops", "type": "BRANCH", "location": "Kochi, Kerala", "coordinates": [9.9312, 76.2673]},
    "kolkata-branch": {"name": "Kolkata Branch - East Ops", "type": "BRANCH", "location": "Kolkata, West Bengal", "coordinates": [22.5726, 88.3639]}
}

LINKS_DEF = [
    {"id": "mumbai-dc", "source": "mumbai-hub", "target": "dc-core", "type": "CORE_LINK", "bandwidth": "10 Gbps"},
    {"id": "mumbai-bangalore", "source": "mumbai-hub", "target": "bangalore-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "mumbai-chennai", "source": "mumbai-hub", "target": "chennai-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "mumbai-hyderabad", "source": "mumbai-hub", "target": "hyderabad-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "mumbai-ahmedabad", "source": "mumbai-hub", "target": "ahmedabad-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "mumbai-delhi", "source": "mumbai-hub", "target": "delhi-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "mumbai-kochi", "source": "mumbai-hub", "target": "kochi-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "mumbai-kolkata", "source": "mumbai-hub", "target": "kolkata-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps"},
    {"id": "bangalore-chennai", "source": "bangalore-branch", "target": "chennai-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps"},
    {"id": "kochi-chennai", "source": "kochi-branch", "target": "chennai-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps"},
    {"id": "hyderabad-bangalore", "source": "hyderabad-branch", "target": "bangalore-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps"},
    {"id": "ahmedabad-delhi", "source": "ahmedabad-branch", "target": "delhi-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps"},
    {"id": "kolkata-delhi", "source": "kolkata-branch", "target": "delhi-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps"}
]

def load_latest_telemetry() -> dict[str, dict[str, Any]]:
    # Read features.csv and return dict of link_id -> metrics row for the latest timestamp
    if not FEATURES_CSV.exists():
        return {}
    
    with FEATURES_CSV.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
    if not rows:
        return {}

    # Group by timestamp and find the latest one
    latest_ts = rows[-1]["timestamp"]
    latest_rows = [r for r in rows if r["timestamp"] == latest_ts]

    telemetry: dict[str, dict[str, Any]] = {}
    for r in latest_rows:
        link_id = r["link"]
        parsed = {}
        for k, v in r.items():
            if k in ["timestamp", "site", "link", "scenario"]:
                parsed[k] = v
            elif k in ["bgp_flaps_5m", "ospf_events_5m", "tunnel_rekeys_15m", "risk_label"]:
                parsed[k] = int(v) if v else 0
            else:
                parsed[k] = float(v) if v else 0.0
        telemetry[link_id] = parsed
    return telemetry


class NetworkTopology(BaseModel):
    """Complete network topology with nodes and edges"""
    nodes: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    edges: List[Dict[str, Any]] = Field(default_factory=list)
    last_updated: str = Field(default_factory=lambda: datetime.now().isoformat())
    
    @classmethod
    def generate_demo_topology(cls) -> "NetworkTopology":
        from backend.predictive_engine import PredictiveEngine
        engine = PredictiveEngine()

        telemetry = load_latest_telemetry()
        
        # Build edges dynamically
        demo_edges = []
        for l_def in LINKS_DEF:
            link_id = l_def["id"]
            tel_row = telemetry.get(link_id, {})

            # Current metrics
            metrics = {
                "latency_ms": tel_row.get("latency_ms", 15.0),
                "utilization_pct": tel_row.get("interface_util_pct", 30.0),
                "jitter_ms": tel_row.get("jitter_ms", 1.2),
                "packet_loss_pct": tel_row.get("packet_loss_pct", 0.0),
                "bandwidth_mbps": 10000 if l_def["type"] == "CORE_LINK" else 1000 if "PRIMARY" in l_def["type"] else 500
            }

            # Assess prediction using ML model
            assessment = engine.assess(tel_row) if tel_row else None
            prediction = None
            if assessment and assessment.risk_score > 0.35:
                prediction = {
                    "issue": assessment.predicted_issue,
                    "confidence": assessment.confidence,
                    "eta_minutes": assessment.time_to_impact_minutes,
                    "severity": assessment.severity,
                    "reasoning": "; ".join(assessment.contributors),
                    "recommended_actions": [
                        f"Verify telemetry thresholds for {link_id}",
                        f"Reroute critical transactions if load exceeds 85%"
                    ]
                }

            # Determine status based on risk or thresholds
            status = "NORMAL"
            if metrics["packet_loss_pct"] > 4.0 or (prediction and prediction["severity"] == "critical"):
                status = "CRITICAL"
            elif metrics["packet_loss_pct"] > 1.5 or metrics["latency_ms"] > 100 or (prediction and prediction["severity"] == "high"):
                status = "DEGRADED"

            demo_edges.append({
                "id": link_id,
                "source": l_def["source"],
                "target": l_def["target"],
                "type": l_def["type"],
                "bandwidth": l_def["bandwidth"],
                "status": status,
                "metrics": metrics,
                "prediction": prediction
            })

        # Build nodes dynamically
        demo_nodes = {}
        for node_id, n_def in NODES_DEF.items():
            # Find connected edges
            connected = [e for e in demo_edges if e["source"] == node_id or e["target"] == node_id]
            
            # Aggregate metrics
            latency = sum(e["metrics"]["latency_ms"] for e in connected) / len(connected) if connected else 10.0
            loss = max(e["metrics"]["packet_loss_pct"] for e in connected) if connected else 0.0
            util = max(e["metrics"]["utilization_pct"] for e in connected) if connected else 20.0
            jitter = max(e["metrics"]["jitter_ms"] for e in connected) if connected else 0.5

            # Set status
            status = "NORMAL"
            node_prediction = None

            # Get worst-case prediction among connected links
            pred_edges = [e for e in connected if e["prediction"] is not None]
            if pred_edges:
                pred_edges.sort(key=lambda x: x["prediction"]["confidence"], reverse=True)
                worst_pred = pred_edges[0]["prediction"]
                node_prediction = {
                    "issue": worst_pred["issue"],
                    "confidence": worst_pred["confidence"],
                    "eta_minutes": worst_pred["eta_minutes"],
                    "severity": worst_pred["severity"],
                    "reasoning": worst_pred["reasoning"],
                    "recommended_actions": worst_pred["recommended_actions"]
                }
                if worst_pred["severity"] == "critical":
                    status = "CRITICAL"
                elif worst_pred["severity"] in ["high", "medium"]:
                    status = "WARNING"

            # Direct overrides for datacenter core and hub
            if loss > 3.0:
                status = "CRITICAL"
            elif loss > 1.0 or util > 75.0:
                status = "WARNING"

            connected_services = []
            if n_def["type"] == "HUB":
                connected_services = ["NOC_Monitoring", "WAN_Aggregation", "VPN_Gateway"]
            elif n_def["type"] == "DATACENTER":
                connected_services = ["Core_Banking_System", "Payment_Gateway", "DB_Cluster"]
            else:
                connected_services = ["ATM_Gateway", "Teller_Services", "Branch_WiFi"]

            incidents = []
            if status == "CRITICAL":
                incidents.append({"id": f"INC-{(len(demo_nodes)+1):03d}", "type": "outage", "timestamp": datetime.now().isoformat(), "status": "open"})
            elif status == "WARNING":
                incidents.append({"id": f"INC-{(len(demo_nodes)+1):03d}", "type": "degradation", "timestamp": datetime.now().isoformat(), "status": "investigating"})

            demo_nodes[node_id] = {
                "id": node_id,
                "name": n_def["name"],
                "type": n_def["type"],
                "location": n_def["location"],
                "coordinates": n_def["coordinates"],
                "status": status,
                "metrics": {
                    "latency_ms": round(latency, 2),
                    "packet_loss_pct": round(loss, 2),
                    "utilization_pct": round(util, 2),
                    "jitter_ms": round(jitter, 2),
                    "bandwidth_mbps": 10000 if n_def["type"] in ["HUB", "DATACENTER"] else 1000
                },
                "prediction": node_prediction,
                "connected_services": connected_services,
                "incidents": incidents
            }

        return cls(nodes=demo_nodes, edges=demo_edges)


class NetworkSummary(BaseModel):
    """Network-wide summary for shift overview"""
    overall_health: str
    total_nodes: int
    critical_nodes: int
    warning_nodes: int
    normal_nodes: int
    total_edges: int
    degraded_edges: int
    most_critical_issue: str
    most_at_risk_branch: str
    next_likely_failure: str
    eta_to_failure: int
    confidence: float
    alert_count: Dict[str, int]
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    
    @classmethod
    def generate_demo_summary(cls) -> "NetworkSummary":
        topology = NetworkTopology.generate_demo_topology()
        
        # Count stats
        total_nodes = len(topology.nodes)
        critical_nodes = sum(1 for n in topology.nodes.values() if n["status"] == "CRITICAL")
        warning_nodes = sum(1 for n in topology.nodes.values() if n["status"] == "WARNING")
        normal_nodes = total_nodes - critical_nodes - warning_nodes
        
        total_edges = len(topology.edges)
        degraded_edges = sum(1 for e in topology.edges if e["status"] in ["DEGRADED", "CRITICAL"])
        
        overall_health = "NORMAL"
        if critical_nodes > 0:
            overall_health = "CRITICAL"
        elif warning_nodes > 0 or degraded_edges > 0:
            overall_health = "DEGRADED"

        # Find most critical prediction
        most_critical_issue = "No active critical issues"
        most_at_risk_branch = "None"
        next_likely_failure = "None"
        eta_to_failure = 0
        confidence = 0.0

        predictions = []
        for n_id, n in topology.nodes.items():
            if n["prediction"]:
                predictions.append((n_id, n["prediction"]))

        if predictions:
            # Sort by confidence
            predictions.sort(key=lambda x: x[1]["confidence"], reverse=True)
            worst_id, worst_pred = predictions[0]
            most_critical_issue = f"{topology.nodes[worst_id]['name']} - {worst_pred['issue']}"
            most_at_risk_branch = worst_id
            next_likely_failure = worst_pred["issue"]
            eta_to_failure = worst_pred["eta_minutes"]
            confidence = worst_pred["confidence"]

        alert_count = {
            "critical": critical_nodes,
            "warning": warning_nodes,
            "info": degraded_edges
        }

        return cls(
            overall_health=overall_health,
            total_nodes=total_nodes,
            critical_nodes=critical_nodes,
            warning_nodes=warning_nodes,
            normal_nodes=normal_nodes,
            total_edges=total_edges,
            degraded_edges=degraded_edges,
            most_critical_issue=most_critical_issue,
            most_at_risk_branch=most_at_risk_branch,
            next_likely_failure=next_likely_failure,
            eta_to_failure=eta_to_failure,
            confidence=confidence,
            alert_count=alert_count
        )


class BranchDetail(BaseModel):
    """Detailed information for a specific branch"""
    node: Dict[str, Any]
    connected_edges: List[Dict[str, Any]]
    dependent_services: List[str]
    recent_incidents: List[Dict[str, Any]]
    risk_assessment: Dict[str, Any]
    runbook_references: List[str]
    
    @classmethod
    def from_topology_node(cls, topology: NetworkTopology, node_id: str) -> "BranchDetail":
        node = topology.nodes[node_id]
        
        # Find connected edges
        connected_edges = [
            edge for edge in topology.edges 
            if edge["source"] == node_id or edge["target"] == node_id
        ]
        
        # Risk assessment
        risk_assessment = {
            "overall_risk": "high" if node["status"] == "CRITICAL" else "medium" if node["status"] == "WARNING" else "low",
            "risk_factors": [
                f"Latency: {node['metrics']['latency_ms']}ms",
                f"Packet Loss: {node['metrics']['packet_loss_pct']}%",
                f"Utilization: {node['metrics']['utilization_pct']}%"
            ],
            "prediction": node["prediction"]
        }
        
        # Runbook references
        runbook_refs = []
        if node_id == "mumbai-hub":
            runbook_refs = ["RB-002", "RB-001"]
        elif "bangalore" in node_id:
            runbook_refs = ["RB-002", "RB-003"]
        elif "kochi" in node_id:
            runbook_refs = ["RB-003"]
        elif "delhi" in node_id:
            runbook_refs = ["RB-001", "RB-004"]
        else:
            runbook_refs = ["RB-002"]
        
        return cls(
            node=node,
            connected_edges=connected_edges,
            dependent_services=node["connected_services"],
            recent_incidents=node["incidents"],
            risk_assessment=risk_assessment,
            runbook_references=runbook_refs
        )


class ReportData(BaseModel):
    """Report data structure for various report types"""
    report_type: str
    title: str
    generated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    executive_summary: str
    network_health: Dict[str, Any]
    branch_performance: List[Dict[str, Any]]
    critical_issues: List[Dict[str, Any]]
    predictions: List[Dict[str, Any]]
    recommendations: List[str]
    evidence_sources: List[str]
    
    @classmethod
    def generate_report(cls, report_type: str) -> "ReportData":
        topology = NetworkTopology.generate_demo_topology()
        
        if report_type == "executive":
            return cls._executive_report(topology)
        elif report_type == "branch":
            return cls._branch_report(topology)
        elif report_type == "prediction":
            return cls._prediction_report(topology)
        else:
            return cls._executive_report(topology)
    
    @classmethod
    def _executive_report(cls, topology: NetworkTopology) -> "ReportData":
        summary = NetworkSummary.generate_demo_summary()
        
        crit_list = []
        pred_list = []
        
        for name, node in topology.nodes.items():
            if node["status"] in ["CRITICAL", "WARNING"]:
                crit_list.append({
                    "issue": f"{node['name']} performance degradation",
                    "severity": node["status"].lower(),
                    "eta_minutes": 15,
                    "affected_services": node["connected_services"]
                })
            if node["prediction"]:
                pred_list.append({
                    "issue": node["prediction"]["issue"],
                    "confidence": node["prediction"]["confidence"],
                    "eta_minutes": node["prediction"]["eta_minutes"],
                    "branch": name
                })
        
        exec_summary = (
            f"TechCorp India's multi-state network operations are currently assessed as {summary.overall_health}. "
            f"Out of {summary.total_nodes} network core hubs and branches, {summary.critical_nodes} are experiencing critical degradation "
            f"and {summary.warning_nodes} are exhibiting warning precursors. "
            f"The primary predicted threat is '{summary.next_likely_failure}' at {summary.most_at_risk_branch} "
            f"with an estimated time-to-impact of {summary.eta_to_failure} minutes (confidence {summary.confidence:.0%})."
        )

        return cls(
            report_type="executive",
            title="NOC Executive Status Report",
            executive_summary=exec_summary,
            network_health={
                "overall_status": summary.overall_health,
                "health_score": round(1.0 - (summary.critical_nodes * 0.4 + summary.warning_nodes * 0.15 + summary.degraded_edges * 0.1), 2),
                "total_nodes": summary.total_nodes,
                "total_edges": summary.total_edges
            },
            branch_performance=[
                {
                    "branch": node["name"],
                    "status": node["status"],
                    "latency_ms": node["metrics"]["latency_ms"],
                    "availability": 99.9 if node["status"] == "NORMAL" else 98.4 if node["status"] == "WARNING" else 94.2
                }
                for node in topology.nodes.values()
            ],
            critical_issues=crit_list,
            predictions=pred_list,
            recommendations=[
                "Configure QoS policy to restrict secondary backup services during peak loads",
                "Enable automated BGP route damping on links experiencing flapping patterns",
                "Execute local playbook RAG retrieval recommendations in the NOC Copilot"
            ],
            evidence_sources=["features.csv", "ML-Model-Risk-Classifier", "RB-001", "RB-002"]
        )
    
    @classmethod
    def _branch_report(cls, topology: NetworkTopology) -> "ReportData":
        return cls(
            report_type="branch",
            title="Branch Operations Performance Report",
            executive_summary="State-by-state evaluation of TechCorp India network nodes. Performance shows localized congestion spikes during transaction peaks.",
            network_health={
                "total_branches": len([n for n in topology.nodes.values() if n["type"] == "BRANCH"]),
                "active_branches": len(topology.nodes)
            },
            branch_performance=[
                {
                    "branch": node["name"],
                    "location": node["location"],
                    "status": node["status"],
                    "latency_ms": node["metrics"]["latency_ms"],
                    "packet_loss_pct": node["metrics"]["packet_loss_pct"],
                    "utilization_pct": node["metrics"]["utilization_pct"],
                    "transactions_24h": int(node["metrics"]["utilization_pct"] * 250)
                }
                for node in topology.nodes.values()
            ],
            critical_issues=[],
            predictions=[],
            recommendations=[
                "Perform scheduled diagnostic sweeps on branch links displaying >1.5% packet loss",
                "Validate routing configs at branches exhibiting policy drift signs"
            ],
            evidence_sources=["network_telemetry_stream"]
        )
    
    @classmethod
    def _prediction_report(cls, topology: NetworkTopology) -> "ReportData":
        summary = NetworkSummary.generate_demo_summary()
        preds = []
        for n_id, n in topology.nodes.items():
            if n["prediction"]:
                preds.append({
                    "entity": n["name"],
                    "issue": n["prediction"]["issue"],
                    "confidence": n["prediction"]["confidence"],
                    "eta_minutes": n["prediction"]["eta_minutes"],
                    "severity": n["prediction"]["severity"]
                })
        
        return cls(
            report_type="prediction",
            title="AI Predictive Fault Forecast Report",
            executive_summary=f"The offline ML risk engine has identified {len(preds)} active predictive alerts. Proactive intervention is recommended prior to the predicted SLA times.",
            network_health={
                "prediction_count": len(preds),
                "average_confidence": summary.confidence
            },
            branch_performance=[],
            critical_issues=[],
            predictions=preds,
            recommendations=[
                "Review warning alerts and trigger recommended tunnel or link dampening playbooks",
                "Cross-examine the Copilot's narrative reasoning regarding current queue depth anomalies"
            ],
            evidence_sources=["ML-Model-Classifier", "Local-Knowledgebase-Retrieval"]
        )