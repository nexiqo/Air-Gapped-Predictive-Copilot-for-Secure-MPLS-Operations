import { useState, useEffect } from 'react';
import './DetailPanel.css';

function DetailPanel({ selectedNode, selectedEdge, activeIncidents = [], onStepExecute, onResolveIncident }) {
  const [branchDetail, setBranchDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      fetchBranchDetail(selectedNode.id);
    } else {
      setBranchDetail(null);
    }
  }, [selectedNode]);

  const fetchBranchDetail = async (nodeId) => {
    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/branches/${nodeId}`);
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
    const nodeData = { ...(selectedNode.data || selectedNode), ...(branchDetail?.node || {}) };
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

          {/* Basic Information */}
          <div className="detail-section">
            <h4>Basic Information</h4>
            <div className="info-row">
              <span className="label">Type:</span>
              <span className="value">{nodeData.type || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="label">Location:</span>
              <span className="value">{nodeData.location || 'Unknown'}</span>
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
                <div className="metric-label">Packet Loss</div>
                <div className="metric-value">{metrics.packet_loss_pct || 'N/A'}%</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Utilization</div>
                <div className="metric-value">{metrics.utilization_pct || 'N/A'}%</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Jitter</div>
                <div className="metric-value">{metrics.jitter_ms || 'N/A'} ms</div>
              </div>
            </div>
          </div>

          {/* Connected Services */}
          {services.length > 0 && (
            <div className="detail-section">
              <h4>Connected Services</h4>
              <div className="services-list">
                {services.map((service, index) => (
                  <div key={index} className="service-item">
                    <span className="service-label-indicator">LINK</span>
                    {service}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Prediction */}
          {prediction && !activeInc && (
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