import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './OverviewPage.css';

function OverviewPage({ networkSummary }) {
  const navigate = useNavigate();
  const [topology, setTopology] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      const [topologyResponse, alertsResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/topology'),
        fetch('http://127.0.0.1:8000/alerts')
      ]);

      if (topologyResponse.ok) {
        const data = await topologyResponse.json();
        setTopology(data);
      }

      if (alertsResponse.ok) {
        const data = await alertsResponse.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch overview data:', error);
    }
  };

  const getHealthBadgeClass = (health) => {
    switch (health) {
      case 'CRITICAL': return 'badge-critical';
      case 'DEGRADED': return 'badge-warning';
      default: return 'badge-normal';
    }
  };

  return (
    <div className="overview-page">
      <div className="overview-header">
        <h2>Shift Overview</h2>
        <button className="action-btn" onClick={() => navigate('/topology')}>
          View Topology
        </button>
      </div>

      {networkSummary && (
        <div className="overview-grid">
          {/* Global Risk Summary */}
          <div className="overview-card">
            <h3>Network Health</h3>
            <div className="health-display">
              <span className={`health-badge ${getHealthBadgeClass(networkSummary.overall_health)}`}>
                {networkSummary.overall_health}
              </span>
            </div>
            <div className="health-details">
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
              <div className="detail-item">
                <span className="label">Normal:</span>
                <span className="value normal">{networkSummary.normal_nodes}</span>
              </div>
            </div>
          </div>

          {/* Most Critical Issue */}
          <div className="overview-card critical-card">
            <h3>Most Critical Issue</h3>
            <div className="critical-content">
              <span className="critical-icon">⚠️</span>
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
              <span className="warning-icon">🏢</span>
              <div className="warning-text">
                <p className="branch-name">{networkSummary.most_at_risk_branch}</p>
                <p className="next-failure">Next: {networkSummary.next_likely_failure}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      <div className="overview-section">
        <h3>Recent Alerts</h3>
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

      {/* Quick Actions */}
      <div className="overview-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => navigate('/topology')}>
            📊 View Topology
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/branches')}>
            🏢 Check Branches
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/alerts')}>
            🚨 View Alerts
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/predictions')}>
            🔮 See Predictions
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/reports')}>
            📋 Generate Reports
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverviewPage;