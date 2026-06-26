from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any

import pandas as pd
import requests
import streamlit as st
import networkx as nx
import plotly.graph_objects as go
from plotly.subplots import make_subplots


API_URL = os.getenv("NOC_COPILOT_API", "http://127.0.0.1:8000")

st.set_page_config(
    page_title="TechCorp India Network Operations Center",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for Palantir-style interface
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        color: #ffffff;
    }
    .metric-card {
        background: #0f3460;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        border-left: 4px solid #e94560;
    }
    .problem-alert {
        background: #e94560;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    .prediction-card {
        background: #16213e;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        border-left: 4px solid #00ff88;
    }
    .search-container {
        position: relative;
    }
    .chat-message {
        background: #1a1a2e;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    .system-message {
        background: #0f3460;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        border-left: 4px solid #00d4ff;
    }
</style>
""", unsafe_allow_html=True)

# TechCorp India Network Topology Data
NETWORK_TOPOLOGY = {
    "nodes": {
        "mumbai-hub": {
            "name": "Mumbai Hub - NOC",
            "type": "HUB",
            "location": "Mumbai, Maharashtra",
            "coordinates": [19.0760, 72.8777],
            "status": "CRITICAL",
            "latency": 45,
            "packet_loss": 0.8,
            "bandwidth_util": 78,
            "transactions": 15234,
            "atms": 120,
            "issues": [
                "High bandwidth utilization during peak hours",
                "Occasional packet loss affecting inter-branch transfers"
            ],
            "predictions": [
                "Potential bandwidth saturation in 2-3 hours",
                "Risk of congestion during evening peak (6-8 PM)"
            ]
        },
        "bangalore-branch": {
            "name": "Bangalore Branch - Tech Hub",
            "type": "BRANCH",
            "location": "Bangalore, Karnataka",
            "coordinates": [12.9716, 77.5946],
            "status": "WARNING",
            "latency": 82,
            "packet_loss": 2.3,
            "bandwidth_util": 65,
            "transactions": 8456,
            "atms": 85,
            "issues": [
                "Elevated latency to Mumbai hub",
                "Intermittent connectivity issues with ATMs"
            ],
            "predictions": [
                "Likely fiber degradation on primary route",
                "Expected 40% latency increase during next 4 hours"
            ]
        },
        "chennai-branch": {
            "name": "Chennai Branch - South Ops",
            "type": "BRANCH",
            "location": "Chennai, Tamil Nadu",
            "coordinates": [13.0827, 80.2707],
            "status": "NORMAL",
            "latency": 56,
            "packet_loss": 0.5,
            "bandwidth_util": 45,
            "transactions": 6234,
            "atms": 72,
            "issues": [
                "Minor latency fluctuations during monsoon season"
            ],
            "predictions": [
                "Stable operations expected for next 24 hours",
                "Monitor weather-related disruptions"
            ]
        },
        "dc-core": {
            "name": "Data Center - Core Banking",
            "type": "DATACENTER",
            "location": "Mumbai Data Center",
            "coordinates": [19.0176, 72.8562],
            "status": "NORMAL",
            "latency": 12,
            "packet_loss": 0.1,
            "bandwidth_util": 52,
            "transactions": 28900,
            "atms": 0,
            "issues": [],
            "predictions": [
                "Optimal performance conditions",
                "Scheduled maintenance window in 48 hours"
            ]
        }
    },
    "links": [
        {
            "source": "mumbai-hub",
            "target": "bangalore-branch",
            "type": "MPLS_PRIMARY",
            "bandwidth": "1 Gbps",
            "status": "DEGRADED",
            "latency": 82,
            "utilization": 78
        },
        {
            "source": "mumbai-hub",
            "target": "chennai-branch",
            "type": "MPLS_ALTERNATE",
            "bandwidth": "1 Gbps",
            "status": "NORMAL",
            "latency": 56,
            "utilization": 45
        },
        {
            "source": "mumbai-hub",
            "target": "dc-core",
            "type": "CORE_LINK",
            "bandwidth": "10 Gbps",
            "status": "NORMAL",
            "latency": 12,
            "utilization": 52
        },
        {
            "source": "bangalore-branch",
            "target": "chennai-branch",
            "type": "INTER_BRANCH",
            "bandwidth": "500 Mbps",
            "status": "NORMAL",
            "latency": 35,
            "utilization": 30
        }
    ]
}

@st.cache_data
def load_demo_frame() -> pd.DataFrame:
    # Generate sample data for demonstration
    dates = pd.date_range(start=datetime.now() - timedelta(hours=24), periods=100, freq='15min')
    data = {
        'timestamp': dates,
        'interface_util_pct': [50 + i*0.3 + (i%10)*2 for i in range(100)],
        'latency_ms': [40 + (i%20)*3 + (i//50)*10 for i in range(100)],
        'packet_loss_pct': [0.1 + (i%15)*0.05 for i in range(100)]
    }
    return pd.DataFrame(data)

def api_get(path: str, params: dict | None = None) -> dict:
    """API call function - currently running in offline mode"""
    return {"status": "offline", "message": "Running in offline demonstration mode"}

def create_network_graph(topology: Dict) -> go.Figure:
    """Create an interactive network graph visualization"""
    try:
        G = nx.Graph()
        
        # Add nodes
        for node_id, node_data in topology["nodes"].items():
            G.add_node(node_id, **node_data)
        
        # Add edges
        for link in topology["links"]:
            G.add_edge(link["source"], link["target"], **link)
        
        # Calculate layout using coordinates
        pos = {}
        for node_id, node_data in topology["nodes"].items():
            pos[node_id] = node_data["coordinates"]
        
        # Create edge traces
        edge_x = []
        edge_y = []
        
        for edge in G.edges():
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            edge_x.extend([x0, x1, None])
            edge_y.extend([y0, y1, None])
        
        edge_trace = go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=3, color='#00d4ff'),
            hoverinfo='none',
            mode='lines'
        )
        
        # Create node traces
        node_x = []
        node_y = []
        node_text = []
        node_colors = []
        node_sizes = []
        
        for node_id, node_data in topology["nodes"].items():
            x, y = pos[node_id]
            node_x.append(x)
            node_y.append(y)
            
            status = node_data.get("status", "UNKNOWN")
            if status == "CRITICAL":
                color = "#e94560"
                size = 30
            elif status == "WARNING":
                color = "#ffa500"
                size = 25
            else:
                color = "#00ff88"
                size = 20
            
            node_colors.append(color)
            node_sizes.append(size)
            
            hover_text = f"<b>{node_data['name']}</b><br>Location: {node_data['location']}<br>Status: {status}<br>Latency: {node_data['latency']}ms<br>Transactions: {node_data['transactions']}"
            node_text.append(hover_text)
        
        node_trace = go.Scatter(
            x=node_x, y=node_y,
            mode='markers+text',
            hoverinfo='text',
            text=[topology["nodes"][nid]["name"].split("-")[0].strip() for nid in topology["nodes"].keys()],
            textposition="top center",
            hovertext=node_text,
            marker=dict(
                size=node_sizes,
                color=node_colors,
                line=dict(width=2, color='#ffffff')
            )
        )
        
        # Create figure
        fig = go.Figure(data=[edge_trace, node_trace],
                       layout=go.Layout(
                           title='<b>TechCorp India Network Topology - Real-time Status</b>',
                           titlefont=dict(size=20, color='#ffffff'),
                           showlegend=False,
                           hovermode='closest',
                           margin=dict(b=20, l=5, r=5, t=40),
                           paper_bgcolor='#1a1a2e',
                           plot_bgcolor='#16213e',
                           xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                           yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                           height=500
                       ))
        
        return fig
    except Exception as e:
        # Fallback simple chart if network graph fails
        fig = go.Figure()
        fig.add_annotation(text=f"Network graph error: {str(e)}", 
                         xref="paper", yref="paper",
                         x=0.5, y=0.5, showarrow=False)
        return fig

def display_branch_details(branch_id: str):
    """Display detailed information for a specific branch"""
    try:
        branch = NETWORK_TOPOLOGY["nodes"][branch_id]
        
        st.markdown(f"""
        <div class="main-header">
            <h2>{branch['name']}</h2>
            <p>{branch['location']} | Type: {branch['type']} | Status: {branch['status']}</p>
        </div>
        """, unsafe_allow_html=True)
        
        # Current Metrics
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Latency", f"{branch['latency']} ms", "±5ms from baseline")
        col2.metric("Packet Loss", f"{branch['packet_loss']}%", "Target: <1%")
        col3.metric("Bandwidth Util", f"{branch['bandwidth_util']}%", "Target: <70%")
        col4.metric("Transactions", f"{branch['transactions']}", "Last 24h")
        
        # Current Issues
        if branch['issues']:
            st.markdown("### 🔴 Current Issues")
            for issue in branch['issues']:
                st.markdown(f"""
                <div class="problem-alert">
                    <strong>⚠️ {issue}</strong>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.markdown("### ✅ No Current Issues")
            st.success("All systems operating within normal parameters")
        
        # AI Predictions
        st.markdown("### 🔮 AI Predictions & Recommendations")
        for prediction in branch['predictions']:
            st.markdown(f"""
            <div class="prediction-card">
                <strong>🤖 {prediction}</strong>
            </div>
            """, unsafe_allow_html=True)
        
        # Historical Data
        st.markdown("### 📊 Performance Trends")
        try:
            data = load_demo_frame()
            st.line_chart(data.set_index("timestamp")[["interface_util_pct", "latency_ms", "packet_loss_pct"]])
        except Exception as e:
            st.error(f"Unable to load performance data: {str(e)}")
            st.info("Using offline demonstration mode")
    except Exception as e:
        st.error(f"Error displaying branch details: {str(e)}")

