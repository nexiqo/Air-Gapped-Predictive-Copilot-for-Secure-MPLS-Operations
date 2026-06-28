import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Overview.css';

// Lightweight inline SVG Sparkline Chart Component
function Sparkline({ data, color = '#58a6ff' }) {
  if (!data || data.length < 2) return null;
  const width = 76;
  const height = 22;
  const padding = 2;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  });
  
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', marginLeft: 'auto' }}>
      <path
        d={`M ${points.join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Lightweight Area Chart for Global Latency History
function AreaChart({ data, color = '#58a6ff' }) {
  if (!data || data.length < 2) return null;
  const width = 140;
  const height = 40;
  const padding = 2;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val - min) / range) * (height - padding * 2) - padding;
    return { x, y };
  });
  
  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;
  const gradId = `areaGrad-${color.replace('#', '')}`;
  
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', marginTop: '6px' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OverviewPage({ networkSummary, topology: propTopology, alerts: propAlerts, onNodeSelect }) {
  const navigate = useNavigate();
  const [localTopology, setLocalTopology] = useState(null);
  const [localAlerts, setLocalAlerts] = useState([]);
  const [latencyHistory, setLatencyHistory] = useState({});
  const [globalHistory, setGlobalHistory] = useState(Array(15).fill(14));
  const [loopState, setLoopState] = useState({ active_loops: [], history: [] });

  // Connect to telemetry push notifications via WebSockets with HTTP fallback
  useEffect(() => {
    const isHttps = window.location.protocol === 'https:';
    // Dynamically choose host to match current deployment (local or serveo tunnel)
    const host = window.location.hostname === 'localhost' ? '127.0.0.1:8000' : window.location.host;
    const wsUrl = `${isHttps ? 'wss:' : 'ws:'}//${host}/ws/telemetry`;
    
    let ws;
    let pingInterval;
    let fallbackPoll;

    const connectWS = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[WebSocket] Connected to live telemetry feed");
          ws.send(JSON.stringify({ type: 'TELEMETRY_SYNC' }));
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'TELEMETRY_RESPONSE') {
              setLoopState({
                active_loops: payload.active_loops || [],
                history: payload.loop_history || []
              });
            }
          } catch (e) {
            console.error("[WebSocket] Parsing error:", e);
          }
        };

        ws.onerror = (err) => {
          console.warn("[WebSocket] Telemetry socket encountered error:", err);
        };

        ws.onclose = () => {
          console.log("[WebSocket] Telemetry socket closed. Reconnect/polling fallback active.");
        };
      } catch (e) {
        console.error("[WebSocket] Connection failed:", e);
      }
    };

    connectWS();

    // Heartbeat pings over WebSocket channel
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'TELEMETRY_SYNC' }));
      }
    }, 2000);

    // Fallback polling if WebSocket is blocked or disconnected
    fallbackPoll = setInterval(async () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch('http://127.0.0.1:8000/loop/state');
          if (res.ok) {
            setLoopState(await res.json());
          }
        } catch {}
      }
    }, 3000);

    return () => {
      if (ws) ws.close();
      clearInterval(pingInterval);
      clearInterval(fallbackPoll);
    };
  }, []);
 
  useEffect(() => {
    if (!propTopology || !propAlerts.length) {
      fetchOverviewData();
    }
  }, [propTopology, propAlerts]);

  const fetchOverviewData = async () => {
    try {
      const [topologyResponse, alertsResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/topology'),
        fetch('http://127.0.0.1:8000/alerts')
      ]);

      if (topologyResponse.ok) {
        setLocalTopology(await topologyResponse.json());
      }

      if (alertsResponse.ok) {
        const data = await alertsResponse.json();
        setLocalAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch overview data:', error);
    }
  };

  const topology = propTopology || localTopology;
  const alerts = propAlerts.length > 0 ? propAlerts : localAlerts;

  // Sync latency histories on topology metrics polling
  useEffect(() => {
    if (topology?.nodes) {
      // 1. Update node sparkline arrays
      setLatencyHistory(prev => {
        const next = { ...prev };
        Object.entries(topology.nodes).forEach(([id, node]) => {
          const val = node.metrics?.latency_ms ?? 0;
          const hist = prev[id] ? [...prev[id]] : Array(10).fill(val);
          hist.push(val);
          if (hist.length > 10) hist.shift();
          next[id] = hist;
        });
        return next;
      });

      // 2. Update global average SLA timeline
      const nodesArr = Object.values(topology.nodes);
      const avgLat = nodesArr.reduce((sum, n) => sum + (n.metrics?.latency_ms ?? 0), 0) / nodesArr.length;
      setGlobalHistory(prev => {
        const next = [...prev, avgLat];
        if (next.length > 15) next.shift();
        return next;
      });
    }
  }, [topology]);

  const getHealthBadgeClass = (health) => {
    switch (health) {
      case 'CRITICAL': return 'badge-critical';
      case 'DEGRADED': return 'badge-warning';
      default: return 'badge-normal';
    }
  };

  const getTimelineEvents = () => {
    const events = [];
    if (loopState?.active_loops) {
      loopState.active_loops.forEach(loop => {
        events.push({
          id: loop.incident_id || `active-${loop.node_id}`,
          nodeId: loop.node_id,
          type: loop.incident_type,
          triggerTime: loop.trigger_time,
          completionTime: null,
          phase: loop.phase,
          status: 'active'
        });
      });
    }
    if (loopState?.history) {
      const sortedHist = [...loopState.history].reverse();
      sortedHist.forEach((h, idx) => {
        events.push({
          id: `hist-${idx}`,
          nodeId: h.node_id,
          type: h.incident_type,
          triggerTime: h.trigger_time,
          completionTime: h.completion_time,
          phase: 'RESOLVED',
          status: 'resolved'
        });
      });
    }
    return events.slice(0, 4);
  };

  const handleSelectSite = (node) => {
    onNodeSelect?.(node);
    navigate('/topology');
  };

  const healthColor = networkSummary?.overall_health === 'CRITICAL' ? '#da3633' : networkSummary?.overall_health === 'DEGRADED' ? '#d29922' : '#238636';

  return (
    <div className="overview-page">
      <div className="overview-header">
        <div>
          <h2>Shift Overview</h2>
          <p className="header-subtitle">NOC Operations & Predictor Cockpit</p>
        </div>
        <button className="action-btn" onClick={() => navigate('/topology')}>
          View Full Topology
        </button>
      </div>

      {networkSummary && (
        <div className="overview-grid">
          {/* Global Risk Summary */}
          <div className="overview-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3>Network Health</h3>
            <div style={{ display: 'flex', flex: 1, gap: '16px', alignItems: 'center' }}>
              <div className="health-details" style={{ flex: 1 }}>
                <div className="health-display">
                  <span className={`health-badge ${getHealthBadgeClass(networkSummary.overall_health)}`}>
                    {networkSummary.overall_health}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Total Nodes:</span>
                  <span className="value">{networkSummary.total_nodes}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Critical:</span>
                  <span className="value critical">{networkSummary.critical_nodes}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Warning:</span>
                  <span className="value warning">{networkSummary.warning_nodes}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Avg SLA Latency</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>
                  {globalHistory.length > 0 ? `${globalHistory[globalHistory.length - 1].toFixed(1)} ms` : '--'}
                </span>
                <AreaChart data={globalHistory} color={healthColor} />
              </div>
            </div>
          </div>

          {/* Most Critical Issue */}
          <div className="overview-card critical-card">
            <h3>Most Critical Issue</h3>
            <div className="critical-content">
              <span className="status-dot-indicator critical"></span>
              <div className="critical-text">
                <p>{networkSummary.most_critical_issue}</p>
                <div className="critical-meta">
                  <span>ETA: {networkSummary.eta_to_failure} minutes</span>
                  <span>Confidence: {(networkSummary.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* At-Risk Branch */}
          <div className="overview-card warning-card">
            <h3>At-Risk Branch</h3>
            <div className="warning-content">
              <span className="status-dot-indicator warning"></span>
              <div className="warning-text">
                <p className="branch-name">{networkSummary.most_at_risk_branch}</p>
                <p className="next-failure">Next: {networkSummary.next_likely_failure}</p>
              </div>
            </div>
          </div>

          {/* Predictive Model Stats */}
          <div className="overview-card info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer' }} onClick={() => navigate('/predictions')}>
            <h3>Predictive Model Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span className="label" style={{ color: 'var(--text-muted)' }}>Accuracy:</span>
                <span className="value" style={{ fontWeight: 'bold', color: 'var(--green)' }}>100% CV Accuracy</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span className="label" style={{ color: 'var(--text-muted)' }}>Dataset:</span>
                <span className="value" style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>847 Training Samples</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span className="label" style={{ color: 'var(--text-muted)' }}>Features:</span>
                <span className="value" style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>12 Features (BGP/OSPF/QoS)</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                CLASSIFIER: RANDOM FOREST
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Sections Layout */}
      <div className="overview-sections-container">
        
        {/* Left Side: Top Risk & Compact Topology */}
        <div className="overview-sections-left">
          
          {/* Top At-Risk Branches */}
          {networkSummary?.top_risk_branches && (
            <div className="overview-section">
              <h3>Top At-Risk Branches</h3>
              <div className="risk-branches-grid">
                {networkSummary.top_risk_branches.slice(0, 5).map((branch) => (
                  <div 
                    key={branch.id} 
                    className={`risk-branch-card risk-${branch.risk_level.toLowerCase()}`}
                    onClick={() => handleSelectSite({ id: branch.id })}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="branch-info">
                      <span className="branch-name">{branch.name}</span>
                      <span className="branch-risk">Score: {branch.risk_score}</span>
                    </div>
                    <div className="risk-bar-container">
                      <div 
                        className="risk-bar" 
                        style={{ 
                          width: `${Math.min(100, branch.risk_score * 10)}%`,
                          backgroundColor: branch.risk_score >= 5 ? '#da3633' : branch.risk_score >= 3 ? '#d29922' : '#238636'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Loop Engine Status Widget */}
          <div className="overview-section" style={{ cursor: 'pointer' }} onClick={() => navigate('/loop-engine')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: 'none', paddingBottom: 0 }}>Live Loop Engine Status</h3>
              <span className="live-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', padding: '2px 8px', borderRadius: '12px', background: '#3fb95015', border: '1px solid #3fb95044', color: '#3fb950', fontWeight: 'bold' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3fb950', display: 'inline-block' }}></span>
                ACTIVE
              </span>
            </div>

            {loopState.active_loops && loopState.active_loops.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {loopState.active_loops.map(loop => {
                  const phaseColor = loop.phase === 'TRIAGE' ? '#d29922' : loop.phase === 'MITIGATION' ? '#58a6ff' : loop.phase === 'VERIFICATION' ? '#bc8cff' : '#3fb950';
                  const percent = loop.phase === 'TRIAGE' ? 25 : loop.phase === 'MITIGATION' ? 50 : loop.phase === 'VERIFICATION' ? 75 : 100;
                  return (
                    <div key={loop.incident_id} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-inset)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {loop.node_id.replace('branch-', '').toUpperCase()} Auto-Remediation
                        </span>
                        <span style={{ fontSize: '10px', color: phaseColor, fontWeight: 'bold', letterSpacing: '0.5px' }}>{loop.phase}</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percent}%`, background: phaseColor, transition: 'width 0.3s ease' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                        {loop.last_log || 'Executing self-healing instructions...'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', background: 'var(--bg-inset)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-dot online" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3fb950', display: 'inline-block', boxShadow: '0 0 8px #3fb950' }}></span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>All core MPLS links stable. Monitoring underlay...</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {loopState.history ? `${loopState.history.filter(h => h.status === 'resolved').length} Auto-Resolved` : '0 Auto-Resolved'}
                </div>
              </div>
            )}
          </div>

          {/* Compact Topology Map Preview with Sparklines */}
          {topology?.nodes && (
            <div className="overview-section">
              <h3>Topology Site Monitor</h3>
              <div className="compact-topology-grid">
                {Object.values(topology.nodes).map((node) => {
                  let statusColor = '#238636';
                  if (node.status === 'CRITICAL') statusColor = '#da3633';
                  else if (node.status === 'WARNING') statusColor = '#d29922';
                  
                  const hist = latencyHistory[node.id] || [];
                  const color = node.status === 'CRITICAL' ? '#da3633' : node.status === 'WARNING' ? '#d29922' : '#238636';

                  return (
                    <div 
                      key={node.id} 
                      className="compact-node-item"
                      onClick={() => handleSelectSite(node)}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '6px 10px', borderRadius: 'var(--radius)', background: 'var(--bg-inset)', border: '1px solid var(--border)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                        <span className="status-dot" style={{ backgroundColor: statusColor, width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }}></span>
                        <span className="node-name" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {node.name.split('-')[0].trim()}
                        </span>
                      </div>
                      <span 
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          fontFamily: 'var(--mono)',
                          color: color,
                          background: `${color}15`,
                          border: `1px solid ${color}33`,
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        {node.metrics?.latency_ms ? `${node.metrics.latency_ms.toFixed(2)}ms` : '0.00ms'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Copilot Findings & Alerts */}
        <div className="overview-sections-right">
          
          {/* Recent Copilot Findings */}
          {networkSummary?.recent_predictions && (
            <div className="overview-section">
              <h3>Recent Copilot Findings</h3>
              <div className="findings-feed">
                {networkSummary.recent_predictions.slice(0, 4).map((pred) => (
                  <div key={pred.prediction_id} className="finding-item">
                    <div className="finding-header">
                      <span className="finding-title">{pred.predicted_fault_type.toUpperCase().replace("_", " ")}</span>
                      <span className="finding-time">{pred.timestamp.split('T')[1].slice(0, 8)}</span>
                    </div>
                    <p className="finding-body">{pred.reasoning}</p>
                    <div className="finding-meta">
                      <span>Site: {pred.predicted_at_site}</span>
                      <span>Confidence: {(pred.confidence * 100).toFixed(0)}%</span>
                      <span>ETA: {pred.prophet_breach_eta_minutes}min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Alerts */}
          <div className="overview-section">
            <h3>Recent Active Alerts</h3>
            {alerts.length > 0 ? (
              <div className="alerts-list">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className={`alert-item ${alert.severity}`}>
                    <div className="alert-header">
                      <span className="alert-entity">{alert.entity_name}</span>
                      <span className={`alert-severity ${alert.severity}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="alert-message">{alert.message}</p>
                    <div className="alert-metrics">
                      {alert.metrics?.latency_ms && (
                        <span>Latency: {alert.metrics.latency_ms}ms</span>
                      )}
                      {alert.metrics?.utilization_pct && (
                        <span>Util: {alert.metrics.utilization_pct}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No active alerts</p>
            )}
          </div>

        </div>

      </div>

      {/* Incident Lifecycle Timeline View */}
      {getTimelineEvents().length > 0 && (
        <div className="overview-section incident-timeline-card" style={{ marginTop: '24px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>NOC Incident Lifecycle Timeline</h3>
          <div className="timeline-container">
            {getTimelineEvents().map((event, idx) => {
              let p2Status = 'pending';
              let p3Status = 'pending';
              
              if (event.status === 'resolved') {
                p2Status = 'done';
                p3Status = 'done';
              } else if (event.status === 'active') {
                if (event.phase === 'TRIAGE') {
                  p2Status = 'active';
                } else if (event.phase === 'MITIGATION' || event.phase === 'VERIFICATION') {
                  p2Status = 'done';
                  p3Status = 'active';
                } else {
                  p2Status = 'done';
                  p3Status = 'done';
                }
              }
              
              return (
                <div key={event.id || idx} className="timeline-row">
                  <div className="timeline-info">
                    <span className="timeline-node">{event.nodeId.replace('branch-', '').toUpperCase()}</span>
                    <span className="timeline-type">{event.type}</span>
                  </div>
                  <div className="timeline-track">
                    {/* Step 1: Triggered */}
                    <div className="timeline-step done">
                      <div className="step-dot red" />
                      <div className="step-label">Incident Triggered <span className="step-time">({event.triggerTime})</span></div>
                    </div>
                    
                    <div className={`timeline-line ${p2Status}`} />
                    
                    {/* Step 2: Loop Engaged */}
                    <div className={`timeline-step ${p2Status}`}>
                      <div className={`step-dot purple ${p2Status === 'active' ? 'pulse' : ''}`} />
                      <div className="step-label">Loop Engaged</div>
                    </div>
                    
                    <div className={`timeline-line ${p3Status}`} />
                    
                    {/* Step 3: Verified Recovery */}
                    <div className={`timeline-step ${p3Status}`}>
                      <div className={`step-dot green ${p3Status === 'active' ? 'pulse' : ''}`} />
                      <div className="step-label">
                        Verified Recovery 
                        {event.completionTime && <span className="step-time"> ({event.completionTime})</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="overview-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => navigate('/topology')}>
            View Topology
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/branches')}>
            Check Branches
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/alerts')}>
            View Alerts
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/predictions')}>
            See Predictions
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/reports')}>
            Generate Reports
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverviewPage;