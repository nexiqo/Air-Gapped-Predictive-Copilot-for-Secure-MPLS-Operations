import { useState, useEffect } from 'react';
import './Predictions.css';

function PredictionsPage({ topology: propTopology }) {
  const [localTopology, setLocalTopology] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propTopology) {
      fetchTopology();
    }
  }, [propTopology]);

  const fetchTopology = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/topology');
      if (response.ok) {
        const data = await response.json();
        setLocalTopology(data);
      }
    } catch (error) {
      console.error('Failed to fetch topology:', error);
    } finally {
      setLoading(false);
    }
  };

  const topology = propTopology || localTopology;
  const allPredictions = [];

  if (topology && topology.nodes) {
    // Get node predictions
    Object.entries(topology.nodes).forEach(([nodeId, nodeData]) => {
      if (nodeData.prediction) {
        allPredictions.push({
          id: nodeId,
          entity: nodeData.name,
          type: 'node',
          prediction: nodeData.prediction,
          currentStatus: nodeData.status,
          metrics: nodeData.metrics
        });
      }
    });
    
    // Get edge predictions
    if (topology.edges) {
      topology.edges.forEach(edge => {
        if (edge.prediction) {
          allPredictions.push({
            id: edge.id,
            entity: `${edge.source} → ${edge.target}`,
            type: 'edge',
            prediction: edge.prediction,
            currentStatus: edge.status,
            metrics: edge.metrics
          });
        }
      });
    }

    // Sort by confidence and ETA
    allPredictions.sort((a, b) => {
      if (b.prediction.confidence !== a.prediction.confidence) {
        return b.prediction.confidence - a.prediction.confidence;
      }
      return a.prediction.eta_minutes - b.prediction.eta_minutes;
    });
  }

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'high': return 'severity-high';
      case 'critical': return 'severity-critical';
      case 'medium': return 'severity-medium';
      default: return 'severity-low';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#da3633';
    if (confidence >= 0.6) return '#d29922';
    return '#238636';
  };

  const isCurrentlyLoading = loading && allPredictions.length === 0;

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <h2>AI Predictions</h2>
        <div className="predictions-summary">
          <span className="summary-item">
            Total: {allPredictions.length}
          </span>
          <span className="summary-item">
            High Confidence: {allPredictions.filter(p => p.prediction.confidence >= 0.8).length}
          </span>
        </div>
      </div>

      {isCurrentlyLoading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading predictions...</p>
        </div>
      ) : allPredictions.length === 0 ? (
        <div className="no-predictions">
          <div className="no-predictions-icon">OK</div>
          <p>No active predictions</p>
          <p className="no-predictions-sub">Network is operating normally</p>
        </div>
      ) : (
        <div className="predictions-list">
          {allPredictions.map((item) => (
            <div key={item.id} className="prediction-card">
              <div className="prediction-header">
                <div className="prediction-entity">
                  <span className="entity-type-badge">{item.type.toUpperCase()}</span>
                  <span className="entity-name">{item.entity}</span>
                </div>
                <div className="prediction-meta">
                  <span 
                    className="confidence-badge"
                    style={{ 
                      backgroundColor: getConfidenceColor(item.prediction.confidence),
                      color: '#ffffff'
                    }}
                  >
                    {(item.prediction.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>

              <div className="prediction-body">
                <div className="prediction-issue">
                  <span className="issue-label">Predicted Issue:</span>
                  <span className="issue-value">{item.prediction.issue}</span>
                </div>

                <div className="prediction-details">
                  <div className="detail-item">
                    <span className="detail-label">ETA:</span>
                    <span className="detail-value">{item.prediction.eta_minutes} minutes</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Severity:</span>
                    <span className={`detail-value ${getSeverityClass(item.prediction.severity)}`}>
                      {item.prediction.severity}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Current Status:</span>
                    <span className="detail-value">{item.currentStatus}</span>
                  </div>
                </div>

                <div className="prediction-reasoning">
                  <span className="reasoning-label">Reasoning:</span>
                  <p className="reasoning-text">{item.prediction.reasoning}</p>
                </div>

                {item.prediction.recommended_actions && (
                  <div className="prediction-actions">
                    <span className="actions-label">Recommended Actions:</span>
                    <ul className="actions-list">
                      {item.prediction.recommended_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.metrics && (
                  <div className="current-metrics">
                    <span className="metrics-label">Current Metrics:</span>
                    <div className="metrics-grid">
                      {item.metrics.latency_ms && (
                        <div className="metric-item">
                          <span className="metric-label">Latency:</span>
                          <span className="metric-value">{item.metrics.latency_ms}ms</span>
                        </div>
                      )}
                      {item.metrics.utilization_pct && (
                        <div className="metric-item">
                          <span className="metric-label">Utilization:</span>
                          <span className="metric-value">{item.metrics.utilization_pct}%</span>
                        </div>
                      )}
                      {item.metrics.packet_loss_pct && (
                        <div className="metric-item">
                          <span className="metric-label">Packet Loss:</span>
                          <span className="metric-value">{item.metrics.packet_loss_pct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PredictionsPage;