def display_copilot_chat():
    """Display the offline copilot chat interface"""
    try:
        st.markdown("### 🤖 Offline NOC Copilot")
        
        # Chat history
        if 'chat_history' not in st.session_state:
            st.session_state.chat_history = []
        
        # Display chat history
        for message in st.session_state.chat_history:
            if message['role'] == 'user':
                st.markdown(f"""
                <div class="chat-message">
                    <strong>👤 You:</strong> {message['content']}
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class="system-message">
                    <strong>🤖 Copilot:</strong> {message['content']}
                </div>
                """, unsafe_allow_html=True)
        
        # Chat input
        user_input = st.text_input("Ask the NOC Copilot", key="copilot_input")
        
        col1, col2 = st.columns([1, 4])
        with col1:
            if st.button("Send") and user_input:
                st.session_state.chat_history.append({"role": "user", "content": user_input})
                
                # Generate response (offline mode)
                response = generate_offline_response(user_input)
                st.session_state.chat_history.append({"role": "assistant", "content": response})
                
                st.rerun()
        
        with col2:
            if st.button("Clear Chat"):
                st.session_state.chat_history = []
                st.rerun()
    except Exception as e:
        st.error(f"Error in copilot chat: {str(e)}")

def generate_offline_response(query: str) -> str:
    """Generate offline responses based on network topology"""
    query_lower = query.lower()
    
    responses = {
        'latency': "Current network analysis shows elevated latency on the Mumbai-Bangalore route (82ms vs 45ms baseline). This is likely due to fiber degradation on the primary MPLS link. Recommendation: Switch to alternate Mumbai-Chennai route for Bangalore traffic.",
        'bangalore': "Bangalore branch is currently in WARNING status. Key issues: elevated latency to Mumbai hub (82ms), intermittent ATM connectivity. AI prediction: 40% latency increase expected during next 4 hours. Immediate action: Monitor ATM transaction success rate.",
        'mumbai': "Mumbai Hub is operating at CRITICAL status with 78% bandwidth utilization. High transaction volume (15,234 in last 24h). Prediction: Potential bandwidth saturation in 2-3 hours during evening peak. Recommendation: Implement traffic prioritization for critical banking services.",
        'chennai': "Chennai branch operations are NORMAL. Minor latency fluctuations observed during monsoon season. Stable conditions expected for next 24 hours. No immediate action required.",
        'problem': "Current network problems identified: 1) Mumbai-Bangalore link degradation, 2) Mumbai hub bandwidth saturation risk, 3) Bangalore ATM connectivity issues. Priority attention: Mumbai-Bangalore route affecting 8,456 daily transactions.",
        'prediction': "AI predictions for next 6 hours: Mumbai hub bandwidth saturation (70% probability), Bangalore-Mumbai latency increase (85% probability), Chennai stable operations (95% probability). Recommended proactive actions implemented.",
        'atm': "ATM network status: Mumbai hub (120 ATMs) - Operational, Bangalore (85 ATMs) - Intermittent issues, Chennai (72 ATMs) - Normal. Bangalore ATM success rate dropped to 94.5% (baseline: 99.2%). Investigation in progress."
    }
    
    for keyword, response in responses.items():
        if keyword in query_lower:
            return response
    
    return f"I understand you're asking about '{query}'. Based on current network analysis, I recommend focusing on the Mumbai-Bangalore link degradation which is our highest priority issue affecting 8,456 daily transactions. Would you like specific details about any branch or network link?"

def display_reports():
    """Display comprehensive network reports"""
    try:
        st.markdown("### 📈 Network Performance Reports")
        
        # Overall network health
        st.markdown("#### Network Health Summary")
        
        total_nodes = len(NETWORK_TOPOLOGY["nodes"])
        critical_nodes = sum(1 for n in NETWORK_TOPOLOGY["nodes"].values() if n["status"] == "CRITICAL")
        warning_nodes = sum(1 for n in NETWORK_TOPOLOGY["nodes"].values() if n["status"] == "WARNING")
        normal_nodes = sum(1 for n in NETWORK_TOPOLOGY["nodes"].values() if n["status"] == "NORMAL")
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total Nodes", total_nodes)
        col2.metric("Critical", critical_nodes, delta_color="inverse")
        col3.metric("Warning", warning_nodes, delta_color="inverse")
        col4.metric("Normal", normal_nodes)
        
        # Link status
        st.markdown("#### Network Link Status")
        link_data = []
        for link in NETWORK_TOPOLOGY["links"]:
            link_data.append({
                "Source": link["source"],
                "Target": link["target"],
                "Type": link["type"],
                "Status": link["status"],
                "Latency (ms)": link["latency"],
                "Utilization (%)": link["utilization"]
            })
        
        st.dataframe(pd.DataFrame(link_data), use_container_width=True)
        
        # Branch-wise performance
        st.markdown("#### Branch Performance Details")
        branch_data = []
        for node_id, node in NETWORK_TOPOLOGY["nodes"].items():
            branch_data.append({
                "Branch": node["name"],
                "Location": node["location"],
                "Status": node["status"],
                "Latency (ms)": node["latency"],
                "Packet Loss (%)": node["packet_loss"],
                "Bandwidth Util (%)": node["bandwidth_util"],
                "Transactions (24h)": node["transactions"],
                "ATMs": node["atms"]
            })
        
        st.dataframe(pd.DataFrame(branch_data), use_container_width=True)
        
        # Historical trends
        st.markdown("#### 24-Hour Performance Trends")
        try:
            data = load_demo_frame()
            
            fig = make_subplots(rows=2, cols=2, 
                                subplot_titles=('Bandwidth Utilization', 'Latency', 'Packet Loss', 'Transaction Volume'))
            
            fig.add_trace(go.Scatter(x=data['timestamp'], y=data['interface_util_pct'], 
                                    mode='lines', name='Util %'), row=1, col=1)
            fig.add_trace(go.Scatter(x=data['timestamp'], y=data['latency_ms'], 
                                    mode='lines', name='Latency'), row=1, col=2)
            fig.add_trace(go.Scatter(x=data['timestamp'], y=data['packet_loss_pct'], 
                                    mode='lines', name='Loss %'), row=2, col=1)
            fig.add_trace(go.Scatter(x=data['timestamp'], y=data['interface_util_pct'] * 100, 
                                    mode='lines', name='Volume'), row=2, col=2)
            
            fig.update_layout(height=600, showlegend=False, 
                              paper_bgcolor='#1a1a2e', plot_bgcolor='#16213e',
                              font=dict(color='#ffffff'))
            
            st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.error(f"Unable to generate performance charts: {str(e)}")
            st.info("Displaying tabular data instead")
            
            # Show simple data table as fallback
            data = load_demo_frame()
            st.dataframe(data, use_container_width=True)
    except Exception as e:
        st.error(f"Error generating reports: {str(e)}")

