import { useState, useEffect } from 'react';
import './DetailPanel.css';

function DetailPanel({ selectedNode, selectedEdge, activeIncidents = [], onStepExecute, onResolveIncident }) {
  const [branchDetail, setBranchDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('roster');

  useEffect(() => {
    if (!selectedNode?.id) {
      setBranchDetail(null);
      return;
    }
    
    // Reset to initial tab on node change
    setActiveTab('roster');
    
    fetchBranchDetail(selectedNode.id);
    
    const interval = setInterval(() => {
      fetchBranchDetail(selectedNode.id);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedNode?.id, selectedNode?.status, selectedNode?.data?.status]);

  const fetchBranchDetail = async (nodeId) => {
    setLoading(true);
    try {
      const status = selectedNode?.status || selectedNode?.data?.status || 'NORMAL';
      const response = await fetch(`http://127.0.0.1:8000/branches/${nodeId}?status=${status}`);
      if (response.ok) {
        const data = await response.json();
        setBranchDetail(data);
      }
    } catch (error) {
      console.error('Failed to fetch branch detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'CRITICAL': return 'status-critical';
      case 'WARNING': return 'status-warning';
      case 'DEGRADED': return 'status-warning';
      default: return 'status-normal';
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'high': return 'severity-critical';
      case 'critical': return 'severity-critical';
      case 'medium': return 'severity-warning';
      default: return 'severity-normal';
    }
  };

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="detail-panel">
        <div className="detail-placeholder">
          <div className="placeholder-text-icon">NOC</div>
          <h3>Entity Details</h3>
          <p>Select a node or edge from the topology to view detailed information.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="detail-panel">
        <div className="detail-loading">
          <div className="loading-spinner"></div>
          <p>Loading details...</p>
        </div>
      </div>
    );
  }

  // Node Detail View
  if (selectedNode) {
    const nodeData = { ...(branchDetail?.node || {}), ...(selectedNode.data || selectedNode) };
    const metrics = nodeData.metrics || {};
    const prediction = nodeData.prediction;
    const incidents = nodeData.incidents || [];
    const services = nodeData.connected_services || [];

    // Find active incident for this node in the interactive engine
    const activeInc = activeIncidents.find(inc => inc.nodeId === selectedNode.id && inc.status === 'active');

    return (
      <div className="detail-panel">
        <div className="detail-header">
          <h3>{nodeData.name || selectedNode.id}</h3>
          <span className={`status-badge ${getStatusClass(nodeData.status)}`}>
            {nodeData.status || 'UNKNOWN'}
          </span>
        </div>

        <div className="detail-content">
          {/* Active Remediation Checklist */}
          {activeInc && (
            <div className="detail-section manual-remediation-section">
              <h4>Active Incident Mitigation</h4>
              <p className="remediation-msg">Checklist to restore node SLA parameters:</p>
              <div className="remediation-steps-list">
                {activeInc.steps.map((step) => (
                  <div key={step.id} className={`remediation-step-item ${step.status}`}>
                    <span className="step-number">{step.id + 1}</span>
                    <span className="step-label">{step.label}</span>
                    <button 
                      className={`step-btn ${step.status === 'completed' ? 'completed' : 'pending'}`}
                      onClick={() => onStepExecute(activeInc.id, step.id)}
                      disabled={step.status === 'completed'}
                    >
                      {step.status === 'completed' ? 'DONE' : 'EXECUTE'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="auto-resolve-fallback">
                <span>Or run auto-remediation:</span>
                <button 
                  className="remediation-auto-btn"
                  onClick={() => {
                    onResolveIncident(activeInc.id, 'copilot');
                    // Dispatch custom event to sync with chatbot logs
                    window.dispatchEvent(new CustomEvent('copilotRemediate', { 
                      detail: { nodeId: activeInc.nodeId, type: activeInc.type, method: 'auto' } 
                    }));
                  }}
                >
                  Auto-Resolve
                </button>
              </div>
            </div>
          )}

          {/* Basic Information & Corporate Role */}
          <div className="detail-section">
            <h4>Corporate Profile</h4>
            <div className="info-row">
              <span className="label">Location:</span>
              <span className="value">{nodeData.location || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="label">Enterprise Unit:</span>
              <span className="value" style={{ fontWeight: 600, color: '#58a6ff' }}>{branchDetail?.role || 'Edge Operations Node'}</span>
            </div>
            <div className="info-row">
              <span className="label">SLA Window:</span>
              <span className="value">{branchDetail?.in_maintenance ? 'MAINTENANCE MODE' : 'MONITORED (SLA)'}</span>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="detail-tabs">
            <button 
              className={`detail-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
              onClick={() => setActiveTab('roster')}
            >
              Roster
            </button>
            <button 
              className={`detail-tab-btn ${activeTab === 'qos' ? 'active' : ''}`}
              onClick={() => setActiveTab('qos')}
            >
              QoS & Flows
            </button>
            <button 
              className={`detail-tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
              onClick={() => setActiveTab('assets')}
            >
              Hardware & IPAM
            </button>
            <button 
              className={`detail-tab-btn ${activeTab === 'syslogs' ? 'active' : ''}`}
              onClick={() => setActiveTab('syslogs')}
            >
              Live Logs
            </button>
          </div>

          {/* TAB 1: ROSTER */}
          {activeTab === 'roster' && branchDetail?.live_employees && branchDetail.live_employees.length > 0 && (
            <div className="detail-section">
              <h4>Live Employee & Device Activity ({branchDetail.live_employees.length} Active)</h4>
              <div className="employee-table-wrapper">
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>User / Role</th>
                      <th>Application</th>
                      <th>Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchDetail.live_employees.map((emp, index) => (
                      <tr key={index} className={`employee-row status-${emp.status.toLowerCase()}`}>
                        <td>
                          <div className="emp-name">
                            {emp.status === 'Abuse' && <span className="warning-indicator">[ALERT] </span>}
                            {emp.name}
                          </div>
                          <div className="emp-role">{emp.role} • {emp.ip_address}</div>
                        </td>
                        <td>
                          <div className="emp-app">{emp.active_application}</div>
                          <div className="emp-device">{emp.device_id}</div>
                        </td>
                        <td className="emp-bandwidth">
                          <span className={`bandwidth-badge ${emp.status === 'Abuse' ? 'abuse' : 'normal'}`}>
                            {emp.bandwidth_mbps} Mbps
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: QoS & FLOWS */}
          {activeTab === 'qos' && (
            <div className="detail-section">
              <h4>Application Flow Breakdown</h4>
              <div className="flow-distribution-bar">
                {(() => {
                  const isCongested = nodeData.status === 'CRITICAL' || nodeData.status === 'WARNING';
                  const voicePct = isCongested ? 12 : 30;
                  const dbPct = isCongested ? 10 : 45;
                  const scavengerPct = isCongested ? 73 : 5;
                  const webPct = isCongested ? 5 : 20;
                  return (
                    <>
                      <div className="flow-segment voice" style={{ width: `${voicePct}%` }} title={`VoIP/Video: ${voicePct}%`}></div>
                      <div className="flow-segment db" style={{ width: `${dbPct}%` }} title={`Databases/ERP: ${dbPct}%`}></div>
                      <div className="flow-segment web" style={{ width: `${webPct}%` }} title={`Default Web/Mail: ${webPct}%`}></div>
                      <div className="flow-segment scavenger" style={{ width: `${scavengerPct}%` }} title={`Video/Streaming: ${scavengerPct}%`}></div>
                    </>
                  );
                })()}
              </div>
              <div className="flow-legend">
                <span className="legend-item"><span className="legend-dot voice"></span>VoIP ({nodeData.status === 'CRITICAL' ? '12%' : '30%'})</span>
                <span className="legend-item"><span className="legend-dot db"></span>DB/ERP ({nodeData.status === 'CRITICAL' ? '10%' : '45%'})</span>
                <span className="legend-item"><span className="legend-dot web"></span>Office/Web ({nodeData.status === 'CRITICAL' ? '5%' : '20%'})</span>
                <span className="legend-item"><span className="legend-dot scavenger"></span>Media ({nodeData.status === 'CRITICAL' ? '73%' : '5%'})</span>
              </div>

              <h4 style={{ marginTop: '16px' }}>QoS Interface Queues</h4>
              <div className="queues-list">
                <div className="queue-item">
                  <div className="queue-header">
                    <span className="queue-name">EF strict (Real-time Voice/Video)</span>
                    <span className="queue-status normal">Conforming</span>
                  </div>
                  <div className="queue-metrics">Utilization: {nodeData.status === 'CRITICAL' ? '45.2%' : '18.4%'} • Packet Drops: 0 • Delay: {nodeData.status === 'CRITICAL' ? '1.2ms' : '0.5ms'}</div>
                </div>

                <div className="queue-item">
                  <div className="queue-header">
                    <span className="queue-name">AF41/AF42 (Business Critical Databases)</span>
                    <span className="queue-status normal">Conforming</span>
                  </div>
                  <div className="queue-metrics">Utilization: {nodeData.status === 'CRITICAL' ? '28.1%' : '38.5%'} • Packet Drops: 0 • Weight: 40%</div>
                </div>

                <div className="queue-item">
                  <div className="queue-header">
                    <span className="queue-name">Default BE (Standard Web & Mail)</span>
                    <span className={`queue-status ${nodeData.status === 'CRITICAL' ? 'degraded' : 'normal'}`}>{nodeData.status === 'CRITICAL' ? 'Queue Saturated' : 'Conforming'}</span>
                  </div>
                  <div className="queue-metrics">Utilization: {nodeData.status === 'CRITICAL' ? '98.5%' : '24.1%'} • Packet Drops: {nodeData.status === 'CRITICAL' ? '184' : '0'} • Weight: 25%</div>
                </div>

                <div className="queue-item">
                  <div className="queue-header">
                    <span className="queue-name">Scavenger (Low Priority Media/P2P)</span>
                    <span className={`queue-status ${nodeData.status === 'CRITICAL' ? 'critical' : 'normal'}`}>{nodeData.status === 'CRITICAL' ? 'Buffer Overflow' : 'Conforming'}</span>
                  </div>
                  <div className="queue-metrics">Utilization: {nodeData.status === 'CRITICAL' ? '99.8%' : '2.1%'} • Packet Drops: {nodeData.status === 'CRITICAL' ? '1,425' : '0'} • Policy: QoS Shaped</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE & IPAM */}
          {activeTab === 'assets' && (
            <div className="detail-section">
              <h4>Active Network Hardware Inventory</h4>
              <div className="assets-list">
                {branchDetail?.assets?.map((asset, index) => (
                  <div key={index} className="asset-item-card">
                    <div className="asset-header-row">
                      <span className="asset-name-title">{asset.name}</span>
                      <span className="asset-status-tag">{asset.status}</span>
                    </div>
                    <div className="asset-model-text">{asset.model} • S/N: {asset.serial}</div>
                    <div className="asset-firmware-text">OS: {asset.firmware}</div>
                    
                    <div className="asset-resource-metrics">
                      <div className="resource-bar-row">
                        <span className="resource-label">CPU:</span>
                        <div className="resource-progress-bar">
                          <div className="resource-progress-fill" style={{ width: `${asset.cpu_util_pct}%`, backgroundColor: asset.cpu_util_pct > 80 ? '#f85149' : '#58a6ff' }} />
                        </div>
                        <span className="resource-value-text">{asset.cpu_util_pct}%</span>
                      </div>
                      <div className="resource-bar-row">
                        <span className="resource-label">RAM:</span>
                        <div className="resource-progress-bar">
                          <div className="resource-progress-fill" style={{ width: `${asset.memory_util_pct}%` }} />
                        </div>
                        <span className="resource-value-text">{asset.memory_util_pct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h4 style={{ marginTop: '16px' }}>Local Subnet Allocation (IPAM)</h4>
              <div className="ipam-table-wrapper">
                <table className="ipam-table">
                  <thead>
                    <tr>
                      <th>VLAN / Subnet</th>
                      <th>IP CIDR Block</th>
                      <th>Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchDetail?.subnets?.map((sub, index) => (
                      <tr key={index}>
                        <td>
                          <strong>VLAN {sub.vlan}</strong>
                          <div style={{ fontSize: '10px', color: '#8b949e' }}>{sub.name}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{sub.cidr}</td>
                        <td>{sub.allocated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE SYSLOGS */}
          {activeTab === 'syslogs' && (
            <div className="detail-section">
              <h4>Live Firewall Audit & Device Syslogs</h4>
              <div className="syslog-terminal">
                {(() => {
                  const now = new Date();
                  const tStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
                  const isCongested = nodeData.status === 'CRITICAL' || nodeData.status === 'WARNING';
                  const logs = isCongested ? [
                    `[${tStr}:02] [FW-BLOCK] Client 10.40.10.104 denied connection to domain youtube.com - Rule 'Media-Block'`,
                    `[${tStr}:08] [QOS-DROP] Voice EF Queue conforming, Best Effort buffer overflow - dropping packet`,
                    `[${tStr}:14] [FW-WARN] WAN MPLS Link bandwidth utilization exceeded 80% threshold`,
                    `[${tStr}:22] [FW-ALERT] WORKSTATION-108 active multi-session peer-to-peer download detected`,
                    `[${tStr}:30] [BGP-WARN] Hold timer reduced to 60s for BGP neighbor 10.0.0.1 (Delhi-Hub)`,
                    `[${tStr}:38] [SYS-ERR] Core Firewall CPU utilization spikes to 78% due to active packet inspection`,
                    `[${tStr}:45] [FW-BLOCK] Client 10.40.10.102 denied connection to domain facebook.com - Rule 'Media-Block'`
                  ] : [
                    `[${tStr}:02] [INFO] Primary WAN BGP interface gigabitethernet0/1 active & stable`,
                    `[${tStr}:12] [DHCP] Assigned lease 10.40.10.142 to WORKSTATION-142`,
                    `[${tStr}:20] [FW-INFO] Match rule 'Office-Allow' for client workstation 10.40.10.115`,
                    `[${tStr}:32] [QOS-INFO] Voice EF Queue conforms to SLA thresholds - delay 0.5ms`,
                    `[${tStr}:45] [BGP-INFO] Prefix advertisement fully synchronized with Delhi-Hub AS-65000`
                  ];
                  return logs.map((log, idx) => (
                    <div key={idx} className="syslog-line">{log}</div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* AI Prediction */}
          {prediction && !activeInc && (
            <div className="detail-section prediction-section">
              <h4>AI Prediction Failure Forecast</h4>
              <div className="prediction-card">
                <div className="prediction-issue">
                  <strong>Forecasted Fault:</strong> {prediction.issue}
                </div>
                <div className="prediction-details">
                  <div className="prediction-detail">
                    <span className="label">Confidence:</span>
                    <span className="value">{(prediction.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="prediction-detail">
                    <span className="label">ETA:</span>
                    <span className="value">{prediction.eta_minutes} minutes</span>
                  </div>
                  <div className="prediction-detail">
                    <span className="label">Severity:</span>
                    <span className={`value ${getSeverityClass(prediction.severity)}`}>
                      {prediction.severity}
                    </span>
                  </div>
                </div>
                <div className="prediction-reasoning">
                  <strong>ML Logic Reasoning:</strong> {prediction.reasoning}
                </div>
                {prediction.recommended_actions && (
                  <div className="prediction-actions">
                    <strong>Recommended Actions:</strong>
                    <ul>
                      {prediction.recommended_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Incidents */}
          {incidents.length > 0 && (
            <div className="detail-section">
              <h4>Recent Incidents</h4>
              <div className="incidents-list">
                {incidents.map((incident, index) => (
                  <div key={index} className="incident-item">
                    <div className="incident-header">
                      <span className="incident-id">{incident.id}</span>
                      <span className="incident-type">{incident.type}</span>
                    </div>
                    <div className="incident-status">{incident.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edge Detail View
  if (selectedEdge) {
    const edgeData = selectedEdge.data || selectedEdge;
    const metrics = edgeData.metrics || {};
    const prediction = edgeData.prediction;

    return (
      <div className="detail-panel">
        <div className="detail-header">
          <h3>{edgeData.source || selectedEdge.source} → {edgeData.target || selectedEdge.target}</h3>
          <span className={`status-badge ${getStatusClass(edgeData.status)}`}>
            {edgeData.status || 'UNKNOWN'}
          </span>
        </div>

        <div className="detail-content">
          {/* Basic Information */}
          <div className="detail-section">
            <h4>Link Information</h4>
            <div className="info-row">
              <span className="label">Type:</span>
              <span className="value">{edgeData.type || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="label">Bandwidth:</span>
              <span className="value">{edgeData.bandwidth || 'Unknown'}</span>
            </div>
          </div>

          {/* Current Metrics */}
          <div className="detail-section">
            <h4>Current Metrics</h4>
            <div className="metrics-grid">
              <div className="metric-item">
                <div className="metric-label">Latency</div>
                <div className="metric-value">{metrics.latency_ms || 'N/A'} ms</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Utilization</div>
                <div className="metric-value">{metrics.utilization_pct || 'N/A'}%</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Jitter</div>
                <div className="metric-value">{metrics.jitter_ms || 'N/A'} ms</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Packet Loss</div>
                <div className="metric-value">{metrics.packet_loss_pct || 'N/A'}%</div>
              </div>
            </div>
          </div>

          {/* AI Prediction */}
          {prediction && (
            <div className="detail-section prediction-section">
              <h4>AI Prediction</h4>
              <div className="prediction-card">
                <div className="prediction-issue">
                  <strong>Issue:</strong> {prediction.issue}
                </div>
                <div className="prediction-details">
                  <div className="prediction-detail">
                    <span className="label">Confidence:</span>
                    <span className="value">{(prediction.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="prediction-detail">
                    <span className="label">ETA:</span>
                    <span className="value">{prediction.eta_minutes} minutes</span>
                  </div>
                  <div className="prediction-detail">
                    <span className="label">Severity:</span>
                    <span className={`value ${getSeverityClass(prediction.severity)}`}>
                      {prediction.severity}
                    </span>
                  </div>
                </div>
                <div className="prediction-reasoning">
                  <strong>Reasoning:</strong> {prediction.reasoning}
                </div>
                {prediction.recommended_actions && (
                  <div className="prediction-actions">
                    <strong>Recommended Actions:</strong>
                    <ul>
                      {prediction.recommended_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default DetailPanel;