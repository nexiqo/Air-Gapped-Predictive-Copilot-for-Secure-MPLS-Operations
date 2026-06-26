import './BottomStrip.css';

function BottomStrip({ networkSummary }) {
  const getHealthColor = (health) => {
    switch (health) {
      case 'CRITICAL': return '#da3633';
      case 'DEGRADED': return '#d29922';
      default: return '#238636';
    }
  };

  if (!networkSummary) {
    return (
      <div className="bottom-strip">
        <div className="strip-item">
          <span className="strip-label">Loading network status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bottom-strip">
      <div className="strip-item">
        <span className="strip-label">Network Health:</span>
        <span 
          className="strip-value" 
          style={{ color: getHealthColor(networkSummary.overall_health) }}
        >
          {networkSummary.overall_health}
        </span>
      </div>

      <div className="strip-item">
        <span className="strip-label">Alerts:</span>
        <span className="strip-value">
          🔴 Critical: {networkSummary.alert_count?.critical || 0}
        </span>
        <span className="strip-value">
          🟡 Warning: {networkSummary.alert_count?.warning || 0}
        </span>
      </div>

      <div className="strip-item">
        <span className="strip-label">Next Failure:</span>
        {networkSummary.eta_to_failure > 0 ? (
          <>
            <span className="strip-value">⏱ {networkSummary.eta_to_failure} minutes</span>
            <span className="strip-value">📊 {(networkSummary.confidence * 100).toFixed(0)}% confidence</span>
          </>
        ) : (
          <span className="strip-value">No immediate failures predicted</span>
        )}
      </div>

      <div className="strip-item">
        <span className="strip-label">At-Risk Branch:</span>
        <span className="strip-value">⚠️ {networkSummary.most_at_risk_branch}</span>
      </div>

      <div className="strip-item">
        <span className="strip-label">Most Critical Issue:</span>
        <span className="strip-value critical-text">{networkSummary.most_critical_issue}</span>
      </div>
    </div>
  );
}

export default BottomStrip;