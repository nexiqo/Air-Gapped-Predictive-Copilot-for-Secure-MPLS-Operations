import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './TopologyCanvas.css';

function TopologyCanvas({ onNodeSelect, onEdgeSelect, selectedNode, selectedEdge }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [topologyData, setTopologyData] = useState(null);

  useEffect(() => {
    fetchTopology();
  }, []);

  const fetchTopology = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/topology');
      if (response.ok) {
        const data = await response.json();
        setTopologyData(data);
        transformToReactFlow(data);
      }
    } catch (error) {
      console.error('Failed to fetch topology:', error);
      // Use fallback data
      const fallbackData = getFallbackTopology();
      setTopologyData(fallbackData);
      transformToReactFlow(fallbackData);
    }
  };

  const transformToReactFlow = (topology) => {
    const flowNodes = Object.entries(topology.nodes).map(([id, node]) => {
      const status = node.status || 'NORMAL';
      let borderColor = '#238636'; // normal - green
      let backgroundColor = '#161b22';
      if (status === 'CRITICAL') {
        borderColor = '#da3633'; // critical - red
        backgroundColor = '#1a1515';
      }
      if (status === 'WARNING') {
        borderColor = '#d29922'; // warning - yellow
        backgroundColor = '#1a1812';
      }

      // Calculate position based on type for better layout
      let position = { x: 0, y: 0 };
      if (node.type === 'HUB') {
        position = { x: 400, y: 300 }; // Center
      } else if (node.type === 'DATACENTER') {
        position = { x: 400, y: 100 }; // Top center
      } else if (node.type === 'BRANCH') {
        // Position branches around the hub
        const branchPositions = {
          'bangalore-branch': { x: 200, y: 400 },
          'chennai-branch': { x: 600, y: 400 },
        };
        position = branchPositions[id] || { x: Math.random() * 800, y: Math.random() * 600 };
      } else {
        position = { 
          x: node.coordinates?.[1] * 100 || Math.random() * 500, 
          y: node.coordinates?.[0] * 100 || Math.random() * 500 
        };
      }

      return {
        id,
        type: 'default',
        position,
        data: {
          label: (
            <div className="node-label">
              <div className="node-header">
                <div className="node-type">{node.type}</div>
                <div className="node-status" style={{ color: borderColor }}>
                  {status}
                </div>
              </div>
              <div className="node-name">{node.name.split('-')[0].trim()}</div>
              <div className="node-metrics">
                <div className="metric-row">
                  <span className="metric-label">Latency:</span>
                  <span className="metric-value">{node.metrics.latency_ms}ms</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Loss:</span>
                  <span className="metric-value">{node.metrics.packet_loss_pct}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Util:</span>
                  <span className="metric-value">{node.metrics.utilization_pct}%</span>
                </div>
              </div>
              {node.prediction && (
                <div className="node-prediction">
                  <span className="prediction-icon">⚠️</span>
                  <span className="prediction-text">{node.prediction.issue}</span>
                  <span className="prediction-eta">{node.prediction.eta_minutes}m</span>
                </div>
              )}
            </div>
          ),
          ...node
        },
        style: {
          border: `3px solid ${borderColor}`,
          borderRadius: '12px',
          backgroundColor: backgroundColor,
          color: '#e6edf3',
          width: 200,
          height: 'auto',
          minHeight: 140,
          boxShadow: status === 'CRITICAL' ? '0 0 20px rgba(218, 54, 51, 0.5)' : 'none',
        },
        className: `topology-node node-${status.toLowerCase()}`,
      };
    });

    const flowEdges = topology.edges.map((edge) => {
      const status = edge.status || 'NORMAL';
      let strokeColor = '#238636';
      let strokeWidth = 2;
      let animated = false;
      
      if (status === 'CRITICAL') {
        strokeColor = '#da3633';
        strokeWidth = 4;
        animated = true;
      } else if (status === 'DEGRADED') {
        strokeColor = '#d29922';
        strokeWidth = 3;
        animated = true;
      }

      const metrics = edge.metrics || {};
      const prediction = edge.prediction;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated,
        style: {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 20,
          height: 20,
        },
        label: (
          <div className="edge-label">
            <div className="edge-type">{edge.type}</div>
            <div className="edge-metrics">
              <span>L: {metrics.latency_ms || 'N/A'}ms</span>
              <span>U: {metrics.utilization_pct || 'N/A'}%</span>
            </div>
            {prediction && (
              <div className="edge-prediction">
                ⚠️ {prediction.eta_minutes}m
              </div>
            )}
          </div>
        ),
        labelStyle: {
          fill: '#e6edf3',
          fontSize: 11,
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: '#0d1117',
          fillOpacity: 0.95,
          borderRadius: '4px',
          padding: '4px 8px',
        },
        data: { ...edge },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClickHandler = useCallback((event, node) => {
    onNodeSelect?.(node);
    
    // Highlight connected edges
    const connectedEdges = edges.filter(edge => 
      edge.source === node.id || edge.target === node.id
    );
    
    setEdges(prevEdges => 
      prevEdges.map(edge => {
        const isConnected = connectedEdges.some(ce => ce.id === edge.id);
        return {
          ...edge,
          className: isConnected ? 'highlighted' : ''
        };
      })
    );
  }, [onNodeSelect, edges]);

  const onEdgeClickHandler = useCallback((event, edge) => {
    onEdgeSelect?.(edge);
  }, [onEdgeSelect]);

  if (!nodes.length) {
    return (
      <div className="topology-loading">
        <div className="loading-spinner"></div>
        <p>Loading network topology...</p>
      </div>
    );
  }

  return (
    <div className="topology-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onEdgeClick={onEdgeClickHandler}
        fitView
        className="react-flow"
      >
        <Background color="#30363d" gap={16} />
        <Controls 
          className="controls"
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
          }}
        />
        <MiniMap 
          className="minimap"
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
          }}
          nodeColor={(node) => {
            if (node.className?.includes('critical')) return '#da3633';
            if (node.className?.includes('warning')) return '#d29922';
            return '#238636';
          }}
        />
      </ReactFlow>
    </div>
  );
}

function getFallbackTopology() {
  return {
    nodes: {
      "mumbai-hub": {
        id: "mumbai-hub",
        name: "Mumbai Hub - NOC",
        type: "HUB",
        location: "Mumbai, Maharashtra",
        coordinates: [19.0760, 72.8777],
        status: "CRITICAL",
        metrics: {
          latency_ms: 45,
          packet_loss_pct: 0.8,
          utilization_pct: 78,
          jitter_ms: 3.2,
          bandwidth_mbps: 10000
        },
        prediction: {
          issue: "bandwidth_saturation",
          confidence: 0.85,
          eta_minutes: 120,
          severity: "high",
          reasoning: "Sustained high utilization during peak hours with rising queue depth",
          recommended_actions: [
            "Implement traffic prioritization for critical banking services",
            "Evaluate bandwidth expansion",
            "Monitor alternate path availability"
          ]
        },
        connected_services: ["NOC_Monitoring", "Core_Banking_API", "Transaction_Processing"],
        incidents: [
          { id: "INC-001", type: "performance", timestamp: "2026-06-26T10:00:00Z", status: "open" }
        ]
      },
      "bangalore-branch": {
        id: "bangalore-branch",
        name: "Bangalore Branch - Tech Hub",
        type: "BRANCH",
        location: "Bangalore, Karnataka",
        coordinates: [12.9716, 77.5946],
        status: "WARNING",
        metrics: {
          latency_ms: 82,
          packet_loss_pct: 2.3,
          utilization_pct: 65,
          jitter_ms: 5.8,
          bandwidth_mbps: 1000
        },
        prediction: {
          issue: "link_degradation",
          confidence: 0.78,
          eta_minutes: 240,
          severity: "medium",
          reasoning: "Fiber degradation pattern on primary MPLS route",
          recommended_actions: [
            "Switch to alternate Mumbai-Chennai route",
            "Schedule fiber inspection",
            "Monitor ATM transaction success rate"
          ]
        },
        connected_services: ["ATM_Gateway", "Branch_Banking", "Local_Services"],
        incidents: [
          { id: "INC-002", type: "connectivity", timestamp: "2026-06-26T11:30:00Z", status: "monitoring" }
        ]
      },
      "chennai-branch": {
        id: "chennai-branch",
        name: "Chennai Branch - South Ops",
        type: "BRANCH",
        location: "Chennai, Tamil Nadu",
        coordinates: [13.0827, 80.2707],
        status: "NORMAL",
        metrics: {
          latency_ms: 56,
          packet_loss_pct: 0.5,
          utilization_pct: 45,
          jitter_ms: 2.1,
          bandwidth_mbps: 1000
        },
        prediction: {
          issue: "weather_related_disruption",
          confidence: 0.45,
          eta_minutes: 1440,
          severity: "low",
          reasoning: "Monsoon season may cause minor latency fluctuations",
          recommended_actions: [
            "Monitor weather forecasts",
            "Prepare alternate routing procedures"
          ]
        },
        connected_services: ["ATM_Gateway", "Branch_Banking", "Regional_Services"],
        incidents: []
      },
      "dc-core": {
        id: "dc-core",
        name: "Data Center - Core Banking",
        type: "DATACENTER",
        location: "Mumbai Data Center",
        coordinates: [19.0176, 72.8562],
        status: "NORMAL",
        metrics: {
          latency_ms: 12,
          packet_loss_pct: 0.1,
          utilization_pct: 52,
          jitter_ms: 0.8,
          bandwidth_mbps: 10000
        },
        prediction: null,
        connected_services: ["Core_Banking_System", "Database_Cluster", "Payment_Gateway"],
        incidents: []
      }
    },
    edges: [
      {
        id: "mumbai-bangalore",
        source: "mumbai-hub",
        target: "bangalore-branch",
        type: "MPLS_PRIMARY",
        bandwidth: "1 Gbps",
        status: "DEGRADED",
        metrics: {
          latency_ms: 82,
          utilization_pct: 78,
          jitter_ms: 5.8,
          packet_loss_pct: 2.3,
          bandwidth_mbps: 1000
        },
        prediction: {
          issue: "congestion_buildup",
          confidence: 0.82,
          eta_minutes: 180,
          severity: "high",
          reasoning: "Elevated latency and packet loss on primary route",
          recommended_actions: [
            "Consider traffic rerouting",
            "Investigate fiber quality",
            "Prepare failover procedures"
          ]
        }
      },
      {
        id: "mumbai-chennai",
        source: "mumbai-hub",
        target: "chennai-branch",
        type: "MPLS_ALTERNATE",
        bandwidth: "1 Gbps",
        status: "NORMAL",
        metrics: {
          latency_ms: 56,
          utilization_pct: 45,
          jitter_ms: 2.1,
          packet_loss_pct: 0.5,
          bandwidth_mbps: 1000
        },
        prediction: null
      },
      {
        id: "mumbai-dc",
        source: "mumbai-hub",
        target: "dc-core",
        type: "CORE_LINK",
        bandwidth: "10 Gbps",
        status: "NORMAL",
        metrics: {
          latency_ms: 12,
          utilization_pct: 52,
          jitter_ms: 0.8,
          packet_loss_pct: 0.1,
          bandwidth_mbps: 10000
        },
        prediction: null
      },
      {
        id: "bangalore-chennai",
        source: "bangalore-branch",
        target: "chennai-branch",
        type: "INTER_BRANCH",
        bandwidth: "500 Mbps",
        status: "NORMAL",
        metrics: {
          latency_ms: 35,
          utilization_pct: 30,
          jitter_ms: 1.5,
          packet_loss_pct: 0.2,
          bandwidth_mbps: 500
        },
        prediction: null
      }
    ]
  };
}

export default TopologyCanvas;