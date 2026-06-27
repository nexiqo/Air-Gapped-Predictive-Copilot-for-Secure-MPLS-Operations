import { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './TopologyCanvas.css';

function TopologyCanvasInner({ topology: propTopology, onNodeSelect, onEdgeSelect, selectedNode, selectedEdge, filters }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [topologyData, setTopologyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Keyboard shortcuts: F=fit view, Escape=deselect, +/-=zoom
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitView({ duration: 400, padding: 0.15 }); }
      if (e.key === 'Escape') { onNodeSelect && onNodeSelect(null); onEdgeSelect && onEdgeSelect(null); }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn({ duration: 200 }); }
      if (e.key === '-') { e.preventDefault(); zoomOut({ duration: 200 }); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fitView, zoomIn, zoomOut, onNodeSelect, onEdgeSelect]);

  const onInit = useCallback((rf) => {
    setTimeout(() => rf.fitView({ duration: 600, padding: 0.15 }), 100);
  }, []);

  // Trigger transformation when prop topology or filters change (for live updates!)
  useEffect(() => {
    if (propTopology) {
      setTopologyData(propTopology);
      transformToReactFlow(propTopology, filters);
      setLoading(false);
    } else {
      fetchTopology();
    }
  }, [propTopology, filters]);

  const fetchTopology = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/topology');
      if (response.ok) {
        const data = await response.json();
        setTopologyData(data);
        transformToReactFlow(data, filters);
      }
    } catch (error) {
      console.error('Failed to fetch topology:', error);
      const fallbackData = getFallbackTopology();
      setTopologyData(fallbackData);
      transformToReactFlow(fallbackData, filters);
    } finally {
      setLoading(false);
    }
  };

  const transformToReactFlow = (topology, currentFilters) => {
    if (!topology || !topology.nodes) return;

    const { severity = 'all', type = 'all', showPredictions = true, showLabels = true } = currentFilters || {};

    // 1. Calculate stable, collision-free coordinates for all nodes in the topology
    const nodePositions = {};
    const minDx = 230; // Minimum horizontal gap (node width 200px + 30px gap)
    const minDy = 165; // Minimum vertical gap (node height 140px + 25px gap)

    // Initial geographic coordinates mapping (expanded scale)
    Object.entries(topology.nodes).forEach(([id, node]) => {
      let lat = null;
      let lon = null;
      if (node.coordinates && node.coordinates.length === 2) {
        lat = node.coordinates[0];
        lon = node.coordinates[1];
      } else if (typeof node.lat === 'number' && typeof node.lon === 'number') {
        lat = node.lat;
        lon = node.lon;
      }

      let x = 0;
      let y = 0;
      if (lat !== null && lon !== null) {
        // Expand mapping scale so nodes are naturally further apart
        x = (lon - 68) * 36.0 + 80;
        y = 750 - (lat - 8) * 26.0;
      } else if (node.type === 'HUB') {
        x = 550; y = 200;
      } else if (node.type === 'DATACENTER') {
        x = 500; y = 450;
      } else {
        x = Math.random() * 800; y = Math.random() * 600;
      }

      // Manual adjustments for dense regions to improve default relative spacing
      if (id === 'dc-mumbai') { x = 200; y = 480; }
      if (id === 'branch-pune') { x = 220; y = 580; }
      if (id === 'branch-bengaluru') { x = 320; y = 720; }
      if (id === 'branch-kochi') { x = 300; y = 840; }
      if (id === 'branch-chennai') { x = 450; y = 760; }
      if (id === 'branch-hyderabad') { x = 480; y = 600; }
      if (id === 'branch-nagpur') { x = 500; y = 450; }
      if (id === 'branch-bhopal') { x = 480; y = 350; }
      if (id === 'branch-ahmedabad') { x = 160; y = 350; }

      nodePositions[id] = { x, y };
    });

    // Run collision resolution passes
    for (let pass = 0; pass < 12; pass++) {
      Object.keys(nodePositions).forEach(id1 => {
        Object.keys(nodePositions).forEach(id2 => {
          if (id1 === id2) return;

          const pos1 = nodePositions[id1];
          const pos2 = nodePositions[id2];

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          if (absDx < minDx && absDy < minDy) {
            // Push them apart
            const overlapX = minDx - absDx;
            const overlapY = minDy - absDy;

            const dirX = dx >= 0 ? 1 : -1;
            const dirY = dy >= 0 ? 1 : -1;

            if (overlapX < overlapY) {
              nodePositions[id1].x -= (overlapX / 2) * dirX;
              nodePositions[id2].x += (overlapX / 2) * dirX;
            } else {
              nodePositions[id1].y -= (overlapY / 2) * dirY;
              nodePositions[id2].y += (overlapY / 2) * dirY;
            }
          }
        });
      });
    }

    // Keep all nodes within a clean viewport boundary
    Object.keys(nodePositions).forEach(id => {
      nodePositions[id].x = Math.max(50, Math.min(1050, nodePositions[id].x));
      nodePositions[id].y = Math.max(50, Math.min(850, nodePositions[id].y));
    });
    
    // 2. Map Nodes with Filter-Aware Opacity
    const flowNodes = Object.entries(topology.nodes || {}).map(([id, node]) => {
      const status = node.status || 'NORMAL';
      
      // Determine if this node matches the active filters
      let matchesFilter = true;
      if (type !== 'all' && node.type !== type) {
        matchesFilter = false;
      }
      if (severity !== 'all' && status.toLowerCase() !== severity.toLowerCase()) {
        matchesFilter = false;
      }
      
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

      const position = nodePositions[id] || { x: 0, y: 0 };
      const opacity = matchesFilter ? 1.0 : 0.15;

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
              
              {showLabels && (
                <>
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
                  
                  {showPredictions && node.prediction && (
                    <div className="node-prediction">
                      <span className="prediction-indicator-dot" style={{ backgroundColor: borderColor }}></span>
                      <span className="prediction-text">{node.prediction.issue}</span>
                      <span className="prediction-eta">{node.prediction.eta_minutes}m</span>
                    </div>
                  )}

                  {/* Actions Toolbar directly in Map nodes */}
                  <div className="node-actions" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="node-action-btn diag"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('copilotQuery', { 
                          detail: `Run diagnostics and check status on node ${id}` 
                        }));
                      }}
                    >
                      Diag
                    </button>
                    {node.prediction && (
                      <button 
                        className="node-action-btn fix"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('copilotQuery', { 
                            detail: `Auto-remediate issue on ${id}` 
                          }));
                        }}
                      >
                        Fix
                      </button>
                    )}
                  </div>
                </>
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
          minHeight: showLabels ? 140 : 60,
          boxShadow: glowColor !== 'transparent' ? `0 0 16px ${glowColor}` : 'none',
          opacity: opacity,
          pointerEvents: matchesFilter ? 'auto' : 'none',
          transition: 'opacity 0.25s ease-in-out'
        },
        className: `topology-node node-${status.toLowerCase()}`,
      };
    });

    // 3. Map Edges with Filter-Aware Opacity
    const flowEdges = (topology.edges || []).map((edge) => {
      const status = edge.status || 'NORMAL';
      
      // Determine if this edge connects filtered nodes
      const sourceNode = topology.nodes[edge.source];
      const targetNode = topology.nodes[edge.target];
      
      let matchesFilter = true;
      if (sourceNode && targetNode) {
        const sourceStatus = sourceNode.status || 'NORMAL';
        const targetStatus = targetNode.status || 'NORMAL';
        
        if (type !== 'all' && (sourceNode.type !== type || targetNode.type !== type)) {
          matchesFilter = false;
        }
        if (severity !== 'all' && (sourceStatus.toLowerCase() !== severity.toLowerCase() && targetStatus.toLowerCase() !== severity.toLowerCase())) {
          matchesFilter = false;
        }
      }
      
      const opacity = matchesFilter ? 1.0 : 0.15;
      
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
        animated: animated && matchesFilter,
        style: {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          opacity: opacity,
          transition: 'opacity 0.25s ease-in-out'
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 15,
          height: 15,
        },
        label: showLabels ? (
          <div className="edge-label" style={{ opacity: opacity, transition: 'opacity 0.25s ease-in-out' }}>
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
        ) : null,
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

  if (loading) {
    return (
      <div className="topology-loading">
        <div className="loading-spinner"></div>
        <p>Loading network topology...</p>
      </div>
    );
  }

  return (
    <div className="topology-canvas">
      {nodes.length === 0 && (
        <div className="topology-empty-overlay">
          <div className="empty-message-box">
            <span className="empty-icon">⚠️</span>
            <h4>No nodes match filters</h4>
            <p>Try resetting severity/type options or waiting for live simulated alerts.</p>
          </div>
        </div>
      )}
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
      {/* Keyboard shortcut hint bar */}
      <div className="tc-shortcut-bar">
        <span><kbd>F</kbd> Fit View</span>
        <span><kbd>+</kbd><kbd>-</kbd> Zoom</span>
        <span><kbd>Esc</kbd> Deselect</span>
        <span><kbd>Scroll</kbd> Pan/Zoom</span>
        <span style={{marginLeft:'auto', color:'#3fb950'}}>● {nodes.length} nodes · {edges.length} links</span>
      </div>
    </div>
  );
}

function TopologyCanvas(props) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
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