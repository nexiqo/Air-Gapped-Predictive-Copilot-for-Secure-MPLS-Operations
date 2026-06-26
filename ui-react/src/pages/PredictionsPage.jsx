import { useState, useEffect } from 'react';
import './PredictionsPage.css';

function PredictionsPage() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/topology');
      if (response.ok) {
        const data = await response.json();
        const allPredictions = [];
        
        // Get node predictions
        Object.entries(data.nodes).forEach(([nodeId, nodeData]) => {
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
        data.edges.forEach(edge => {
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
        
        // Sort by confidence and ETA
        allPredictions.sort((a, b) => {
          if (b.prediction.confidence !== a.prediction.confidence) {
            return b.prediction.confidence - a.prediction.confidence;
          }
          return a.prediction.eta_minutes - b.prediction.eta_minutes;
        });
        
        setPredictions(allPredictions);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <h2>AI Predictions</h2>
        <div className="predictions-summary">
          <span className="summary-item">
            Total: {predictions.length}
          </span>
          <span className="summary-item">
            High Confidence: {predictions.filter(p => p.prediction.confidence >= 0.8).length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading predictions...</p>
        </div>
      ) : predictions.length === 0 ? (
        <div className="no-predictions">
          <div className="no-predictions-icon">✓</div>
          <p>No active predictions</p>
          <p className="no-predictions-sub">Network is operating normally</p>
        </div>
      ) : (
        <div className="predictions-list">
          {predictions.map((item) => (
            <div key={item.id} className="prediction-card">
              <div className="prediction-header">
                <div className="prediction-entity">
                  <span className="entity-type">{item.type === 'node' ? '📍' : '🔗'}</span>
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