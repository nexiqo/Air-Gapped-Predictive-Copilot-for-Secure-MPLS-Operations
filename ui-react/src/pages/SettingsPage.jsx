import { useState } from 'react';
import './SettingsPage.css';

function SettingsPage() {
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

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    // In a real application, this would save to a backend or local storage
    console.log('Settings saved:', settings);
    alert('Settings saved successfully!');
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
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>System Settings</h2>
        <p>Configure NOC Cockpit behavior and preferences</p>
      </div>

      <div className="settings-content">
        {/* Monitoring Settings */}
        <div className="settings-section">
          <h3>Monitoring Configuration</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <span>Refresh Interval</span>
              <span className="setting-description">How often to fetch new telemetry data (seconds)</span>
            </label>
            <div className="setting-control">
              <input
                type="number"
                min="5"
                max="300"
                value={settings.refreshInterval}
                onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value))}
                className="number-input"
              />
              <span className="unit">seconds</span>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Data Retention</span>
              <span className="setting-description">How long to keep historical data (days)</span>
            </label>
            <div className="setting-control">
              <input
                type="number"
                min="1"
                max="365"
                value={settings.dataRetentionDays}
                onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
                className="number-input"
              />
              <span className="unit">days</span>
            </div>
          </div>
        </div>

        {/* Prediction Settings */}
        <div className="settings-section">
          <h3>AI Prediction Settings</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <span>Enable Predictions</span>
              <span className="setting-description">Allow AI to predict network issues</span>
            </label>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enablePredictions}
                  onChange={(e) => handleSettingChange('enablePredictions', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Prediction Confidence Threshold</span>
              <span className="setting-description">Minimum confidence level to show predictions</span>
            </label>
            <div className="setting-control">
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={settings.predictionThreshold}
                onChange={(e) => handleSettingChange('predictionThreshold', parseFloat(e.target.value))}
                className="range-input"
                disabled={!settings.enablePredictions}
              />
              <span className="unit">{(settings.predictionThreshold * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Alert Settings */}
        <div className="settings-section">
          <h3>Alert Configuration</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <span>Enable Alerts</span>
              <span className="setting-description">Show alerts for network issues</span>
            </label>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableAlerts}
                  onChange={(e) => handleSettingChange('enableAlerts', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Minimum Alert Severity</span>
              <span className="setting-description">Lowest severity level to trigger alerts</span>
            </label>
            <div className="setting-control">
              <select
                value={settings.alertSeverity}
                onChange={(e) => handleSettingChange('alertSeverity', e.target.value)}
                className="select-input"
                disabled={!settings.enableAlerts}
              >
                <option value="critical">Critical Only</option>
                <option value="warning">Warning and Critical</option>
                <option value="normal">All Severities</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="settings-section">
          <h3>System Configuration</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <span>Offline Mode</span>
              <span className="setting-description">Run without external network dependencies</span>
            </label>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableOfflineMode}
                  onChange={(e) => handleSettingChange('enableOfflineMode', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Audit Logging</span>
              <span className="setting-description">Log all operator actions for compliance</span>
            </label>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableAuditLogging}
                  onChange={(e) => handleSettingChange('enableAuditLogging', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Theme</span>
              <span className="setting-description">Visual appearance of the cockpit</span>
            </label>
            <div className="setting-control">
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="select-input"
              >
                <option value="dark">Dark (Mission Control)</option>
                <option value="light">Light</option>
                <option value="high-contrast">High Contrast</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button className="action-btn secondary-btn" onClick={handleReset}>
            Reset to Defaults
          </button>
          <button className="action-btn primary-btn" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;