import { useState, useEffect } from 'react';
import './Reports.css';

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
    
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportData.title}</title>
  <style>
    :root {
      --bg-canvas: #0d1117;
      --bg-overlay: #161b22;
      --bg-subtle: #21262d;
      --border: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-muted: #6e7781;
      --red: #f85149;
      --yellow: #d29922;
      --green: #2ea043;
      --blue: #58a6ff;
      --radius: 6px;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      margin: 0;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .report-container {
      max-width: 850px;
      margin: 0 auto;
      background-color: var(--bg-overlay);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 40px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    .report-header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-weight: bold;
      font-size: 14px;
      color: var(--blue);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 26px;
      margin: 0 0 10px 0;
      color: #ffffff;
      font-weight: 600;
    }
    .report-meta {
      font-size: 13px;
      color: var(--text-muted);
      font-family: monospace;
    }
    h2 {
      font-size: 18px;
      color: #ffffff;
      margin-top: 30px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      font-weight: 600;
    }
    p {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: var(--text-secondary);
    }
    .highlight-box {
      background-color: var(--bg-subtle);
      border-left: 4px solid var(--blue);
      padding: 16px;
      border-radius: 0 var(--radius) var(--radius) 0;
      margin-bottom: 24px;
    }
    .highlight-box p {
      margin: 0;
      color: var(--text-primary);
      font-size: 14px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .metric-card {
      background-color: var(--bg-canvas);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      text-align: center;
    }
    .metric-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      display: block;
      margin-bottom: 6px;
    }
    .metric-value {
      font-size: 18px;
      color: var(--blue);
      font-weight: bold;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }
    th {
      background-color: var(--bg-canvas);
      color: var(--text-muted);
      font-weight: 600;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
    }
    tr:hover {
      background-color: rgba(255, 255, 255, 0.02);
    }
    .badge {
      font-size: 10px;
      font-weight: bold;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      display: inline-block;
    }
    .badge.normal {
      background-color: rgba(46, 160, 67, 0.15);
      color: #56d364;
      border: 1px solid rgba(46, 160, 67, 0.3);
    }
    .badge.warning {
      background-color: rgba(210, 153, 34, 0.15);
      color: #e3b341;
      border: 1px solid rgba(210, 153, 34, 0.3);
    }
    .badge.critical {
      background-color: rgba(248, 81, 73, 0.15);
      color: #ff7b72;
      border: 1px solid rgba(248, 81, 73, 0.3);
    }
    .issue-item {
      background-color: var(--bg-canvas);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      margin-bottom: 12px;
    }
    .issue-title {
      font-weight: 600;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .issue-details {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      gap: 15px;
    }
    ol, ul {
      margin: 0 0 20px 0;
      padding-left: 20px;
      color: var(--text-secondary);
      font-size: 14px;
    }
    li {
      margin-bottom: 8px;
    }
    .tag {
      display: inline-block;
      background-color: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 4px 10px;
      font-size: 11px;
      color: var(--text-secondary);
      margin-right: 8px;
      margin-bottom: 8px;
      font-family: monospace;
    }
    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
        padding: 0;
      }
      .report-container {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
        background-color: #ffffff;
      }
      h1, h2, th {
        color: #000000 !important;
      }
      p, td, li, .report-meta {
        color: #333333 !important;
      }
      .metric-card, .issue-item, .highlight-box {
        border-color: #cccccc !important;
        background-color: #f6f8fa !important;
      }
      .badge.normal {
        border-color: #2e7d32 !important;
        color: #2e7d32 !important;
      }
      .badge.critical {
        border-color: #c62828 !important;
        color: #c62828 !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <div class="logo">ISRO NOC OPERATIONS</div>
      <h1>${reportData.title}</h1>
      <div class="report-meta">Generated at: ${new Date(reportData.generated_at).toLocaleString()} • Scope: Air-Gapped Network</div>
    </div>

    <h2>Executive Summary</h2>
    <div class="highlight-box">
      <p>${reportData.executive_summary}</p>
    </div>

    <h2>Network Health & Metrics</h2>
    <div class="metrics-grid">
      ${Object.entries(reportData.network_health).map(([key, value]) => `
        <div class="metric-card">
          <span class="metric-label">${key.replace(/_/g, ' ')}</span>
          <span class="metric-value">${String(value).toUpperCase()}</span>
        </div>
      `).join('')}
    </div>

    ${reportData.branch_performance && reportData.branch_performance.length > 0 ? `
      <h2>Branch Link Adjacencies</h2>
      <table>
        <thead>
          <tr>
            <th>Branch Router</th>
            <th>BGP Link Status</th>
            <th>Latency (ms)</th>
            ${reportData.branch_performance[0].availability ? '<th>Availability</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${reportData.branch_performance.map(branch => `
            <tr>
              <td style="font-weight: 600; color: #ffffff;">${branch.branch}</td>
              <td>
                <span class="badge ${branch.status.toLowerCase()}">${branch.status}</span>
              </td>
              <td style="font-family: monospace;">${branch.latency_ms} ms</td>
              ${branch.availability ? `<td style="font-family: monospace;">${branch.availability}%</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${reportData.critical_issues && reportData.critical_issues.length > 0 ? `
      <h2>Active Degradation Anomaly Faults</h2>
      <div style="margin-bottom: 24px;">
        ${reportData.critical_issues.map(issue => `
          <div class="issue-item">
            <div class="issue-title">
              <span>${issue.issue}</span>
              <span class="badge ${issue.severity.toLowerCase()}">${issue.severity}</span>
            </div>
            <div class="issue-details">
              <span>Lead Time to Breach: <strong>${issue.eta_minutes} minutes</strong></span>
              ${issue.affected_transactions ? `<span>Impacted Ingress transactions: <strong>${issue.affected_transactions.toLocaleString()}</strong></span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${reportData.predictions && reportData.predictions.length > 0 ? `
      <h2>AI Predictive Anomaly Forecasts</h2>
      <div style="margin-bottom: 24px;">
        ${reportData.predictions.map(pred => `
          <div class="issue-item">
            <div class="issue-title">
              <span>Forecast: ${pred.issue} at ${pred.entity}</span>
              <span class="badge warning">${(pred.confidence * 100).toFixed(0)}% Confidence</span>
            </div>
            <div class="issue-details">
              <span>Estimated Time to Failure: <strong>${pred.eta_minutes} minutes</strong></span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <h2>Urgent Mitigation Recommendations</h2>
    <ol>
      ${reportData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ol>

    <h2>Knowledge Reference Evidence Sources</h2>
    <div style="margin-top: 10px;">
      ${reportData.evidence_sources.map(source => `<span class="tag">${source}</span>`).join('')}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.html`;
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
          Export Report
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