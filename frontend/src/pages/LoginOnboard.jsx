import { useState } from 'react';
import './LoginOnboard.css';

export default function LoginOnboard({ onLoginSuccess }) {
  const [operatorId, setOperatorId] = useState('ISRO-NOC-77');
  const [passkey, setPasskey] = useState('isronoc2026');
  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!operatorId.trim()) {
      setErrorMsg('Operator ID is required.');
      setStatus('error');
      return;
    }
    if (passkey !== 'isronoc2026') {
      setErrorMsg('Invalid Security Passkey. Hint: isronoc2026');
      setStatus('error');
      return;
    }

    setStatus('scanning');
    setErrorMsg('');

    // Simulate scanning network clearance levels
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => {
        localStorage.setItem('isro-noc-auth', 'true');
        onLoginSuccess();
      }, 1000);
    }, 1500);
  };

  return (
    <div className="login-wrapper">
      {/* Dynamic particles or telemetry grid in background */}
      <div className="login-mesh-bg" />
      <div className="login-grid-overlay" />

      <div className="login-card">
        {/* Scanning beam overlay during authorization */}
        {status === 'scanning' && <div className="scanning-beam" />}

        <div className="login-header">
          <div className="isro-logo-placeholder">
            <span className="logo-text">ISRO</span>
            <span className="logo-sub">NOC</span>
          </div>
          <h2>NOC OPERATIONS PORTAL</h2>
          <p className="login-subtitle">Air-Gapped Predictive Copilot Gateway</p>
        </div>

        {status === 'scanning' ? (
          <div className="scanning-content">
            <div className="scanner-circle">
              <div className="scanner-inner" />
            </div>
            <p className="scan-status-text">DECRYPTING SECURITY TOKEN...</p>
            <p className="scan-sub-text">Clearing Level-4 operator clearance... status: STABLE</p>
          </div>
        ) : status === 'success' ? (
          <div className="success-content">
            <div className="success-icon">✓</div>
            <p className="success-status-text">AUTHENTICATION GRANTED</p>
            <p className="success-sub-text">Redirecting to Secure MPLS Operator Cockpit...</p>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="operator-id">Operator ID</label>
              <input
                id="operator-id"
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                placeholder="e.g. ISRO-NOC-77"
                disabled={status === 'scanning'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="passkey">Security Passkey</label>
              <input
                id="passkey"
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter passkey"
                disabled={status === 'scanning'}
              />
              <span className="passkey-hint">Hint: Use pre-filled passkey <strong>isronoc2026</strong></span>
            </div>

            {status === 'error' && (
              <div className="login-error-msg">
                <span className="error-icon">✕</span> {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={status === 'scanning'}
            >
              Authorize Clearance
            </button>
          </form>
        )}

        <div className="login-footer">
          <div className="security-badge">
            <span className="badge-dot" /> SECURE SSL TUNNEL &bull; AIR-GAPPED ENVIRONMENT
          </div>
        </div>
      </div>
    </div>
  );
}
