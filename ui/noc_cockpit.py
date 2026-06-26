from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

import requests
import streamlit as st
import networkx as nx
import plotly.graph_objects as go
from plotly.subplots import make_subplots


API_URL = os.getenv("NOC_COPILOT_API", "http://127.0.0.1:8000")

# Page configuration
st.set_page_config(
    page_title="TechCorp India NOC Cockpit",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for operator cockpit styling
st.markdown("""
<style>
    /* Global styles */
    .stApp {
        background-color: #0a0e14;
    }
    
    /* Header styles */
    .cockpit-header {
        background: linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%);
        padding: 1rem 1.5rem;
        border-bottom: 2px solid #30363d;
        color: #e6edf3;
        margin: -1rem -1rem 1rem -1rem;
    }
    
    .header-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #58a6ff;
        margin-bottom: 0.5rem;
    }
    
    .header-badges {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    
    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .badge-offline {
        background-color: #238636;
        color: #ffffff;
    }
    
    .badge-critical {
        background-color: #da3633;
        color: #ffffff;
    }
    
    .badge-warning {
        background-color: #d29922;
        color: #000000;
    }
    
    .badge-normal {
        background-color: #238636;
        color: #ffffff;
    }
    
    /* Navigation rail */
    .nav-rail {
        background-color: #0d1117;
        border-right: 1px solid #30363d;
        padding: 1rem;
    }
    
    /* Topology canvas */
    .topology-canvas {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 1rem;
        min-height: 500px;
    }
    
    /* Detail panel */
    .detail-panel {
        background-color: #0d1117;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 1rem;
        max-height: 600px;
        overflow-y: auto;
    }
    
    /* Metric cards */
    .metric-card {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-left: 4px solid #58a6ff;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 0.5rem;
    }
    
    .metric-card.critical {
        border-left-color: #da3633;
    }
    
    .metric-card.warning {
        border-left-color: #d29922;
    }
    
    .metric-card.normal {
        border-left-color: #238636;
    }
    
    /* Prediction card */
    .prediction-card {
        background-color: #1f2428;
        border: 1px solid #58a6ff;
        border-radius: 4px;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    
    /* Copilot panel */
    .copilot-panel {
        background-color: #0d1117;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 1rem;
    }
    
    .copilot-message {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 4px;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
    }
    
    .copilot-message.user {
        border-left: 3px solid #58a6ff;
    }
    
    .copilot-message.assistant {
        border-left: 3px solid #238636;
    }
    
    /* Bottom strip */
    .bottom-strip {
        background-color: #0d1117;
        border-top: 1px solid #30363d;
        padding: 0.75rem 1rem;
        margin: 1rem -1rem -1rem -1rem;
    }
    
    /* Utility classes */
    .text-critical { color: #da3633; font-weight: 600; }
    .text-warning { color: #d29922; font-weight: 600; }
    .text-normal { color: #238636; font-weight: 600; }
    .text-muted { color: #8b949e; }
    
    .section-header {
        color: #e6edf3;
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        border-bottom: 1px solid #30363d;
        padding-bottom: 0.5rem;
    }
</style>
""", unsafe_allow_html=True)


# API helper functions
def fetch_topology() -> Optional[Dict[str, Any]]:
    """Fetch network topology from API (with offline fallback)"""
    try:
        response = requests.get(f"{API_URL}/topology", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback - use embedded topology data
    from api.topology_models import NetworkTopology
    return NetworkTopology.generate_demo_topology().dict()


def fetch_summary() -> Optional[Dict[str, Any]]:
    """Fetch network summary from API (with offline fallback)"""
    try:
        response = requests.get(f"{API_URL}/summary", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback
    from api.topology_models import NetworkSummary
    return NetworkSummary.generate_demo_summary().dict()


def fetch_branches() -> Optional[Dict[str, Any]]:
    """Fetch branches list from API (with offline fallback)"""
    try:
        response = requests.get(f"{API_URL}/branches", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback
    topology = fetch_topology()
    if topology:
        branches = []
        for node_id, node_data in topology["nodes"].items():
            if node_data["type"] in ["BRANCH", "HUB", "DATACENTER"]:
                branches.append({
                    "id": node_id,
                    "name": node_data["name"],
                    "type": node_data["type"],
                    "location": node_data["location"],
                    "status": node_data["status"],
                    "latency_ms": node_data["metrics"]["latency_ms"],
                    "packet_loss_pct": node_data["metrics"]["packet_loss_pct"],
                    "utilization_pct": node_data["metrics"]["utilization_pct"],
                    "has_prediction": node_data["prediction"] is not None
                })
        return {"branches": branches}
    return None


def fetch_branch_detail(branch_id: str) -> Optional[Dict[str, Any]]:
    """Fetch detailed branch information from API (with offline fallback)"""
    try:
        response = requests.get(f"{API_URL}/branches/{branch_id}", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback
    from api.topology_models import NetworkTopology, BranchDetail
    topology = NetworkTopology.generate_demo_topology()
    if branch_id in topology.nodes:
        return BranchDetail.from_topology_node(topology, branch_id).dict()
    return None


def fetch_alerts(severity: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch alerts from API (with offline fallback)"""
    try:
        params = {"severity": severity} if severity else {}
        response = requests.get(f"{API_URL}/alerts", params=params, timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback
    topology = fetch_topology()
    if topology:
        alerts = []
        
        for node_id, node_data in topology["nodes"].items():
            if node_data["status"] in ["CRITICAL", "WARNING"]:
                alert_severity = "critical" if node_data["status"] == "CRITICAL" else "warning"
                if severity is None or alert_severity == severity.lower():
                    alerts.append({
                        "id": f"alert-{node_id}",
                        "entity_id": node_id,
                        "entity_name": node_data["name"],
                        "severity": alert_severity,
                        "type": "node_health",
                        "message": f"{node_data['name']} is in {node_data['status']} state",
                        "timestamp": "2026-06-26T14:00:00Z",
                        "metrics": node_data["metrics"],
                        "prediction": node_data["prediction"]
                    })
        
        for edge in topology["edges"]:
            if edge["status"] in ["DEGRADED", "CRITICAL"]:
                alert_severity = "critical" if edge["status"] == "CRITICAL" else "warning"
                if severity is None or alert_severity == severity.lower():
                    alerts.append({
                        "id": f"alert-{edge['id']}",
                        "entity_id": edge["id"],
                        "entity_name": f"{edge['source']} → {edge['target']}",
                        "severity": alert_severity,
                        "type": "link_health",
                        "message": f"Link {edge['source']} → {edge['target']} is {edge['status']}",
                        "timestamp": "2026-06-26T14:00:00Z",
                        "metrics": edge["metrics"],
                        "prediction": edge.get("prediction")
                    })
        
        return {"alerts": alerts}
    return None


def fetch_reports(report_type: str = "executive") -> Optional[Dict[str, Any]]:
    """Fetch reports from API (with offline fallback)"""
    try:
        response = requests.get(f"{API_URL}/reports", params={"report_type": report_type}, timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback
    from api.topology_models import ReportData
    return ReportData.generate_report(report_type).dict()


def copilot_query(question: str) -> Optional[Dict[str, Any]]:
    """Query the copilot API (with offline fallback)"""
    try:
        response = requests.get(f"{API_URL}/query", params={"q": question}, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    
    # Offline fallback - generate deterministic responses
    return generate_offline_copilot_response(question)


def generate_offline_copilot_response(question: str) -> Dict[str, Any]:
    """Generate offline copilot responses based on network state"""
    question_lower = question.lower()
    
    # Get current network state
    topology = fetch_topology()
    summary = fetch_summary()
    
    responses = {
        'latency': {
            "predicted_issue": "elevated_latency",
            "confidence": 0.85,
            "current_state": "Mumbai-Bangalore link showing 82ms latency vs 45ms baseline",
            "time_to_impact_minutes": 180,
            "severity": "high",
            "recommended_actions": [
                "Switch to alternate Mumbai-Chennai route for Bangalore traffic",
                "Investigate fiber quality on primary MPLS route",
                "Monitor transaction success rates"
            ],
            "evidence": [{"source": "topology", "title": "Current telemetry data"}],
            "narrative": "Elevated latency detected on Mumbai-Bangalore route. This matches patterns from prior congestion scenarios."
        },
        'bangalore': {
            "predicted_issue": "link_degradation",
            "confidence": 0.78,
            "current_state": "Bangalore branch at WARNING status with 82ms latency and 2.3% packet loss",
            "time_to_impact_minutes": 240,
            "severity": "medium",
            "recommended_actions": [
                "Schedule fiber inspection for Bangalore primary route",
                "Monitor ATM success rates (currently 94.5% vs 99.2% baseline)",
                "Prepare failover procedures"
            ],
            "evidence": [{"source": "RB-BLR-001", "title": "Bangalore Branch Runbook"}],
            "narrative": "Bangalore branch showing warning signs due to fiber degradation on primary MPLS route affecting 8,456 daily transactions."
        },
        'mumbai': {
            "predicted_issue": "bandwidth_saturation",
            "confidence": 0.85,
            "current_state": "Mumbai Hub at CRITICAL status with 78% bandwidth utilization",
            "time_to_impact_minutes": 120,
            "severity": "high",
            "recommended_actions": [
                "Implement traffic prioritization for critical banking services",
                "Evaluate bandwidth expansion",
                "Monitor alternate path availability"
            ],
            "evidence": [{"source": "RB-HUB-001", "title": "Mumbai Hub Runbook"}],
            "narrative": "Mumbai Hub experiencing critical bandwidth utilization with predicted saturation in 2 hours during peak evening hours."
        },
        'fail': {
            "predicted_issue": "bandwidth_saturation",
            "confidence": 0.85,
            "current_state": "Mumbai Hub bandwidth utilization at 78% with rising queue depth",
            "time_to_impact_minutes": 120,
            "severity": "high",
            "recommended_actions": [
                "Implement immediate traffic prioritization",
                "Prepare for Mumbai-Bangalore link congestion"
            ],
            "evidence": [{"source": "topology", "title": "Network telemetry"}],
            "narrative": "Mumbai Hub bandwidth saturation is the most likely failure point within the next 2 hours."
        }
    }
    
    # Find matching response
    for keyword, response in responses.items():
        if keyword in question_lower:
            return response
    
    # Default response
    return {
        "predicted_issue": "general_network_risk",
        "confidence": 0.65,
        "current_state": f"Network health: {summary['overall_health'] if summary else 'UNKNOWN'}",
        "time_to_impact_minutes": summary['eta_to_failure'] if summary else 60,
        "severity": "medium",
        "recommended_actions": [
            "Review topology for at-risk components",
            "Check alerts page for active issues",
            "Monitor high-risk branches"
        ],
        "evidence": [{"source": "topology", "title": "Network overview"}],
        "narrative": f"Based on current network analysis, {summary['most_critical_issue'] if summary else 'multiple issues'} require attention."
    }


# State management
if 'selected_node' not in st.session_state:
    st.session_state.selected_node = None
if 'selected_edge' not in st.session_state:
    st.session_state.selected_edge = None
if 'copilot_open' not in st.session_state:
    st.session_state.copilot_open = False
if 'copilot_history' not in st.session_state:
    st.session_state.copilot_history = []
if 'current_page' not in st.session_state:
    st.session_state.current_page = "topology"


# Header Component
def render_header(summary: Optional[Dict[str, Any]]):
    """Render the top header with status badges and critical info"""
    st.markdown("""
    <div class="cockpit-header">
        <div class="header-title">TechCorp India NOC Cockpit</div>
        <div class="header-badges">
    """, unsafe_allow_html=True)
    
    # Offline status badge
    st.markdown('<span class="status-badge badge-offline">● OFFLINE MODE</span>', unsafe_allow_html=True)
    
    if summary:
        # Network health badge
        health_color = "badge-critical" if summary["overall_health"] == "CRITICAL" else "badge-warning" if summary["overall_health"] == "DEGRADED" else "badge-normal"
        st.markdown(f'<span class="status-badge {health_color}">{summary["overall_health"]}</span>', unsafe_allow_html=True)
        
        # Critical issue badge
        if summary["most_critical_issue"]:
            st.markdown(f'<span class="status-badge badge-critical">⚠ CRITICAL: {summary["most_critical_issue"][:30]}...</span>', unsafe_allow_html=True)
        
        # Next failure ETA
        if summary["eta_to_failure"] > 0:
            st.markdown(f'<span class="status-badge badge-warning">⏱ ETA: {summary["eta_to_failure"]}min</span>', unsafe_allow_html=True)
    
    st.markdown("""
        </div>
    </div>
    """, unsafe_allow_html=True)


# Navigation Rail
def render_navigation():
    """Render the left navigation rail"""
    with st.sidebar:
        st.markdown("### Navigation")
        
        pages = [
            ("Topology", "topology"),
            ("Overview", "overview"),
            ("Branches", "branches"),
            ("Alerts", "alerts"),
            ("Predictions", "predictions"),
            ("Reports", "reports"),
            ("Copilot", "copilot"),
            ("Settings", "settings")
        ]
        
        for page_name, page_key in pages:
            if st.button(page_name, key=f"nav_{page_key}", use_container_width=True):
                st.session_state.current_page = page_key
                st.rerun()


# Topology Graph Component
def render_topology_graph(topology: Dict[str, Any]):
    """Render the interactive network topology graph"""
    if not topology:
        st.error("Unable to load topology data")
        return
    
    G = nx.Graph()
    
    # Add nodes with positions
    pos = {}
    for node_id, node_data in topology["nodes"].items():
        G.add_node(node_id, **node_data)
        # Use coordinates if available, otherwise use a layout
        if "coordinates" in node_data:
            pos[node_id] = node_data["coordinates"]
    
    # If no coordinates, use spring layout
    if not pos:
        pos = nx.spring_layout(G)
    
    # Add edges
    for edge in topology["edges"]:
        G.add_edge(edge["source"], edge["target"], **edge)
    
    # Create edge traces
    edge_x = []
    edge_y = []
    edge_colors = []
    edge_widths = []
    
    for edge in G.edges(data=True):
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        
        # Color based on status
        status = edge[2].get("status", "NORMAL")
        if status == "CRITICAL":
            edge_colors.append("#da3633")
            edge_widths.append(4)
        elif status == "DEGRADED":
            edge_colors.append("#d29922")
            edge_widths.append(3)
        else:
            edge_colors.append("#238636")
            edge_widths.append(2)
    
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        line=dict(width=3, color='#30363d'),
        hoverinfo='none',
        mode='lines'
    )
    
    # Create individual edge traces for different colors
    for i, edge in enumerate(G.edges(data=True)):
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        status = edge[2].get("status", "NORMAL")
        
        color = "#da3633" if status == "CRITICAL" else "#d29922" if status == "DEGRADED" else "#238636"
        width = 4 if status == "CRITICAL" else 3 if status == "DEGRADED" else 2
        
        edge_trace_single = go.Scatter(
            x=[x0, x1],
            y=[y0, y1],
            line=dict(width=width, color=color),
            hoverinfo='text',
            mode='lines',
            hovertext=f"<b>{edge[2].get('type', 'Link')}</b><br>Status: {status}<br>Latency: {edge[2].get('metrics', {}).get('latency_ms', 'N/A')}ms<br>Utilization: {edge[2].get('metrics', {}).get('utilization_pct', 'N/A')}%",
            customdata=[edge[2].get("id", "")]
        )
    
    # Create node traces
    node_x = []
    node_y = []
    node_text = []
    node_colors = []
    node_sizes = []
    node_hovertext = []
    
    for node_id, node_data in topology["nodes"].items():
        x, y = pos[node_id]
        node_x.append(x)
        node_y.append(y)
        
        status = node_data.get("status", "UNKNOWN")
        if status == "CRITICAL":
            color = "#da3633"
            size = 35
        elif status == "WARNING":
            color = "#d29922"
            size = 30
        else:
            color = "#238636"
            size = 25
        
        node_colors.append(color)
        node_sizes.append(size)
        
        # Short name for display
        short_name = node_data["name"].split("-")[0].strip()
        node_text.append(short_name)
        
        # Detailed hover info
        metrics = node_data.get("metrics", {})
        hover_text = f"<b>{node_data['name']}</b><br>"
        hover_text += f"Location: {node_data['location']}<br>"
        hover_text += f"Status: {status}<br>"
        hover_text += f"Latency: {metrics.get('latency_ms', 'N/A')}ms<br>"
        hover_text += f"Packet Loss: {metrics.get('packet_loss_pct', 'N/A')}%<br>"
        hover_text += f"Utilization: {metrics.get('utilization_pct', 'N/A')}%"
        
        if node_data.get("prediction"):
            pred = node_data["prediction"]
            hover_text += f"<br><b>Prediction:</b> {pred['issue']} ({pred['confidence']:.0%} confidence)"
        
        node_hovertext.append(hover_text)
    
    node_trace = go.Scatter(
        x=node_x, y=node_y,
        mode='markers+text',
        hoverinfo='text',
        text=node_text,
        textposition="top center",
        textfont=dict(size=11, color="#e6edf3"),
        hovertext=node_hovertext,
        marker=dict(
            size=node_sizes,
            color=node_colors,
            line=dict(width=2, color='#0d1117')
        ),
        customdata=list(topology["nodes"].keys())
    )
    
    # Create figure
    fig = go.Figure(data=[edge_trace, node_trace],
                   layout=go.Layout(
                       title='<b>Network Topology - Real-time Status</b>',
                       titlefont=dict(size=18, color='#e6edf3'),
                       showlegend=False,
                       hovermode='closest',
                       margin=dict(b=20, l=20, r=20, t=50),
                       paper_bgcolor='#161b22',
                       plot_bgcolor='#161b22',
                       xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                       yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                       height=600,
                       clickmode='event+select'
                   ))
    
    # Display graph
    graph_container = st.container()
    with graph_container:
        st.plotly_chart(fig, use_container_width=True, key="topology_graph")
    
    return fig


# Detail Panel Component
def render_detail_panel():
    """Render the right detail panel based on selection"""
    st.markdown('<div class="detail-panel">', unsafe_allow_html=True)
    
    if st.session_state.selected_node:
        render_node_detail(st.session_state.selected_node)
    elif st.session_state.selected_edge:
        render_edge_detail(st.session_state.selected_edge)
    else:
        st.markdown("""
        <div class="section-header">Entity Details</div>
        <p class="text-muted">Select a node or edge from the topology to view detailed information.</p>
        """, unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)


def render_node_detail(node_id: str):
    """Render detailed information for a selected node"""
    topology = fetch_topology()
    if not topology or node_id not in topology["nodes"]:
        st.error(f"Node {node_id} not found")
        return
    
    node = topology["nodes"][node_id]
    
    # Node header
    status_color = "text-critical" if node["status"] == "CRITICAL" else "text-warning" if node["status"] == "WARNING" else "text-normal"
    st.markdown(f"""
    <div class="section-header">
        {node['name']} 
        <span class="{status_color}">[{node['status']}]</span>
    </div>
    """, unsafe_allow_html=True)
    
    # Basic info
    st.markdown(f"**Location:** {node['location']}")
    st.markdown(f"**Type:** {node['type']}")
    
    # Current metrics
    st.markdown("### Current Metrics")
    metrics = node["metrics"]
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Latency", f"{metrics['latency_ms']} ms")
        st.metric("Packet Loss", f"{metrics['packet_loss_pct']}%")
    with col2:
        st.metric("Utilization", f"{metrics['utilization_pct']}%")
        st.metric("Jitter", f"{metrics['jitter_ms']} ms")
    
    # Connected services
    if node.get("connected_services"):
        st.markdown("### Connected Services")
        for service in node["connected_services"]:
            st.markdown(f"- {service}")
    
    # Prediction
    if node.get("prediction"):
        st.markdown("### AI Prediction")
        pred = node["prediction"]
        
        severity_color = "text-critical" if pred["severity"] == "high" else "text-warning" if pred["severity"] == "medium" else "text-normal"
        
        st.markdown(f"""
        <div class="prediction-card">
            <strong>Issue:</strong> {pred['issue']}<br>
            <strong>Confidence:</strong> {pred['confidence']:.0%}<br>
            <strong>ETA:</strong> {pred['eta_minutes']} minutes<br>
            <strong class="{severity_color}">Severity:</strong> {pred['severity']}<br>
            <strong>Reasoning:</strong> {pred['reasoning']}
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("**Recommended Actions:**")
        for action in pred["recommended_actions"]:
            st.markdown(f"- {action}")
    
    # Incidents
    if node.get("incidents"):
        st.markdown("### Recent Incidents")
        for incident in node["incidents"]:
            st.markdown(f"- **{incident['id']}** ({incident['type']}): {incident['status']}")


def render_edge_detail(edge_id: str):
    """Render detailed information for a selected edge"""
    topology = fetch_topology()
    if not topology:
        st.error("Unable to load topology")
        return
    
    edge = next((e for e in topology["edges"] if e["id"] == edge_id), None)
    if not edge:
        st.error(f"Edge {edge_id} not found")
        return
    
    # Edge header
    status_color = "text-critical" if edge["status"] == "CRITICAL" else "text-warning" if edge["status"] == "DEGRADED" else "text-normal"
    st.markdown(f"""
    <div class="section-header">
        {edge['source']} → {edge['target']}
        <span class="{status_color}">[{edge['status']}]</span>
    </div>
    """, unsafe_allow_html=True)
    
    # Basic info
    st.markdown(f"**Type:** {edge['type']}")
    st.markdown(f"**Bandwidth:** {edge['bandwidth']}")
    
    # Current metrics
    st.markdown("### Current Metrics")
    metrics = edge["metrics"]
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Latency", f"{metrics['latency_ms']} ms")
        st.metric("Utilization", f"{metrics['utilization_pct']}%")
    with col2:
        st.metric("Jitter", f"{metrics['jitter_ms']} ms")
        st.metric("Packet Loss", f"{metrics['packet_loss_pct']}%")
    
    # Prediction
    if edge.get("prediction"):
        st.markdown("### AI Prediction")
        pred = edge["prediction"]
        
        severity_color = "text-critical" if pred["severity"] == "high" else "text-warning" if pred["severity"] == "medium" else "text-normal"
        
        st.markdown(f"""
        <div class="prediction-card">
            <strong>Issue:</strong> {pred['issue']}<br>
            <strong>Confidence:</strong> {pred['confidence']:.0%}<br>
            <strong>ETA:</strong> {pred['eta_minutes']} minutes<br>
            <strong class="{severity_color}">Severity:</strong> {pred['severity']}<br>
            <strong>Reasoning:</strong> {pred['reasoning']}
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("**Recommended Actions:**")
        for action in pred["recommended_actions"]:
            st.markdown(f"- {action}")


# Bottom Strip Component
def render_bottom_strip(summary: Optional[Dict[str, Any]]):
    """Render the bottom event/metrics strip"""
    st.markdown('<div class="bottom-strip">', unsafe_allow_html=True)
    
    col1, col2, col3, col4 = st.columns(4)
    
    if summary:
        with col1:
            st.markdown("**Network Health**")
            health_color = "text-critical" if summary["overall_health"] == "CRITICAL" else "text-warning" if summary["overall_health"] == "DEGRADED" else "text-normal"
            st.markdown(f'<span class="{health_color}">{summary["overall_health"]}</span>', unsafe_allow_html=True)
        
        with col2:
            st.markdown("**Alerts**")
            st.markdown(f"🔴 Critical: {summary['alert_count']['critical']}")
            st.markdown(f"🟡 Warning: {summary['alert_count']['warning']}")
        
        with col3:
            st.markdown("**Next Failure**")
            if summary["eta_to_failure"] > 0:
                st.markdown(f"⏱ {summary['eta_to_failure']} minutes")
                st.markdown(f"📊 {summary['confidence']:.0%} confidence")
            else:
                st.markdown("No immediate failures predicted")
        
        with col4:
            st.markdown("**At-Risk Branch**")
            st.markdown(f"⚠️ {summary['most_at_risk_branch']}")
    
    st.markdown('</div>', unsafe_allow_html=True)


# Copilot Panel Component
def render_copilot_panel():
    """Render the expandable copilot panel"""
    if not st.session_state.copilot_open:
        return
    
    st.markdown('<div class="copilot-panel">', unsafe_allow_html=True)
    
    st.markdown("### 🤖 NOC Copilot")
    
    # Suggested prompts
    st.markdown("**Suggested Questions:**")
    suggested_prompts = [
        "What is likely to fail next?",
        "Why is Bangalore branch at risk?",
        "Show high-risk tunnels",
        "Which branch is closest to SLA breach?",
        "Summarize current network state"
    ]
    
    for prompt in suggested_prompts:
        if st.button(prompt, key=f"suggest_{prompt}", use_container_width=True):
            handle_copilot_query(prompt)
    
    # Chat history
    st.markdown("**Conversation:**")
    for msg in st.session_state.copilot_history:
        role_class = "user" if msg["role"] == "user" else "assistant"
        st.markdown(f"""
        <div class="copilot-message {role_class}">
            <strong>{msg['role'].title()}:</strong> {msg['content']}
        </div>
        """, unsafe_allow_html=True)
    
    # Input
    user_input = st.text_input("Ask the NOC Copilot", key="copilot_input")
    
    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("Send", key="copilot_send") and user_input:
            handle_copilot_query(user_input)
    
    with col2:
        if st.button("Clear", key="copilot_clear"):
            st.session_state.copilot_history = []
            st.rerun()
    
    st.markdown('</div>', unsafe_allow_html=True)


def handle_copilot_query(question: str):
    """Handle a copilot query"""
    st.session_state.copilot_history.append({"role": "user", "content": question})
    
    response = copilot_query(question)
    if response:
        copilot_response = response.get("response", {})
        if isinstance(copilot_response, dict):
            # Format structured response
            formatted = format_copilot_response(copilot_response)
            st.session_state.copilot_history.append({"role": "assistant", "content": formatted})
        else:
            st.session_state.copilot_history.append({"role": "assistant", "content": str(copilot_response)})
    else:
        st.session_state.copilot_history.append({"role": "assistant", "content": "Sorry, I'm unable to process your query right now."})
    
    st.rerun()


def format_copilot_response(response: Dict[str, Any]) -> str:
    """Format copilot response for display"""
    formatted = []
    
    if response.get("predicted_issue"):
        formatted.append(f"**Predicted Issue:** {response['predicted_issue']}")
    
    if response.get("current_state"):
        formatted.append(f"**Current State:** {response['current_state']}")
    
    if response.get("confidence"):
        formatted.append(f"**Confidence:** {response['confidence']:.0%}")
    
    if response.get("time_to_impact_minutes"):
        formatted.append(f"**Time to Impact:** {response['time_to_impact_minutes']} minutes")
    
    if response.get("recommended_actions"):
        formatted.append("**Recommended Actions:**")
        for action in response["recommended_actions"]:
            formatted.append(f"- {action}")
    
    if response.get("evidence"):
        formatted.append("**Evidence Sources:**")
        for evidence in response["evidence"]:
            formatted.append(f"- {evidence.get('source', 'Unknown')}: {evidence.get('title', 'No title')}")
    
    if response.get("narrative"):
        formatted.append(f"**Summary:** {response['narrative']}")
    
    return "\n\n".join(formatted)


# Branches Page
def render_branches_page():
    """Render the branches listing page"""
    st.markdown('<div class="section-header">Branch Overview</div>', unsafe_allow_html=True)
    
    branches_data = fetch_branches()
    if not branches_data:
        st.error("Unable to load branches data")
        return
    
    branches = branches_data["branches"]
    
    # Branch cards
    for branch in branches:
        status_color = "text-critical" if branch["status"] == "CRITICAL" else "text-warning" if branch["status"] == "WARNING" else "text-normal"
        
        st.markdown(f"""
        <div class="metric-card {'critical' if branch['status'] == 'CRITICAL' else 'warning' if branch['status'] == 'WARNING' else 'normal'}">
            <strong>{branch['name']}</strong> 
            <span class="{status_color}">[{branch['status']}]</span><br>
            <span class="text-muted">{branch['location']}</span><br>
            Latency: {branch['latency_ms']}ms | Loss: {branch['packet_loss_pct']}% | Util: {branch['utilization_pct']}%
        </div>
        """, unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("View Details", key=f"detail_{branch['id']}"):
                st.session_state.selected_node = branch['id']
                st.session_state.current_page = "topology"
                st.rerun()
        
        with col2:
            if branch["has_prediction"]:
                st.markdown("🔮 **Prediction Available**")


# Alerts Page
def render_alerts_page():
    """Render the alerts page"""
    st.markdown('<div class="section-header">Active Alerts</div>', unsafe_allow_html=True)
    
    # Severity filter
    severity_filter = st.selectbox("Filter by Severity", ["All", "Critical", "Warning"])
    severity_param = None if severity_filter == "All" else severity_filter.lower()
    
    alerts_data = fetch_alerts(severity_param)
    if not alerts_data:
        st.error("Unable to load alerts data")
        return
    
    alerts = alerts_data["alerts"]
    
    if not alerts:
        st.info("No alerts matching the current filter")
        return
    
    for alert in alerts:
        severity_color = "text-critical" if alert["severity"] == "critical" else "text-warning"
        
        st.markdown(f"""
        <div class="metric-card {'critical' if alert['severity'] == 'critical' else 'warning'}">
            <strong>{alert['entity_name']}</strong>
            <span class="{severity_color}">[{alert['severity'].upper()}]</span><br>
            {alert['message']}<br>
            <span class="text-muted">{alert['timestamp']}</span>
        </div>
        """, unsafe_allow_html=True)
        
        # Show metrics
        metrics = alert.get("metrics", {})
        col1, col2, col3 = st.columns(3)
        with col1:
            if "latency_ms" in metrics:
                st.metric("Latency", f"{metrics['latency_ms']} ms")
        with col2:
            if "utilization_pct" in metrics:
                st.metric("Utilization", f"{metrics['utilization_pct']}%")
        with col3:
            if "packet_loss_pct" in metrics:
                st.metric("Packet Loss", f"{metrics['packet_loss_pct']}%")
        
        # Show prediction if available
        if alert.get("prediction"):
            pred = alert["prediction"]
            st.markdown(f"🔮 **Prediction:** {pred['issue']} ({pred['confidence']:.0%} confidence, ETA: {pred['eta_minutes']}min)")


# Reports Page
def render_reports_page():
    """Render the reports page"""
    st.markdown('<div class="section-header">Network Reports</div>', unsafe_allow_html=True)
    
    report_type = st.selectbox("Report Type", ["Executive Summary", "Branch Performance", "Prediction Analysis"])
    report_key = {"Executive Summary": "executive", "Branch Performance": "branch", "Prediction Analysis": "prediction"}[report_type]
    
    report_data = fetch_reports(report_key)
    if not report_data:
        st.error("Unable to load report data")
        return
    
    # Report header
    st.markdown(f"### {report_data['title']}")
    st.markdown(f"*Generated: {report_data['generated_at']}*")
    
    # Executive summary
    st.markdown("#### Executive Summary")
    st.markdown(report_data['executive_summary'])
    
    # Network health
    st.markdown("#### Network Health")
    health = report_data['network_health']
    for key, value in health.items():
        st.markdown(f"**{key.replace('_', ' ').title()}:** {value}")
    
    # Branch performance
    if report_data.get('branch_performance'):
        st.markdown("#### Branch Performance")
        for branch in report_data['branch_performance']:
            st.markdown(f"- **{branch['branch']}**: {branch['status']} (Latency: {branch['latency_ms']}ms)")
    
    # Critical issues
    if report_data.get('critical_issues'):
        st.markdown("#### Critical Issues")
        for issue in report_data['critical_issues']:
            st.markdown(f"- **{issue['issue']}** (Severity: {issue['severity']}, ETA: {issue['eta_minutes']}min)")
    
    # Predictions
    if report_data.get('predictions'):
        st.markdown("#### Predictions")
        for pred in report_data['predictions']:
            st.markdown(f"- **{pred['entity']}**: {pred['issue']} ({pred['confidence']:.0%} confidence)")
    
    # Recommendations
    st.markdown("#### Recommendations")
    for i, rec in enumerate(report_data['recommendations'], 1):
        st.markdown(f"{i}. {rec}")
    
    # Evidence sources
    st.markdown("#### Evidence Sources")
    st.markdown(", ".join(report_data['evidence_sources']))


# Overview Page
def render_overview_page():
    """Render the overview page with shift summary"""
    st.markdown('<div class="section-header">Shift Overview</div>', unsafe_allow_html=True)
    
    summary = fetch_summary()
    if not summary:
        st.error("Unable to load summary data")
        return
    
    # Global risk summary
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("### Network Health")
        health_color = "🔴" if summary["overall_health"] == "CRITICAL" else "🟡" if summary["overall_health"] == "DEGRADED" else "🟢"
        st.markdown(f"{health_color} **{summary['overall_health']}**")
        st.markdown(f"Nodes: {summary['total_nodes']}")
        st.markdown(f"Critical: {summary['critical_nodes']}")
        st.markdown(f"Warning: {summary['warning_nodes']}")
    
    with col2:
        st.markdown("### Most Critical Issue")
        st.markdown(f"⚠️ **{summary['most_critical_issue']}**")
        st.markdown(f"ETA: {summary['eta_to_failure']} minutes")
        st.markdown(f"Confidence: {summary['confidence']:.0%}")
    
    with col3:
        st.markdown("### At-Risk Branch")
        st.markdown(f"🏢 **{summary['most_at_risk_branch']}**")
        st.markdown(f"Next Failure: {summary['next_likely_failure']}")
    
    # Compact topology preview
    st.markdown("### Topology Preview")
    topology = fetch_topology()
    if topology:
        render_topology_graph(topology)
    
    # Recent alerts summary
    st.markdown("### Recent Alerts")
    alerts_data = fetch_alerts()
    if alerts_data and alerts_data["alerts"]:
        for alert in alerts_data["alerts"][:5]:  # Show first 5
            severity_icon = "🔴" if alert["severity"] == "critical" else "🟡"
            st.markdown(f"{severity_icon} **{alert['entity_name']}**: {alert['message']}")


# Main Application
def main():
    # Render header
    summary = fetch_summary()
    render_header(summary)
    
    # Render navigation
    render_navigation()
    
    # Main content area
    if st.session_state.current_page == "topology":
        # Topology page with graph as main surface
        st.markdown('<div class="section-header">Network Topology</div>', unsafe_allow_html=True)
        
        # Main layout: topology canvas + detail panel
        col1, col2 = st.columns([3, 1])
        
        with col1:
            topology = fetch_topology()
            if topology:
                render_topology_graph(topology)
        
        with col2:
            render_detail_panel()
        
        # Bottom strip
        render_bottom_strip(summary)
        
        # Floating copilot button
        if st.button("🤖 Ask Copilot", key="copilot_toggle"):
            st.session_state.copilot_open = not st.session_state.copilot_open
            st.rerun()
        
        # Copilot panel
        render_copilot_panel()
    
    elif st.session_state.current_page == "overview":
        render_overview_page()
    
    elif st.session_state.current_page == "branches":
        render_branches_page()
    
    elif st.session_state.current_page == "alerts":
        render_alerts_page()
    
    elif st.session_state.current_page == "predictions":
        st.markdown('<div class="section-header">AI Predictions</div>', unsafe_allow_html=True)
        topology = fetch_topology()
        if topology:
            predictions = []
            for node_id, node_data in topology["nodes"].items():
                if node_data.get("prediction"):
                    predictions.append({
                        "entity": node_data["name"],
                        "type": "node",
                        "prediction": node_data["prediction"]
                    })
            
            for edge in topology["edges"]:
                if edge.get("prediction"):
                    predictions.append({
                        "entity": f"{edge['source']} → {edge['target']}",
                        "type": "edge",
                        "prediction": edge["prediction"]
                    })
            
            if predictions:
                for pred in predictions:
                    severity_color = "text-critical" if pred["prediction"]["severity"] == "high" else "text-warning"
                    st.markdown(f"""
                    <div class="prediction-card">
                        <strong>{pred['entity']}</strong> ({pred['type']})<br>
                        <strong>Issue:</strong> {pred['prediction']['issue']}<br>
                        <strong>Confidence:</strong> {pred['prediction']['confidence']:.0%}<br>
                        <strong>ETA:</strong> {pred['prediction']['eta_minutes']} minutes<br>
                        <strong class="{severity_color}">Severity:</strong> {pred['prediction']['severity']}
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.info("No active predictions")
    
    elif st.session_state.current_page == "reports":
        render_reports_page()
    
    elif st.session_state.current_page == "copilot":
        st.markdown('<div class="section-header">NOC Copilot</div>', unsafe_allow_html=True)
        st.session_state.copilot_open = True
        render_copilot_panel()
    
    elif st.session_state.current_page == "settings":
        st.markdown('<div class="section-header">Settings</div>', unsafe_allow_html=True)
        st.markdown("### API Configuration")
        api_url = st.text_input("API URL", value=API_URL)
        st.markdown("### Display Settings")
        theme = st.selectbox("Theme", ["Dark (Default)", "Light"])
        st.markdown("### Offline Mode")
        st.markdown("✅ Application is running in offline-first mode")


if __name__ == "__main__":
    main()