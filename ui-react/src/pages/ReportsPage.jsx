import { useState, useEffect } from 'react';
import './ReportsPage.css';

function ReportsPage() {
  const [reportType, setReportType] = useState('executive');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport(reportType);
  }, [reportType]);

  const fetchReport = async (type) => {
    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/reports?report_type=${type}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;
    
    const reportText = `
${reportData.title}
Generated: ${reportData.generated_at}

EXECUTIVE SUMMARY
${reportData.executive_summary}

NETWORK HEALTH
${Object.entries(reportData.network_health).map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`).join('\n')}

${reportData.branch_performance && reportData.branch_performance.length > 0 ? `BRANCH PERFORMANCE
${reportData.branch_performance.map(branch => `- ${branch.branch}: ${branch.status} (Latency: ${branch.latency_ms}ms)`).join('\n')}` : ''}

${reportData.critical_issues && reportData.critical_issues.length > 0 ? `CRITICAL ISSUES
${reportData.critical_issues.map(issue => `- ${issue.issue} (Severity: ${issue.severity}, ETA: ${issue.eta_minutes}min)`).join('\n')}` : ''}

${reportData.predictions && reportData.predictions.length > 0 ? `PREDICTIONS
${reportData.predictions.map(pred => `- ${pred.entity}: ${pred.issue} (${(pred.confidence * 100).toFixed(0)}% confidence)`).join('\n')}` : ''}

RECOMMENDATIONS
${reportData.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

EVIDENCE SOURCES
${reportData.evidence_sources.join(', ')}
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h2>Network Reports</h2>
        <button 
          className="export-btn"
          onClick={handleExport}
          disabled={!reportData || loading}
        >
          📥 Export Report
        </button>
      </div>

      <div className="report-controls">
        <div className="report-type-selector">
          <label htmlFor="report-type">Report Type:</label>
          <select 
            id="report-type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="report-select"
          >
            <option value="executive">Executive Summary</option>
            <option value="branch">Branch Performance</option>
            <option value="prediction">Prediction Analysis</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Generating report...</p>
        </div>
      ) : reportData ? (
        <div className="report-content">
          {/* Report Header */}
          <div className="report-header">
            <h3>{reportData.title}</h3>
            <p className="report-generated">Generated: {new Date(reportData.generated_at).toLocaleString()}</p>
          </div>

          {/* Executive Summary */}
          <div className="report-section">
            <h4>Executive Summary</h4>
            <p className="report-text">{reportData.executive_summary}</p>
          </div>

          {/* Network Health */}
          <div className="report-section">
            <h4>Network Health</h4>
            <div className="health-metrics">
              {Object.entries(reportData.network_health).map(([key, value]) => (
                <div key={key} className="health-metric">
                  <span className="metric-label">{key.replace(/_/g, ' ').toUpperCase()}:</span>
                  <span className="metric-value">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Branch Performance */}
          {reportData.branch_performance && reportData.branch_performance.length > 0 && (
            <div className="report-section">
              <h4>Branch Performance</h4>
              <div className="branch-table">
                <table>
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Latency</th>
                      {reportData.branch_performance[0].availability && <th>Availability</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.branch_performance.map((branch, index) => (
                      <tr key={index}>
                        <td>{branch.branch}</td>
                        <td>
                          <span className={`status-badge ${branch.status.toLowerCase()}`}>
                            {branch.status}
                          </span>
                        </td>
                        <td>{branch.latency_ms}ms</td>
                        {branch.availability && <td>{branch.availability}%</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Critical Issues */}
          {reportData.critical_issues && reportData.critical_issues.length > 0 && (
            <div className="report-section">
              <h4>Critical Issues</h4>
              <div className="issues-list">
                {reportData.critical_issues.map((issue, index) => (
                  <div key={index} className="issue-item">
                    <div className="issue-header">
                      <span className="issue-title">{issue.issue}</span>
                      <span className={`issue-severity ${issue.severity.toLowerCase()}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <div className="issue-details">
                      <span>ETA: {issue.eta_minutes} minutes</span>
                      {issue.affected_transactions && (
                        <span>Affected: {issue.affected_transactions.toLocaleString()} transactions</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predictions */}
          {reportData.predictions && reportData.predictions.length > 0 && (
            <div className="report-section">
              <h4>Predictions</h4>
              <div className="predictions-list">
                {reportData.predictions.map((pred, index) => (
                  <div key={index} className="prediction-item">
                    <div className="prediction-entity">{pred.entity}</div>
                    <div className="prediction-details">
                      <span className="prediction-issue">{pred.issue}</span>
                      <span className="prediction-confidence">
                        {(pred.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <span className="prediction-eta">ETA: {pred.eta_minutes} minutes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="report-section">
            <h4>Recommendations</h4>
            <ol className="recommendations-list">
              {reportData.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ol>
          </div>

          {/* Evidence Sources */}
          <div className="report-section">
            <h4>Evidence Sources</h4>
            <div className="evidence-tags">
              {reportData.evidence_sources.map((source, index) => (
                <span key={index} className="evidence-tag">{source}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="no-data">
          <p>No report data available</p>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;