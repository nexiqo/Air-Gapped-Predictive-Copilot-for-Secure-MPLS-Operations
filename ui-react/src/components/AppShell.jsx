import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import './AppShell.css';

function AppShell({ networkSummary, copilotOpen, onToggleCopilot, children }) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navItems = [
    { path: '/topology', label: 'Topology', icon: '📊' },
    { path: '/overview', label: 'Overview', icon: '🏠' },
    { path: '/branches', label: 'Branches', icon: '🏢' },
    { path: '/alerts', label: 'Alerts', icon: '🚨' },
    { path: '/predictions', label: 'Predictions', icon: '🔮' },
    { path: '/reports', label: 'Reports', icon: '📋' },
    { path: '/copilot', label: 'Copilot', icon: '🤖' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
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
      // Navigate to copilot with the search query
      window.location.href = `/copilot?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="cockpit-header">
        <div className="header-content">
          <div className="header-title">
            <h1>TechCorp India NOC Cockpit</h1>
            <span className="product-version">v1.0.0</span>
          </div>
          
          <div className="header-center">
            <div className="header-badges">
              <span className="status-badge badge-offline">● OFFLINE MODE</span>
              <span className="status-badge badge-simulation">🔄 SIMULATION ACTIVE</span>
              {networkSummary && (
                <>
                  <span className={`status-badge ${getHealthBadgeClass(networkSummary.overall_health)}`}>
                    {networkSummary.overall_health}
                  </span>
                  {networkSummary.most_critical_issue && (
                    <span className="status-badge badge-critical">
                      ⚠ {networkSummary.most_critical_issue.substring(0, 25)}...
                    </span>
                  )}
                  {networkSummary.eta_to_failure > 0 && (
                    <span className="status-badge badge-warning">
                      ⏱ ETA: {networkSummary.eta_to_failure}min
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
              🔍
            </button>
            {searchOpen && (
              <form className="search-bar" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Search or command... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                />
                <button type="submit" className="search-submit">→</button>
              </form>
            )}
          </div>
        </div>
      </header>

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
          <Outlet />
        </main>
      </div>

      {/* Floating Copilot Button */}
      <button 
        className={`copilot-fab ${copilotOpen ? 'open' : ''}`}
        onClick={onToggleCopilot}
        aria-label="Toggle Copilot"
      >
        <span className="fab-icon">{copilotOpen ? '✕' : '🤖'}</span>
        <span className="fab-label">{copilotOpen ? 'Close' : 'Ask Copilot'}</span>
      </button>
    </div>
  );
}

export default AppShell;