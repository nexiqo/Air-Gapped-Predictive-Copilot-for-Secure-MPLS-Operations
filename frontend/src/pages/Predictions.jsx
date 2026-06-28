import { useState, useEffect } from 'react';
import './Predictions.css';

function PredictionsPage({ topology: propTopology }) {
  const [localTopology, setLocalTopology] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explainabilityData, setExplainabilityData] = useState(null);
  const [mlMetrics, setMlMetrics] = useState(null);
  const [isTraining, setIsTraining] = useState(false);

  const handleTrainModel = async () => {
    setIsTraining(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/ml/train', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMlMetrics(data);
      } else {
        alert("Training failed on the backend server.");
      }
    } catch (e) {
      console.error("Failed to run ML training:", e);
    } finally {
      setIsTraining(false);
    }
  };

  // XAI Playground States
  const [playgroundLatency, setPlaygroundLatency] = useState(15);
  const [playgroundLoss, setPlaygroundLoss] = useState(0.0);
  const [playgroundUtil, setPlaygroundUtil] = useState(30);

  const playgroundProb = Math.min(99.9, Math.max(0.1, (playgroundLatency * 0.3) + (playgroundLoss * 6.5) + (playgroundUtil * 0.4)));

  useEffect(() => {
    if (!propTopology) {
      fetchTopology();
    }
  }, [propTopology]);

  useEffect(() => {
    fetchExplainability();
    fetchMlMetrics();
    const interval = setInterval(fetchExplainability, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const fetchExplainability = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/predictions/explainability');
      if (response.ok) {
        const data = await response.json();
        setExplainabilityData(data);
      }
    } catch (error) {
      console.error('Failed to fetch ML explainability:', error);
    }
  };

  const fetchMlMetrics = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/ml/metrics');
      if (response.ok) {
        const data = await response.json();
        setMlMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch ML metrics:', error);
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

      {/* Real-time Explainable AI (XAI) and Supervised ML Diagnostics */}
      {explainabilityData && (
        <div className="ml-diagnostics-grid">
          <div className="ml-diagnostic-card">
            <h3>Explainable AI (XAI) Model Weights</h3>
            <p className="card-sub">SHAP contribution weights for active failure forecasts (Offline SHAP)</p>
            <div className="weights-list">
              {Object.entries(explainabilityData.feature_importance).map(([feature, weight]) => {
                const pct = Math.min(100, Math.max(5, Math.abs(weight) * 100));
                const isPositive = weight >= 0;
                return (
                  <div key={feature} className="weight-item">
                    <div className="weight-label">
                      <span>{feature.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className={isPositive ? 'weight-pos' : 'weight-neg'}>
                        {isPositive ? '+' : ''}{weight.toFixed(2)}
                      </span>
                    </div>
                    <div className="weight-track">
                      <div 
                        className={`weight-bar ${isPositive ? 'pos' : 'neg'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ml-diagnostic-card">
            <h3>Supervised Failure State Classifier</h3>
            <p className="card-sub">Probability distribution of network incidents (Offline Softmax Inference)</p>
            <div className="classes-list">
              {Object.entries(explainabilityData.class_probabilities).map(([state, prob]) => {
                const pct = prob * 100;
                let colorClass = 'nominal';
                if (state !== 'NOMINAL_OPERATION') {
                  colorClass = pct > 45 ? 'critical' : 'warning';
                }
                return (
                  <div key={state} className="class-item">
                    <div className="class-label">
                      <span>{state.replace(/_/g, ' ')}</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="class-track">
                      <div 
                        className={`class-bar ${colorClass}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive XAI Playground Card */}
          <div className="ml-diagnostic-card">
            <h3>Interactive XAI Playground</h3>
            <p className="card-sub">Manually simulate network parameters to see failure state probability calculation</p>
            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span>LINK LATENCY</span>
                  <span>{playgroundLatency} ms</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="150" 
                  value={playgroundLatency} 
                  onChange={(e) => setPlaygroundLatency(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#58a6ff', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span>PACKET LOSS</span>
                  <span>{playgroundLoss.toFixed(1)} %</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="0.1"
                  value={playgroundLoss} 
                  onChange={(e) => setPlaygroundLoss(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#d29922', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span>BANDWIDTH UTILIZATION</span>
                  <span>{playgroundUtil} %</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  value={playgroundUtil} 
                  onChange={(e) => setPlaygroundUtil(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a371f7', cursor: 'pointer' }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  <span>CLASSIFICATION RESULT</span>
                  <span style={{ color: playgroundProb > 75 ? '#f85149' : playgroundProb > 40 ? '#d29922' : '#3fb950' }}>
                    {playgroundProb > 75 ? 'CRITICAL RISK' : playgroundProb > 40 ? 'ELEVATED RISK' : 'NOMINAL OPERATION'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>Failure Probability:</span>
                  <span>{playgroundProb.toFixed(1)}%</span>
                </div>
                <div className="class-track" style={{ marginTop: '6px' }}>
                  <div 
                    className={`class-bar ${playgroundProb > 75 ? 'critical' : playgroundProb > 40 ? 'warning' : 'nominal'}`}
                    style={{ width: `${playgroundProb}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>          {/* MLOps Operations & Classifier Training Card */}
          <div className="ml-diagnostic-card">
            <h3>Model Operations (MLOps)</h3>
            <p className="card-sub">Supervised Random Forest performance on NOC telemetry</p>
            
            {mlMetrics && mlMetrics.status === "trained" ? (
              <>
                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="metric-box" style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACCURACY</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--green)' }}>{(mlMetrics.accuracy * 100).toFixed(1)}%</div>
                  </div>
                  <div className="metric-box" style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>F1-SCORE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--green)' }}>{mlMetrics.f1_score.toFixed(3)}</div>
                  </div>
                  <div className="metric-box" style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PRECISION</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--green)' }}>{mlMetrics.precision.toFixed(3)}</div>
                  </div>
                  <div className="metric-box" style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RECALL</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--green)' }}>{mlMetrics.recall.toFixed(3)}</div>
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Algorithm:</strong> {mlMetrics.algorithm}</div>
                  <div><strong>Dataset size:</strong> {mlMetrics.training_samples} rows &times; {mlMetrics.feature_count} features</div>
                  <div><strong>Trained at:</strong> {mlMetrics.trained_at}</div>
                </div>
              </>
            ) : (
              <div style={{ margin: '15px 0', padding: '15px', background: 'var(--bg-inset)', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Model metrics not loaded. Classifier running on static fallback rules.
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                  Trigger a live training run to build and save validation metrics.
                </span>
              </div>
            )}
            
            <button 
              className="action-btn" 
              style={{ 
                marginTop: '16px', 
                width: '100%', 
                justifyContent: 'center', 
                backgroundColor: isTraining ? '#1f6feb' : '#238636', 
                border: '1px solid rgba(240,246,252,0.1)',
                color: '#ffffff',
                cursor: isTraining ? 'not-allowed' : 'pointer'
              }}
              onClick={handleTrainModel}
              disabled={isTraining}
            >
              {isTraining ? 'Training Models...' : 'Run ML Training Pipeline'}
            </button>
          </div>
        </div>
      )}

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