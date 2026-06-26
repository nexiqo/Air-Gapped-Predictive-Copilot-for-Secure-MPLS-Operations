import { useState, useEffect } from 'react';
import './Alerts.css';

function AlertsPage({ alerts: propAlerts }) {
  const [localAlerts, setLocalAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    if (!propAlerts || propAlerts.length === 0) {
      fetchAlerts();
    }
  }, [propAlerts, severityFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = severityFilter !== 'all' ? `?severity=${severityFilter}` : '';
      const response = await fetch(`http://127.0.0.1:8000/alerts${params}`);
      if (response.ok) {
        const data = await response.json();
        setLocalAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      default: return 'severity-info';
    }
  };

  const alerts = (propAlerts && propAlerts.length > 0)
    ? propAlerts.filter(a => severityFilter === 'all' || a.severity.toLowerCase() === severityFilter.toLowerCase())
    : localAlerts;

  const isCurrentlyLoading = loading && alerts.length === 0;

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <h2>Active Alerts</h2>
        <div className="filter-controls">
          <select 
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="severity-filter"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>
        </div>
      </div>

      {isCurrentlyLoading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="no-alerts">
          <div className="no-alerts-icon">OK</div>
          <p>No active alerts matching the current filter</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-card ${getSeverityClass(alert.severity)}`}>
              <div className="alert-header">
                <div className="alert-entity">
                  <span className={`alert-status-dot ${alert.severity === 'critical' ? 'critical' : 'warning'}`}>●</span>
                  <span className="entity-name">{alert.entity_name}</span>
                </div>
                <span className={`alert-severity ${getSeverityClass(alert.severity)}`}>
                  {alert.severity.toUpperCase()}
                </span>
              </div>
              <p className="alert-message">{alert.message}</p>
              <div className="alert-timestamp">
                <span className="timestamp-label">DETECTED:</span>
                <span>{alert.timestamp}</span>
              </div>
              
              {alert.metrics && (
                <div className="alert-metrics">
                  {alert.metrics.latency_ms && (
                    <div className="metric-item">
                      <span className="metric-label">Latency:</span>
                      <span className="metric-value">{alert.metrics.latency_ms} ms</span>
                    </div>
                  )}
                  {alert.metrics.utilization_pct && (
                    <div className="metric-item">
                      <span className="metric-label">Utilization:</span>
                      <span className="metric-value">{alert.metrics.utilization_pct}%</span>
                    </div>
                  )}
                  {alert.metrics.packet_loss_pct && (
                    <div className="metric-item">
                      <span className="metric-label">Packet Loss:</span>
                      <span className="metric-value">{alert.metrics.packet_loss_pct}%</span>
                    </div>
                  )}
                </div>
              )}

              {alert.prediction && (
                <div className="alert-prediction">
                  <span className="prediction-badge-label">PREDICTION</span>
                  <div className="prediction-content">
                    <span className="prediction-issue">{alert.prediction.issue}</span>
                    <span className="prediction-details">
                      {(alert.prediction.confidence * 100).toFixed(0)}% confidence, 
                      ETA: {alert.prediction.eta_minutes}min
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AlertsPage;