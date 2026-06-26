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

function TopologyCanvas({ topology: propTopology, onNodeSelect, onEdgeSelect, selectedNode, selectedEdge }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [topologyData, setTopologyData] = useState(null);

  // Trigger transformation when prop changes (for live updates!)
  useEffect(() => {
    if (propTopology) {
      setTopologyData(propTopology);
      transformToReactFlow(propTopology);
    } else {
      fetchTopology();
    }
  }, [propTopology]);

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
      const fallbackData = getFallbackTopology();
      setTopologyData(fallbackData);
      transformToReactFlow(fallbackData);
    }
  };

  const transformToReactFlow = (topology) => {
    if (!topology || !topology.nodes) return;
    
    const flowNodes = Object.entries(topology.nodes).map(([id, node]) => {
      const status = node.status || 'NORMAL';
      let borderColor = '#30363d'; // Default border
      let glowColor = 'transparent';
      
      if (status === 'CRITICAL') {
        borderColor = '#da3633'; // Red
        glowColor = 'rgba(218, 54, 51, 0.4)';
      } else if (status === 'WARNING') {
        borderColor = '#d29922'; // Yellow
        glowColor = 'rgba(210, 153, 34, 0.3)';
      } else if (status === 'NORMAL') {
        borderColor = '#238636'; // Green
      }

      // Map coordinates geographically
      let position = { x: 0, y: 0 };
      let lat = null;
      let lon = null;
      
      if (node.coordinates && node.coordinates.length === 2) {
        lat = node.coordinates[0];
        lon = node.coordinates[1];
      } else if (typeof node.lat === 'number' && typeof node.lon === 'number') {
        lat = node.lat;
        lon = node.lon;
      }

      if (lat !== null && lon !== null) {
        // Map longitude (68 to 90) -> (50 to 750)
        position.x = (lon - 68) * 31.8 + 50;
        // Map latitude (8 to 33) -> (600 to 50) - inverted
        position.y = 600 - (lat - 8) * 22.0;
        
        // Offset DC Mumbai
        if (id === 'dc-mumbai' || id === 'dc-core') {
          position.x += 40;
          position.y += 20;
        }
      } else if (node.type === 'HUB') {
        position = { x: 400, y: 300 };
      } else if (node.type === 'DATACENTER') {
        position = { x: 420, y: 280 };
      } else {
        position = { x: Math.random() * 800, y: Math.random() * 600 };
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
                  <span className="metric-value">{node.metrics?.latency_ms}ms</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Loss:</span>
                  <span className="metric-value">{node.metrics?.packet_loss_pct}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Util:</span>
                  <span className="metric-value">{node.metrics?.utilization_pct}%</span>
                </div>
              </div>
              {node.prediction && (
                <div className="node-prediction">
                  <span className="prediction-indicator-dot" style={{ backgroundColor: borderColor }}></span>
                  <span className="prediction-text">{node.prediction.issue}</span>
                  <span className="prediction-eta">{node.prediction.eta_minutes}m</span>
                </div>
              )}
            </div>
          ),
          ...node
        },
        style: {
          border: `2px solid ${borderColor}`,
          borderRadius: '4px',
          backgroundColor: '#0d1117',
          color: '#ffffff',
          width: 200,
          height: 'auto',
          minHeight: 140,
          boxShadow: glowColor !== 'transparent' ? `0 0 16px ${glowColor}` : 'none',
        },
        className: `topology-node node-${status.toLowerCase()}`,
      };
    });

    const flowEdges = topology.edges.map((edge) => {
      const status = edge.status || 'NORMAL';
      let strokeColor = '#30363d'; // Default gray border
      let strokeWidth = 2;
      let animated = false;
      
      if (status === 'CRITICAL') {
        strokeColor = '#da3633'; // Red critical edge
        strokeWidth = 3;
        animated = true;
      } else if (status === 'DEGRADED') {
        strokeColor = '#d29922'; // Yellow degraded edge
        strokeWidth = 2.5;
        animated = true;
      } else if (status === 'NORMAL') {
        strokeColor = '#238636'; // Green healthy edge
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
          width: 15,
          height: 15,
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
                ALERT {prediction.eta_minutes}m
              </div>
            )}
          </div>
        ),
        labelStyle: {
          fill: '#ffffff',
          fontSize: 10,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: '#000000',
          fillOpacity: 0.95,
          borderRadius: '2px',
          padding: '2px 6px',
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
  }, [onNodeSelect]);

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
            background: '#000000',
            border: '2px solid #30363d',
            color: '#ffffff'
          }}
        />
        <MiniMap 
          className="minimap"
          style={{
            background: '#000000',
            border: '2px solid #30363d',
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
      "hub-delhi": {
        id: "hub-delhi",
        name: "New Delhi Hub",
        type: "HUB",
        location: "New Delhi, Delhi",
        coordinates: [28.6139, 77.2090],
        status: "NORMAL",
        metrics: {
          latency_ms: 1.2,
          packet_loss_pct: 0.0,
          utilization_pct: 12.0
        }
      }
    },
    edges: []
  };
}

export default TopologyCanvas;