import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './AppShell.css';

function AppShell({ networkSummary, currentToast, onCloseToast, onResolveIncident, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navItems = [
    { path: '/', label: 'Overview', icon: '■' },
    { path: '/topology', label: 'Topology', icon: '■' },
    { path: '/branches', label: 'Branches', icon: '■' },
    { path: '/alerts', label: 'Alerts', icon: '■' },
    { path: '/predictions', label: 'Predictions', icon: '■' },
    { path: '/reports', label: 'Reports', icon: '■' },
    { path: '/settings', label: 'Settings', icon: '■' },
  ];

  const getHealthBadgeClass = (health) => {
    switch (health) {
      case 'CRITICAL': return 'badge-critical';
      case 'DEGRADED': return 'badge-warning';
      default: return 'badge-normal';
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Dispatch search query via custom event to the CopilotWidget
      const event = new CustomEvent('copilotQuery', { detail: searchQuery });
      window.dispatchEvent(event);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const handleResolveAuto = () => {
    if (currentToast) {
      onResolveIncident(currentToast.id, 'copilot');
      // Dispatch custom event to notify CopilotWidget to print logs
      window.dispatchEvent(new CustomEvent('copilotRemediate', { 
        detail: { nodeId: currentToast.nodeId, type: currentToast.type, method: 'auto' } 
      }));
    }
  };

  const handleResolveManual = () => {
    if (currentToast) {
      // Select node in topology map
      window.dispatchEvent(new CustomEvent('selectTopologyNode', { detail: currentToast.nodeId }));
      onCloseToast();
      navigate('/topology');
    }
  };

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="cockpit-header">
        <div className="header-content">
          <div className="header-title">
            <h1>NOC Cockpit</h1>
            <span className="product-version">Enterprise Operations</span>
          </div>
          
          <div className="header-center">
            <div className="header-badges">
              <span className="status-badge badge-offline">OFFLINE</span>
              <span className="status-badge badge-simulation">SIMULATION ACTIVE</span>
              {networkSummary && (
                <>
                  <span className={`status-badge ${getHealthBadgeClass(networkSummary.overall_health)}`}>
                    {networkSummary.overall_health}
                  </span>
                  {networkSummary.most_critical_issue && (
                    <span className="status-badge badge-critical">
                      CRITICAL: {networkSummary.most_critical_issue.substring(0, 30)}...
                    </span>
                  )}
                  {networkSummary.eta_to_failure > 0 && (
                    <span className="status-badge badge-warning">
                      ETA: {networkSummary.eta_to_failure} min
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="header-actions">
            <button 
              className="search-toggle-btn"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Global Search"
            >
              SEARCH
            </button>
            {searchOpen && (
              <form className="search-bar" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Query Copilot..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                />
                <button type="submit" className="search-submit">GO</button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Incident Warning Toast Center Overlay */}
      {currentToast && (
        <div className="incident-toast">
          <div className="toast-header">
            <span className="toast-severity-dot">●</span>
            <strong className="toast-title">{currentToast.severity} ALERT: {currentToast.type}</strong>
            <button className="toast-close" onClick={onCloseToast}>✕</button>
          </div>
          <div className="toast-body">
            <p>{currentToast.message} on node {currentToast.nodeId.replace('branch-', '').toUpperCase()}</p>
            <div className="toast-actions">
              <button className="toast-btn auto-btn" onClick={handleResolveAuto}>
                Auto-Resolve via Copilot
              </button>
              <button className="toast-btn manual-btn" onClick={handleResolveManual}>
                Resolve Manually
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="main-layout">
        {/* Left Navigation Rail */}
        <nav className="nav-rail">
          <div className="nav-items">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;