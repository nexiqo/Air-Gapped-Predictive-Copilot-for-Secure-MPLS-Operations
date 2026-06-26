import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopologyCanvas from '../components/TopologyCanvas';
import DetailPanel from '../components/DetailPanel';
import CopilotPanel from '../components/CopilotPanel';
import BottomStrip from '../components/BottomStrip';
import './TopologyPage.css';

function TopologyPage({ selectedNode, selectedEdge, onNodeSelect, onEdgeSelect, copilotOpen }) {
  const navigate = useNavigate();
  const [networkSummary, setNetworkSummary] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    type: 'all',
    showPredictions: true,
    showLabels: true
  });

  useEffect(() => {
    fetchNetworkSummary();
  }, []);

  const fetchNetworkSummary = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/summary');
      if (response.ok) {
        const data = await response.json();
        setNetworkSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch network summary:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      severity: 'all',
      type: 'all',
      showPredictions: true,
      showLabels: true
    });
  };

  return (
    <div className="topology-page">
      <div className="topology-header">
        <div className="header-left">
          <h2>Network Topology</h2>
          <p className="header-subtitle">Real-time network graph visualization</p>
        </div>
        <div className="topology-controls">
          <button className="control-btn" onClick={() => navigate('/overview')}>
            🏠 Overview
          </button>
          <button className="control-btn" onClick={() => navigate('/branches')}>
            🏢 Branches
          </button>
          <button className="control-btn" onClick={() => navigate('/alerts')}>
            🚨 Alerts
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="filter-group">
          <label className="filter-label">Severity:</label>
          <select 
            value={filters.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Type:</label>
          <select 
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="HUB">Hub</option>
            <option value="BRANCH">Branch</option>
            <option value="DATACENTER">Data Center</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.showPredictions}
              onChange={(e) => handleFilterChange('showPredictions', e.target.checked)}
            />
            <span>Show Predictions</span>
          </label>
        </div>

        <div className="filter-group">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.showLabels}
              onChange={(e) => handleFilterChange('showLabels', e.target.checked)}
            />
            <span>Show Labels</span>
          </label>
        </div>

        <button className="filter-reset-btn" onClick={resetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="topology-layout">
        {/* Main Topology Canvas */}
        <div className="topology-main">
          <TopologyCanvas 
            onNodeSelect={onNodeSelect}
            onEdgeSelect={onEdgeSelect}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            filters={filters}
          />
        </div>

        {/* Right Detail Panel */}
        <div className="topology-details">
          <DetailPanel 
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
          />
        </div>
      </div>

      {/* Bottom Event/Metrics Strip */}
      <BottomStrip networkSummary={networkSummary} />

      {/* Copilot Panel */}
      {copilotOpen && (
        <CopilotPanel 
          onClose={() => navigate('/copilot')}
        />
      )}
    </div>
  );
}

export default TopologyPage;