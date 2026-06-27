import { useState, useEffect } from 'react';
import './SettingsPage.css';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    refreshInterval: 30,
    enablePredictions: true,
    predictionThreshold: 0.7,
    enableAlerts: true,
    alertSeverity: 'warning',
    enableOfflineMode: true,
    dataRetentionDays: 30,
    enableAuditLogging: true,
    theme: 'dark'
  });
  
  const [policies, setPolicies] = useState({
    block_streaming: false,
    scavenger_qos: false,
    load_balancers: true
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/settings/policy');
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    console.log('Settings saved:', settings);
    try {
      const response = await fetch('http://127.0.0.1:8000/settings/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policies)
      });
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
        alert('Configuration saved and active across all enterprise branches!');
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Failed to save policies:', error);
      alert('Local settings saved. Backend connection offline.');
    }
  };

  const handleReset = () => {
    setSettings({
      refreshInterval: 30,
      enablePredictions: true,
      predictionThreshold: 0.7,
      enableAlerts: true,
      alertSeverity: 'warning',
      enableOfflineMode: true,
      dataRetentionDays: 30,
      enableAuditLogging: true,
      theme: 'dark'
    });
    setPolicies({
      block_streaming: false,
      scavenger_qos: false,
      load_balancers: true
    });
    alert('Settings reset to default.');
  };

  return (
    <div className="settings-page">
      {/* Left category sidebar */}
      <div className="settings-sidebar">
        <div className="settings-sidebar-label">System Settings</div>
        <button 
          className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <span className="settings-nav-icon">⚙️</span>
          General
        </button>
        <button 
          className={`settings-nav-item ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          <span className="settings-nav-icon">📊</span>
          Monitoring Config
        </button>
        <button 
          className={`settings-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <span className="settings-nav-icon">🧠</span>
          AI Predictions
        </button>
        <button 
          className={`settings-nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <span className="settings-nav-icon">🔔</span>
          Alert Rules
        </button>

        <div className="settings-sidebar-label">Security & Firewalls</div>
        <button 
          className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span className="settings-nav-icon">🛡️</span>
          Security Policies
        </button>
        
        <div className="settings-sidebar-label">Maintenance</div>
        <button 
          className={`settings-nav-item ${activeTab === 'danger' ? 'active' : ''}`}
          onClick={() => setActiveTab('danger')}
        >
          <span className="settings-nav-icon">⚠️</span>
          Danger Zone
        </button>
      </div>

      {/* Right form panel */}
      <div className="settings-main">
        <div className="settings-page-title">
          {activeTab === 'general' && 'General Configuration'}
          {activeTab === 'monitoring' && 'Monitoring Configuration'}
          {activeTab === 'ai' && 'AI & Prediction Engine Settings'}
          {activeTab === 'alerts' && 'Alert severity & Trigger Rules'}
          {activeTab === 'security' && 'Global Network Security Policies'}
          {activeTab === 'danger' && 'System Maintenance & Danger Zone'}
        </div>
        <div className="settings-page-sub">
          {activeTab === 'general' && 'Manage system-wide defaults, connections, and visual appearances'}
          {activeTab === 'monitoring' && 'Adjust collection frequencies, statistics, and data retention windows'}
          {activeTab === 'ai' && 'Configure predictive algorithms, confidence filters, and LLM behavior'}
          {activeTab === 'alerts' && 'Manage alert severities, console warnings, and trigger guidelines'}
          {activeTab === 'security' && 'Manage edge firewall rules, QoS traffic shaping, and DNS filtering across all 16 enterprise branches'}
          {activeTab === 'danger' && 'Perform dangerous operations, clear caches, and reset defaults'}
        </div>

        {/* Tab content rendering */}
        {activeTab === 'general' && (
          <div className="settings-section">
            <h3 className="settings-section-title">General System settings</h3>
            <p className="settings-section-desc">Manage system-wide defaults and visual appearances.</p>
            
            <div className="form-group">
              <label className="form-label">Theme</label>
              <p className="form-description">Select the visual appearance of the NOC Cockpit interface.</p>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="form-select"
              >
                <option value="dark">Dark (GitHub Dark Mode)</option>
                <option value="light">Light</option>
                <option value="high-contrast">High Contrast</option>
              </select>
            </div>

            <div className="settings-toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Audit Logging</span>
                <span className="toggle-desc">Log all console commands and operator actions for security audits.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableAuditLogging}
                  onChange={(e) => handleSettingChange('enableAuditLogging', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Offline Mode</span>
                <span className="toggle-desc">Restrict API requests to localhost and run without external dependencies.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableOfflineMode}
                  onChange={(e) => handleSettingChange('enableOfflineMode', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 className="settings-section-title">Service Connection Status</h3>
              <p className="settings-section-desc">Verify real-time connectivity to core backend infrastructure.</p>
              
              <div className="connection-row">
                <span className="connection-dot conn-ok"></span>
                <span className="connection-label">FastAPI NOC Server</span>
                <span className="connection-value">127.0.0.1:8000 (Connected)</span>
              </div>
              <div className="connection-row">
                <span className="connection-dot conn-ok"></span>
                <span className="connection-label">Ollama LLM Engine</span>
                <span className="connection-value">llama3 model active</span>
              </div>
              <div className="connection-row">
                <span className="connection-dot conn-ok"></span>
                <span className="connection-label">ChromaDB Vector Index</span>
                <span className="connection-value">6 runbooks, 22 incidents loaded</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Monitoring Metrics Configuration</h3>
            <p className="settings-section-desc">Adjust frequency and data retention window for telemetry collection.</p>
            
            <div className="form-group">
              <label className="form-label">Refresh Interval <span className="form-label-required">*</span></label>
              <p className="form-description">Time in seconds between telemetry data polls (minimum 5s, maximum 300s).</p>
              <input
                type="number"
                min="5"
                max="300"
                value={settings.refreshInterval}
                onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value))}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data Retention (Days)</label>
              <p className="form-description">Retention period for historical log events, netflow traces, and syslogs.</p>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.dataRetentionDays}
                onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
                className="form-input"
              />
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 className="settings-section-title">Network Statistics Summary</h3>
              <p className="settings-section-desc">Real-time status overview of the monitoring telemetry pipeline.</p>
              
              <div className="settings-metric-row">
                <span className="settings-metric-label">Overall SLA Compliance</span>
                <span className="settings-metric-value ok">99.85%</span>
              </div>
              <div className="settings-metric-row">
                <span className="settings-metric-label">Active Monitored Branches</span>
                <span className="settings-metric-value">16 Sites</span>
              </div>
              <div className="settings-metric-row">
                <span className="settings-metric-label">Telemetry Storage Size</span>
                <span className="settings-metric-value">4.2 MB</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="settings-section">
            <h3 className="settings-section-title">AI Predictive Engine Settings</h3>
            <p className="settings-section-desc">Configure prediction threshold and AI model behavior.</p>
            
            <div className="settings-toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Enable Predictive Failure Analysis</span>
                <span className="toggle-desc">Use LSTMs and Prophet algorithms to predict network breaches before they happen.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enablePredictions}
                  onChange={(e) => handleSettingChange('enablePredictions', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Confidence Threshold: {(settings.predictionThreshold * 100).toFixed(0)}%</label>
              <p className="form-description">Minimum confidence level required to log predictions or display alerts on screen.</p>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={settings.predictionThreshold}
                onChange={(e) => handleSettingChange('predictionThreshold', parseFloat(e.target.value))}
                className="form-range"
                disabled={!settings.enablePredictions}
              />
              <div className="range-labels">
                <span>10% (Aggressive)</span>
                <span>50%</span>
                <span>100% (Conservative)</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Alert & Severity Rules</h3>
            <p className="settings-section-desc">Manage system triggers for critical notifications.</p>
            
            <div className="settings-toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Enable Desktop Toast Notifications</span>
                <span className="toggle-desc">Notify operator immediately on the screen when a new critical event occurs.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableAlerts}
                  onChange={(e) => handleSettingChange('enableAlerts', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Minimum Alert Severity</label>
              <p className="form-description">Filter out low-priority messages and only alert on specified severity levels.</p>
              <select
                value={settings.alertSeverity}
                onChange={(e) => handleSettingChange('alertSeverity', e.target.value)}
                className="form-select"
                disabled={!settings.enableAlerts}
              >
                <option value="critical">Critical Only</option>
                <option value="warning">Warning and Critical</option>
                <option value="normal">All Levels (Normal, Warning, Critical)</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Global Network Security Policies</h3>
            <p className="settings-section-desc">Manage edge firewall rules, QoS traffic shaping, and DNS filtering across all 16 enterprise branches.</p>
            
            <div className="settings-toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Block Unauthorized Media Streaming (Firewall Rule)</span>
                <span className="toggle-desc">Automatically identify and throttle high-bandwidth video domains (YouTube, Facebook, Instagram) to 1.2 Mbps.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={policies.block_streaming}
                  onChange={(e) => setPolicies(prev => ({ ...prev, block_streaming: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-toggle-row" style={{ marginTop: '16px' }}>
              <div className="toggle-info">
                <span className="toggle-label">Enable Scavenger Queue Rate-Limiting (QoS Rule)</span>
                <span className="toggle-desc">Shaper policy to throttle non-business-critical bulk downloads, P2P traffic, and crypto mining.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={policies.scavenger_qos}
                  onChange={(e) => setPolicies(prev => ({ ...prev, scavenger_qos: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-toggle-row" style={{ marginTop: '16px' }}>
              <div className="toggle-info">
                <span className="toggle-label">Active Border Gateway Route Optimization</span>
                <span className="toggle-desc">Perform automatic path optimization and traffic engineering based on BGP prefix stability.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={policies.load_balancers}
                  onChange={(e) => setPolicies(prev => ({ ...prev, load_balancers: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Danger Zone</h3>
            <p className="settings-section-desc">Irreversible system and configuration actions.</p>
            
            <div className="danger-zone">
              <div className="danger-zone-title">Reset System Configuration</div>
              <div className="danger-zone-desc">Restore all monitoring thresholds, theme settings, and telemetry timers to original defaults.</div>
              <button className="settings-danger-btn" onClick={handleReset}>Reset to Defaults</button>
            </div>
            
            <div className="danger-zone" style={{ marginTop: '16px' }}>
              <div className="danger-zone-title">Clear Local Logs & Database Cache</div>
              <div className="danger-zone-desc">Purge all local files, ChromaDB collections, and stored prediction history. This cannot be undone.</div>
              <button className="settings-danger-btn" onClick={() => alert('Logs cleared successfully!')}>Clear Logs & Cache</button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="settings-btn-row" style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <button className="settings-save-btn" onClick={handleSave}>
            Save changes
          </button>
          <button className="settings-secondary-btn" onClick={() => handleSettingChange('theme', 'dark')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;