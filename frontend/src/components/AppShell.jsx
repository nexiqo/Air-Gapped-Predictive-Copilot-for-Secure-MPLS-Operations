import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './AppShell.css';
import ai4bharatLogo from '../assets/ai4bharat_logo.jpg';

const NAV_ITEMS = [
  { path: '/',             label: 'Overview',     icon: '⊞' },
  { path: '/topology',     label: 'Topology',     icon: '◈' },
  { path: '/branches',     label: 'Branches',     icon: '◑' },
  { path: '/alerts',       label: 'Alerts',       icon: '⚑' },
  { path: '/predictions',  label: 'Predictions',  icon: '◎' },
  { path: '/loop-engine',  label: 'Loop Engine',  icon: '⟳' },
  { path: '/runbooks',     label: 'Runbooks',     icon: '▤' },
  { path: '/reports',      label: 'Reports',      icon: '☰' },
  { path: '/settings',     label: 'Settings',     icon: '⚙' },
];

function AppShell({ networkSummary, currentToast, onCloseToast, onResolveIncident, activeIncidents = [], children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.dispatchEvent(new CustomEvent('copilotQuery', { detail: searchQuery }));
      setSearchQuery('');
    }
  };

  const handleResolveAuto = () => {
    if (currentToast) {
      if (currentToast.type === 'SECURITY_AUDIT') {
        window.dispatchEvent(new CustomEvent('copilotQuery', { 
          detail: `Block and throttle the ${currentToast.appName} abuser on ${currentToast.nodeId}` 
        }));
        onCloseToast();
      } else {
        onResolveIncident(currentToast.id, 'copilot');
        window.dispatchEvent(new CustomEvent('copilotRemediate', {
          detail: { nodeId: currentToast.nodeId, type: currentToast.type, method: 'auto' }
        }));
      }
    }
  };

  const handleResolveManual = () => {
    if (currentToast) {
      window.dispatchEvent(new CustomEvent('selectTopologyNode', { detail: currentToast.nodeId }));
      onCloseToast();
      navigate('/topology');
    }
  };

  const healthBadge = () => {
    const h = networkSummary?.overall_health;
    if (h === 'CRITICAL') return 'hdr-badge-critical';
    if (h === 'DEGRADED') return 'hdr-badge-warning';
    return 'hdr-badge-normal';
  };

  const criticalCount = activeIncidents.filter(i => i.status === 'active' && i.severity === 'critical').length;
  const warningCount  = activeIncidents.filter(i => i.status === 'active' && i.severity !== 'critical').length;

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="app-shell">
      {/* ===== TOP HEADER ===== */}
      <header className="cockpit-header">
        <div className="header-content">
          {/* Logo */}
          <div className="header-logo">
            <div className="header-logo-mark">
              <img src={ai4bharatLogo} alt="AI4Bharat Logo" />
            </div>
            <span className="header-logo-text">NOC Cockpit</span>
            <span className="header-logo-sub">MPLS Operations</span>
          </div>

          {/* Search */}
          <div className="header-center">
            <form className="header-search-box" onSubmit={handleSearch}>
              <span className="header-search-icon">⌕</span>
              <input
                type="text"
                className="header-search-input"
                placeholder="Search or ask the Copilot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="header-search-kbd">/</span>
            </form>
          </div>

          {/* Right: badges + time */}
          <div className="header-right">
            <div className="header-badge-row">
              <span className="hdr-status-badge hdr-badge-offline">AIR-GAPPED</span>
              <span className="hdr-status-badge hdr-badge-sim">LIVE SIM</span>
              {networkSummary && (
                <span className={`hdr-status-badge ${healthBadge()}`}>
                  {networkSummary.overall_health}
                </span>
              )}
              {criticalCount > 0 && (
                <span className="hdr-status-badge hdr-badge-critical">{criticalCount} CRITICAL</span>
              )}
              {warningCount > 0 && (
                <span className="hdr-status-badge hdr-badge-warning">{warningCount} WARNING</span>
              )}
            </div>
            <div className="header-divider" />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{timeStr}</span>
            <div className="header-avatar-btn">NC</div>
          </div>
        </div>
      </header>

      {/* ===== INCIDENT TOAST ===== */}
      {currentToast && (
        <div className={`incident-toast ${currentToast.type === 'SECURITY_AUDIT' ? 'security-toast' : ''}`}>
          <div className="toast-header">
            <span className="toast-severity-dot" />
            <strong className="toast-title">
              {currentToast.type === 'SECURITY_AUDIT' 
                ? '🛡️ SECURITY AUDIT — POLICY DRIFT' 
                : `${currentToast.severity?.toUpperCase()} — ${currentToast.type}`}
            </strong>
            <button className="toast-close" onClick={onCloseToast}>✕</button>
          </div>
          <div className="toast-body">
            {currentToast.type === 'SECURITY_AUDIT' ? (
              <p>Non-business <strong>{currentToast.appName}</strong> detected on site <strong>{currentToast.nodeId?.replace('branch-', '').toUpperCase()}</strong>. Telemetry waste: <strong style={{ color: '#d29922' }}>{currentToast.wasted}</strong>.</p>
            ) : (
              <p>Incident detected on node <strong>{currentToast.nodeId?.replace('branch-', '').toUpperCase()}</strong>. {currentToast.message}</p>
            )}
            <div className="toast-actions">
              {currentToast.type === 'SECURITY_AUDIT' ? (
                <>
                  <button className="toast-btn auto-btn" style={{ background: '#bc8cff15', borderColor: '#bc8cff44', color: '#bc8cff' }} onClick={handleResolveAuto}>
                    Deploy Rate-Limiter QoS
                  </button>
                  <button className="toast-btn manual-btn" onClick={onCloseToast}>Dismiss</button>
                </>
              ) : (
                <>
                  <button className="toast-btn auto-btn" onClick={handleResolveAuto}>Auto-Resolve via Copilot</button>
                  <button className="toast-btn manual-btn" onClick={handleResolveManual}>View in Topology</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="main-layout">
        {/* ===== SIDEBAR ===== */}
        <nav className="nav-rail">
          <div className="nav-items">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const badge = item.path === '/alerts' && (criticalCount + warningCount) > 0 ? (criticalCount + warningCount) : null;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {badge && <span className="nav-badge critical">{badge}</span>}
                </Link>
              );
            })}
          </div>

          <div className="nav-footer">
            <div className="nav-footer-item" onClick={() => window.dispatchEvent(new CustomEvent('copilotQuery', { detail: 'What is the current network health status?' }))}>
              <span style={{ fontSize: 14 }}>◈</span>
              <span>Ask Copilot</span>
            </div>
            <div className="nav-footer-item">
              <span style={{ fontSize: 14 }}>◯</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                {networkSummary ? `${networkSummary.total_nodes || 16} nodes` : 'Loading...'}
              </span>
            </div>
          </div>
        </nav>

        {/* ===== MAIN CONTENT AREA ===== */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;