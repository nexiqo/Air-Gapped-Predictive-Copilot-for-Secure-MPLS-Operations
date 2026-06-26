from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class NetworkTopology(BaseModel):
    """Complete network topology with nodes and edges"""
    nodes: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    edges: List[Dict[str, Any]] = Field(default_factory=list)
    last_updated: str = Field(default_factory=lambda: datetime.now().isoformat())
    
    @classmethod
    def generate_demo_topology(cls) -> "NetworkTopology":
        """Generate demo topology matching the TechCorp India network"""
        demo_nodes = {
            "mumbai-hub": {
                "id": "mumbai-hub",
                "name": "Mumbai Hub - NOC",
                "type": "HUB",
                "location": "Mumbai, Maharashtra",
                "coordinates": [19.0760, 72.8777],
                "status": "CRITICAL",
                "metrics": {
                    "latency_ms": 45,
                    "packet_loss_pct": 0.8,
                    "utilization_pct": 78,
                    "jitter_ms": 3.2,
                    "bandwidth_mbps": 10000
                },
                "prediction": {
                    "issue": "bandwidth_saturation",
                    "confidence": 0.85,
                    "eta_minutes": 120,
                    "severity": "high",
                    "reasoning": "Sustained high utilization during peak hours with rising queue depth",
                    "recommended_actions": [
                        "Implement traffic prioritization for critical banking services",
                        "Evaluate bandwidth expansion",
                        "Monitor alternate path availability"
                    ]
                },
                "connected_services": ["NOC_Monitoring", "Core_Banking_API", "Transaction_Processing"],
                "incidents": [
                    {"id": "INC-001", "type": "performance", "timestamp": "2026-06-26T10:00:00Z", "status": "open"}
                ]
            },
            "bangalore-branch": {
                "id": "bangalore-branch",
                "name": "Bangalore Branch - Tech Hub",
                "type": "BRANCH",
                "location": "Bangalore, Karnataka",
                "coordinates": [12.9716, 77.5946],
                "status": "WARNING",
                "metrics": {
                    "latency_ms": 82,
                    "packet_loss_pct": 2.3,
                    "utilization_pct": 65,
                    "jitter_ms": 5.8,
                    "bandwidth_mbps": 1000
                },
                "prediction": {
                    "issue": "link_degradation",
                    "confidence": 0.78,
                    "eta_minutes": 240,
                    "severity": "medium",
                    "reasoning": "Fiber degradation pattern on primary MPLS route",
                    "recommended_actions": [
                        "Switch to alternate Mumbai-Chennai route",
                        "Schedule fiber inspection",
                        "Monitor ATM transaction success rate"
                    ]
                },
                "connected_services": ["ATM_Gateway", "Branch_Banking", "Local_Services"],
                "incidents": [
                    {"id": "INC-002", "type": "connectivity", "timestamp": "2026-06-26T11:30:00Z", "status": "monitoring"}
                ]
            },
            "chennai-branch": {
                "id": "chennai-branch",
                "name": "Chennai Branch - South Ops",
                "type": "BRANCH",
                "location": "Chennai, Tamil Nadu",
                "coordinates": [13.0827, 80.2707],
                "status": "NORMAL",
                "metrics": {
                    "latency_ms": 56,
                    "packet_loss_pct": 0.5,
                    "utilization_pct": 45,
                    "jitter_ms": 2.1,
                    "bandwidth_mbps": 1000
                },
                "prediction": {
                    "issue": "weather_related_disruption",
                    "confidence": 0.45,
                    "eta_minutes": 1440,
                    "severity": "low",
                    "reasoning": "Monsoon season may cause minor latency fluctuations",
                    "recommended_actions": [
                        "Monitor weather forecasts",
                        "Prepare alternate routing procedures"
                    ]
                },
                "connected_services": ["ATM_Gateway", "Branch_Banking", "Regional_Services"],
                "incidents": []
            },
            "dc-core": {
                "id": "dc-core",
                "name": "Data Center - Core Banking",
                "type": "DATACENTER",
                "location": "Mumbai Data Center",
                "coordinates": [19.0176, 72.8562],
                "status": "NORMAL",
                "metrics": {
                    "latency_ms": 12,
                    "packet_loss_pct": 0.1,
                    "utilization_pct": 52,
                    "jitter_ms": 0.8,
                    "bandwidth_mbps": 10000
                },
                "prediction": None,
                "connected_services": ["Core_Banking_System", "Database_Cluster", "Payment_Gateway"],
                "incidents": []
            }
        }
        
        demo_edges = [
            {
                "id": "mumbai-bangalore",
                "source": "mumbai-hub",
                "target": "bangalore-branch",
                "type": "MPLS_PRIMARY",
                "bandwidth": "1 Gbps",
                "status": "DEGRADED",
                "metrics": {
                    "latency_ms": 82,
                    "utilization_pct": 78,
                    "jitter_ms": 5.8,
                    "packet_loss_pct": 2.3,
                    "bandwidth_mbps": 1000
                },
                "prediction": {
                    "issue": "congestion_buildup",
                    "confidence": 0.82,
                    "eta_minutes": 180,
                    "severity": "high",
                    "reasoning": "Elevated latency and packet loss on primary route",
                    "recommended_actions": [
                        "Consider traffic rerouting",
                        "Investigate fiber quality",
                        "Prepare failover procedures"
                    ]
                }
            },
            {
                "id": "mumbai-chennai",
                "source": "mumbai-hub",
                "target": "chennai-branch",
                "type": "MPLS_ALTERNATE",
                "bandwidth": "1 Gbps",
                "status": "NORMAL",
                "metrics": {
                    "latency_ms": 56,
                    "utilization_pct": 45,
                    "jitter_ms": 2.1,
                    "packet_loss_pct": 0.5,
                    "bandwidth_mbps": 1000
                },
                "prediction": None
            },
            {
                "id": "mumbai-dc",
                "source": "mumbai-hub",
                "target": "dc-core",
                "type": "CORE_LINK",
                "bandwidth": "10 Gbps",
                "status": "NORMAL",
                "metrics": {
                    "latency_ms": 12,
                    "utilization_pct": 52,
                    "jitter_ms": 0.8,
                    "packet_loss_pct": 0.1,
                    "bandwidth_mbps": 10000
                },
                "prediction": None
            },
            {
                "id": "bangalore-chennai",
                "source": "bangalore-branch",
                "target": "chennai-branch",
                "type": "INTER_BRANCH",
                "bandwidth": "500 Mbps",
                "status": "NORMAL",
                "metrics": {
                    "latency_ms": 35,
                    "utilization_pct": 30,
                    "jitter_ms": 1.5,
                    "packet_loss_pct": 0.2,
                    "bandwidth_mbps": 500
                },
                "prediction": None
            }
        ]
        
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
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    
    @classmethod
    def generate_demo_summary(cls) -> "NetworkSummary":
        """Generate demo network summary"""
        return cls(
            overall_health="DEGRADED",
            total_nodes=4,
            critical_nodes=1,
            warning_nodes=1,
            normal_nodes=2,
            total_edges=4,
            degraded_edges=1,
            most_critical_issue="Mumbai Hub bandwidth saturation risk",
            most_at_risk_branch="bangalore-branch",
            next_likely_failure="Mumbai-Bangalore link congestion",
            eta_to_failure=180,
            confidence=0.82,
            alert_count={"critical": 1, "warning": 2, "info": 0}
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
        """Create branch detail from topology node"""
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
        runbook_refs = {
            "mumbai-hub": ["RB-HUB-001", "RB-NOC-002"],
            "bangalore-branch": ["RB-BLR-001", "RB-ATM-003"],
            "chennai-branch": ["RB-MAA-001", "RB-MONSOON-001"],
            "dc-core": ["RB-DC-001", "RB-CORE-002"]
        }.get(node_id, ["RB-GENERIC-001"])
        
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
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    executive_summary: str
    network_health: Dict[str, Any]
    branch_performance: List[Dict[str, Any]]
    critical_issues: List[Dict[str, Any]]
    predictions: List[Dict[str, Any]]
    recommendations: List[str]
    evidence_sources: List[str]
    
    @classmethod
    def generate_report(cls, report_type: str) -> "ReportData":
        """Generate different types of reports"""
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
        """Generate executive summary report"""
        return cls(
            report_type="executive",
            title="Executive Network Status Report",
            executive_summary="Network operations are currently in DEGRADED state. Mumbai Hub is experiencing critical bandwidth utilization (78%) with predicted saturation in 2 hours. Bangalore Branch shows warning signs with elevated latency (82ms) on the primary MPLS route. Immediate attention required for Mumbai-Bangalore link to prevent service disruption to 8,456 daily transactions.",
            network_health={
                "overall_status": "DEGRADED",
                "health_score": 0.65,
                "uptime_percentage": 99.2,
                "sla_compliance": "at_risk"
            },
            branch_performance=[
                {
                    "branch": node["name"],
                    "status": node["status"],
                    "latency_ms": node["metrics"]["latency_ms"],
                    "availability": 99.5 if node["status"] == "NORMAL" else 97.2
                }
                for node in topology.nodes.values()
            ],
            critical_issues=[
                {
                    "issue": "Mumbai Hub bandwidth saturation",
                    "severity": "critical",
                    "eta_minutes": 120,
                    "affected_transactions": 15234
                },
                {
                    "issue": "Mumbai-Bangalore link degradation",
                    "severity": "high",
                    "eta_minutes": 180,
                    "affected_transactions": 8456
                }
            ],
            predictions=[
                {
                    "issue": "bandwidth_saturation",
                    "confidence": 0.85,
                    "eta_minutes": 120,
                    "branch": "mumbai-hub"
                },
                {
                    "issue": "link_degradation",
                    "confidence": 0.78,
                    "eta_minutes": 240,
                    "branch": "bangalore-branch"
                }
            ],
            recommendations=[
                "Implement immediate traffic prioritization at Mumbai Hub",
                "Prepare failover to alternate Mumbai-Chennai route for Bangalore traffic",
                "Schedule emergency bandwidth review",
                "Initiate preventive maintenance for Mumbai-Bangalore fiber route"
            ],
            evidence_sources=["RB-HUB-001", "RB-BLR-001", "INC-001", "INC-002", "Telemetry-2026-06-26"]
        )
    
    @classmethod
    def _branch_report(cls, topology: NetworkTopology) -> "ReportData":
        """Generate branch-wise performance report"""
        return cls(
            report_type="branch",
            title="Branch Performance Report",
            executive_summary="Detailed analysis of all branch locations shows varying performance levels. Bangalore Branch requires immediate attention due to elevated latency and connectivity issues affecting ATM operations.",
            network_health={
                "total_branches": 3,
                "healthy_branches": 1,
                "at_risk_branches": 2
            },
            branch_performance=[
                {
                    "branch": node["name"],
                    "location": node["location"],
                    "status": node["status"],
                    "latency_ms": node["metrics"]["latency_ms"],
                    "packet_loss_pct": node["metrics"]["packet_loss_pct"],
                    "utilization_pct": node["metrics"]["utilization_pct"],
                    "transactions_24h": 15000 if node["type"] == "HUB" else 8000 if node["id"] == "bangalore-branch" else 6000
                }
                for node in topology.nodes.values()
                if node["type"] == "BRANCH" or node["type"] == "HUB"
            ],
            critical_issues=[
                {
                    "issue": "Bangalore ATM connectivity",
                    "severity": "warning",
                    "success_rate": 94.5,
                    "baseline_rate": 99.2
                }
            ],
            predictions=[
                {
                    "issue": "Link degradation",
                    "confidence": 0.78,
                    "eta_minutes": 240,
                    "branch": "bangalore-branch"
                }
            ],
            recommendations=[
                "Schedule fiber inspection for Bangalore primary route",
                "Monitor ATM success rates closely",
                "Prepare branch contingency procedures"
            ],
            evidence_sources=["RB-BLR-001", "RB-ATM-003", "ATM-Telemetry-2026-06-26"]
        )
    
    @classmethod
    def _prediction_report(cls, topology: NetworkTopology) -> "ReportData":
        """Generate prediction readiness report"""
        predictions = []
        for node in topology.nodes.values():
            if node["prediction"]:
                predictions.append({
                    "entity": node["name"],
                    "issue": node["prediction"]["issue"],
                    "confidence": node["prediction"]["confidence"],
                    "eta_minutes": node["prediction"]["eta_minutes"],
                    "severity": node["prediction"]["severity"]
                })
        
        for edge in topology.edges:
            if edge["prediction"]:
                predictions.append({
                    "entity": f"{edge['source']} → {edge['target']}",
                    "issue": edge["prediction"]["issue"],
                    "confidence": edge["prediction"]["confidence"],
                    "eta_minutes": edge["prediction"]["eta_minutes"],
                    "severity": edge["prediction"]["severity"]
                })
        
        return cls(
            report_type="prediction",
            title="Network Prediction Report",
            executive_summary=f"AI prediction engine has identified {len(predictions)} potential issues requiring proactive attention. The highest confidence prediction (85%) indicates Mumbai Hub bandwidth saturation within 2 hours.",
            network_health={
                "prediction_count": len(predictions),
                "high_confidence_count": sum(1 for p in predictions if p["confidence"] > 0.7),
                "average_confidence": sum(p["confidence"] for p in predictions) / len(predictions) if predictions else 0
            },
            branch_performance=[],
            critical_issues=[
                {
                    "issue": p["issue"],
                    "severity": p["severity"],
                    "confidence": p["confidence"],
                    "eta_minutes": p["eta_minutes"]
                }
                for p in predictions if p["severity"] in ["high", "critical"]
            ],
            predictions=predictions,
            recommendations=[
                "Review prediction accuracy weekly",
                "Update prediction thresholds based on incident correlation",
                "Validate prediction lead times for continuous improvement"
            ],
            evidence_sources=["ML-Model-v1.0", "Training-Data-2026", "Validation-Scenarios"]
        )