# Main Application
def main():
    try:
        # Header
        st.markdown("""
        <div class="main-header">
            <h1>🏢 TechCorp India Network Operations Center</h1>
            <p>Air-Gapped Predictive NOC Copilot | Multi-State Network Management | Offline-First Architecture</p>
        </div>
        """, unsafe_allow_html=True)
        
        # Search functionality
        with st.expander("🔍 Search Network Knowledge Base", expanded=False):
            search_query = st.text_input("Search branches, issues, predictions, or ask questions")
            if search_query:
                st.markdown(f"""
                <div class="system-message">
                    <strong>Search Results for "{search_query}":</strong><br>
                    Based on the search query, you can ask the NOC Copilot for specific information.
                    Use the chat interface below for detailed responses.
                </div>
                """, unsafe_allow_html=True)
        
        # Navigation tabs
        tab1, tab2, tab3, tab4 = st.tabs(["🗺️ Network Map", "🏢 Branch Details", "🤖 NOC Copilot", "📊 Reports"])
        
        with tab1:
            st.markdown("### Real-time Network Topology")
            st.markdown("Click on any node to view detailed branch information")
            
            # Display network graph
            try:
                fig = create_network_graph(NETWORK_TOPOLOGY)
                st.plotly_chart(fig, use_container_width=True)
            except Exception as e:
                st.error(f"Error displaying network map: {str(e)}")
                st.info("Network topology data available in text format below")
                
                # Display text-based topology as fallback
                st.markdown("### Network Topology (Text Format)")
                for node_id, node in NETWORK_TOPOLOGY["nodes"].items():
                    st.markdown(f"**{node['name']}** - {node['location']} (Status: {node['status']})")
            
            # Overall status summary
            st.markdown("### 📡 Network Status Summary")
            col1, col2, col3, col4 = st.columns(4)
            
            total_latency = sum(n["latency"] for n in NETWORK_TOPOLOGY["nodes"].values()) / len(NETWORK_TOPOLOGY["nodes"])
            total_packet_loss = sum(n["packet_loss"] for n in NETWORK_TOPOLOGY["nodes"].values()) / len(NETWORK_TOPOLOGY["nodes"])
            total_transactions = sum(n["transactions"] for n in NETWORK_TOPOLOGY["nodes"].values())
            critical_issues = sum(1 for n in NETWORK_TOPOLOGY["nodes"].values() if n["status"] in ["CRITICAL", "WARNING"])
            
            col1.metric("Avg Latency", f"{total_latency:.1f} ms", "Target: <50ms")
            col2.metric("Avg Packet Loss", f"{total_packet_loss:.2f}%", "Target: <1%")
            col3.metric("Daily Transactions", f"{total_transactions:,}", "Across all branches")
            col4.metric("Active Issues", critical_issues, "Require attention")
            
            # Critical alerts
            if critical_issues > 0:
                st.markdown("### 🚨 Critical Network Alerts")
                for node_id, node in NETWORK_TOPOLOGY["nodes"].items():
                    if node["status"] in ["CRITICAL", "WARNING"]:
                        st.markdown(f"""
                        <div class="problem-alert">
                            <strong>{node['name']}</strong> - {node['status']}<br>
                            Location: {node['location']}<br>
                            Issues: {', '.join(node['issues'])}
                        </div>
                        """, unsafe_allow_html=True)
        
        with tab2:
            st.markdown("### Select Branch for Detailed Analysis")
            branch_options = {f"{node['name']} ({node['location']})": node_id 
                             for node_id, node in NETWORK_TOPOLOGY["nodes"].items()}
            selected_branch = st.selectbox("Choose Branch", list(branch_options.keys()))
            
            if selected_branch:
                branch_id = branch_options[selected_branch]
                display_branch_details(branch_id)
        
        with tab3:
            display_copilot_chat()
            
            # Quick action buttons
            st.markdown("### ⚡ Quick Actions")
            col1, col2, col3 = st.columns(3)
            
            with col1:
                if st.button("🔍 Analyze Current Issues"):
                    if 'chat_history' not in st.session_state:
                        st.session_state.chat_history = []
                    st.session_state.chat_history.append({"role": "user", "content": "What are the current network problems?"})
                    response = generate_offline_response("current problems")
                    st.session_state.chat_history.append({"role": "assistant", "content": response})
                    st.rerun()
            
            with col2:
                if st.button("🔮 Get Predictions"):
                    if 'chat_history' not in st.session_state:
                        st.session_state.chat_history = []
                    st.session_state.chat_history.append({"role": "user", "content": "What problems are predicted for the next few hours?"})
                    response = generate_offline_response("predictions")
                    st.session_state.chat_history.append({"role": "assistant", "content": response})
                    st.rerun()
            
            with col3:
                if st.button("📊 Status Report"):
                    if 'chat_history' not in st.session_state:
                        st.session_state.chat_history = []
                    st.session_state.chat_history.append({"role": "user", "content": "Generate a status report for all branches"})
                    response = generate_offline_response("status report")
                    st.session_state.chat_history.append({"role": "assistant", "content": response})
                    st.rerun()
        
        with tab4:
            display_reports()
        
        # Footer
        st.markdown("---")
        st.markdown("""
        <div style="text-align: center; color: #888;">
            <p>TechCorp India NOC Copilot v1.0 | Air-Gapped Architecture | RBI Compliant | Offline-First Design</p>
            <p>System Status: ✅ Operational | Data Freshness: Real-time | Last Update: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</p>
        </div>
        """, unsafe_allow_html=True)
    except Exception as e:
        st.error(f"Application error: {str(e)}")
        st.info("Please refresh the page or contact support if the error persists.")

if __name__ == "__main__":
    main()
