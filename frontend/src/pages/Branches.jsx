import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Branches.css';

function BranchesPage({ branches: propBranches, onNodeSelect }) {
  const navigate = useNavigate();
  const [localBranches, setLocalBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedBranchId, setExpandedBranchId] = useState(null);
  const [expandedBranchData, setExpandedBranchData] = useState(null);
  const [fetchingBranchId, setFetchingBranchId] = useState(null);
  const [maintenanceNodes, setMaintenanceNodes] = useState([]);

  const BRANCH_ROLES = {
    "hub-delhi": "Corporate Operations Headquarters",
    "dc-mumbai": "Primary Enterprise Data Center",
    "branch-bengaluru": "Zoho R&D Development Center",
    "branch-chennai": "Enterprise Product Engineering Hub",
    "branch-hyderabad": "Cloud Security Operations Center",
    "branch-pune": "ZF Smart Manufacturing Plant",
    "branch-ahmedabad": "Advanced IoT CNC Foundry",
    "branch-kolkata": "Regional Supply Chain Headquarters",
    "branch-bhubaneswar": "Automated Logistics Hub",
    "branch-guwahati": "North-East Operations Terminal",
    "branch-chandigarh": "Regional Sales & Executive Hub",
    "branch-jaipur": "Satellite Dev & QA Outpost",
    "branch-lucknow": "Billing & Customer Operations Hub",
    "branch-kochi": "Zoho Tenkasi R&D Center",
    "branch-nagpur": "Central RFID Supply Chain Hub",
    "branch-bhopal": "Central IoT Inventory Depot"
  };

  const branches = (propBranches && propBranches.length > 0) ? propBranches : localBranches;

  useEffect(() => {
    if (!propBranches || propBranches.length === 0) {
      fetchBranches();
    }
  }, [propBranches]);

  useEffect(() => {
    fetchMaintenanceNodes();
  }, []);

  const fetchMaintenanceNodes = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/settings/policy');
      if (response.ok) {
        const data = await response.json();
        setMaintenanceNodes(data.maintenance_nodes || []);
      }
    } catch (error) {
      console.error('Failed to fetch maintenance nodes:', error);
    }
  };

  const handleToggleMaintenance = async (branchId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/branches/${branchId}/maintenance`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setMaintenanceNodes(data.maintenance_nodes || []);
        fetchBranches();
      }
    } catch (error) {
      console.error('Failed to toggle maintenance window:', error);
    }
  };

  useEffect(() => {
    if (!expandedBranchId) return;
    
    const currentBranch = branches.find(b => b.id === expandedBranchId);
    const status = currentBranch?.status || 'NORMAL';
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/branches/${expandedBranchId}?status=${status}`);
        if (response.ok) {
          const data = await response.json();
          setExpandedBranchData(data);
        }
      } catch (error) {
        console.error('Failed to poll expanded branch detail:', error);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [expandedBranchId, propBranches, localBranches]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/branches');
      if (response.ok) {
        const data = await response.json();
        setLocalBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandBranch = async (branchId, status) => {
    if (expandedBranchId === branchId) {
      setExpandedBranchId(null);
      setExpandedBranchData(null);
      return;
    }
    
    setExpandedBranchId(branchId);
    setFetchingBranchId(branchId);
    setExpandedBranchData(null);
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/branches/${branchId}?status=${status}`);
      if (response.ok) {
        const data = await response.json();
        setExpandedBranchData(data);
      }
    } catch (error) {
      console.error('Failed to fetch expanded branch detail:', error);
    } finally {
      setFetchingBranchId(null);
    }
  };

  const getStatusClass = (status, branchId) => {
    if (maintenanceNodes.includes(branchId)) return 'status-maintenance';
    switch (status) {
      case 'CRITICAL': return 'status-critical';
      case 'WARNING': return 'status-warning';
      default: return 'status-normal';
    }
  };

  const handleViewDetails = (branchId) => {
    onNodeSelect?.({ id: branchId });
    navigate('/topology');
  };

  const isCurrentlyLoading = loading && branches.length === 0;

  return (
    <div className="branches-page">
      <div className="branches-header">
        <h2>Branch Overview</h2>
        <button className="action-btn" onClick={() => navigate('/topology')}>
          View Topology
        </button>
      </div>

      {isCurrentlyLoading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading branches...</p>
        </div>
      ) : (
        <div className="branches-grid">
          {branches.map((branch) => (
            <div key={branch.id} className="branch-card-container">
              <div 
                className={`branch-card ${expandedBranchId === branch.id ? 'expanded-header' : ''}`}
                onClick={() => toggleExpandBranch(branch.id, branch.status)}
                style={{ cursor: 'pointer' }}
              >
                <div className="branch-header">
                  <h3>{branch.name}</h3>
                  <span className={`status-badge ${getStatusClass(branch.status, branch.id)}`}>
                    {maintenanceNodes.includes(branch.id) ? 'MAINTENANCE' : branch.status}
                  </span>
                </div>
                <div className="branch-info">
                  <p className="branch-location">{branch.location}</p>
                  <p className="branch-role" style={{ color: '#58a6ff', fontSize: '0.72rem', fontWeight: 600 }}>
                    {BRANCH_ROLES[branch.id] || 'Edge Operations Node'}
                  </p>
                </div>
                <div className="branch-roster-summary">
                  <div className="roster-item">
                    <span className="roster-label">Employees:</span>
                    <span className="roster-value">{branch.users || 120}</span>
                  </div>
                  <div className="roster-item">
                    <span className="roster-label">Computers:</span>
                    <span className="roster-value">{branch.computers || 102}</span>
                  </div>
                </div>
                <div className="branch-metrics">
                  <div className="metric">
                    <span className="metric-label">Latency:</span>
                    <span className="metric-value">{branch.latency_ms}ms</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Loss:</span>
                    <span className="metric-value">{branch.packet_loss_pct}%</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Util:</span>
                    <span className="metric-value">{branch.utilization_pct}%</span>
                  </div>
                </div>
                {branch.has_prediction && (
                  <div className="branch-prediction">
                    <span className="prediction-label-indicator">PREDICTION PENDING</span>
                  </div>
                )}
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="inspect-btn"
                    onClick={() => toggleExpandBranch(branch.id, branch.status)}
                  >
                    {expandedBranchId === branch.id ? 'Hide Systems' : 'Inspect Systems'}
                  </button>
                  <button 
                    className={`maintenance-btn ${maintenanceNodes.includes(branch.id) ? 'active' : ''}`}
                    onClick={() => handleToggleMaintenance(branch.id)}
                    title="Toggle scheduled maintenance window (suppress alerts)"
                  >
                    {maintenanceNodes.includes(branch.id) ? '🔧 In Maintenance' : '🔧 Schedule Maint.'}
                  </button>
                  <button 
                    className="detail-btn"
                    onClick={() => handleViewDetails(branch.id)}
                  >
                    Map View
                  </button>
                </div>
              </div>
              
              {/* Expandable systems section */}
              {expandedBranchId === branch.id && (
                <div className="branch-systems-panel">
                  {fetchingBranchId === branch.id ? (
                    <div className="panel-loading">
                      <div className="loading-spinner small"></div>
                      <span>Connecting to system telemetry...</span>
                    </div>
                  ) : expandedBranchData ? (
                    <div className="systems-content">
                      <div className="systems-summary-row">
                        <span className="systems-summary-title">System Status: {expandedBranchData.current_status?.toUpperCase() || 'HEALTHY'}</span>
                        <span className="systems-summary-desc">Active Subnet: 10.{branch.id === 'hub-delhi' ? '1' : '10'}.x.x • Mgmt IP: {expandedBranchData.mgmt_ip}</span>
                      </div>
                      
                      <div className="systems-table-wrapper">
                        <table className="systems-table">
                          <thead>
                            <tr>
                              <th>User Name / Dept</th>
                              <th>Device ID</th>
                              <th>IP Address</th>
                              <th>Active Application</th>
                              <th>Usage</th>
                              <th>SLA Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedBranchData.live_employees?.map((emp, idx) => (
                              <tr key={idx} className={`system-row status-${emp.status.toLowerCase()}`}>
                                <td style={{ fontWeight: 600, color: '#ffffff' }}>
                                  {emp.status === 'Abuse' && <span className="warning-indicator">⚠️ </span>}
                                  {emp.name}
                                  <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: 'normal', marginTop: '2px' }}>{emp.role} • {emp.department}</div>
                                </td>
                                <td style={{ fontFamily: 'monospace', color: '#c9d1d9' }}>{emp.device_id}</td>
                                <td style={{ fontFamily: 'monospace', color: '#c9d1d9' }}>{emp.ip_address}</td>
                                <td style={{ color: '#c9d1d9' }}>{emp.active_application}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  <span className={`bandwidth-indicator ${emp.status === 'Abuse' ? 'abuse' : 'normal'}`}>
                                    {emp.bandwidth_mbps} Mbps
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-pill ${emp.status.toLowerCase()}`}>
                                    {emp.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="panel-error">Failed to load system telemetry data.</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BranchesPage;