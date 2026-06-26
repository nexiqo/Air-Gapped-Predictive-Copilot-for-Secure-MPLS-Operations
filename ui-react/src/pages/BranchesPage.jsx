import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './BranchesPage.css';

function BranchesPage({ onNodeSelect }) {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/branches');
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
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

  return (
    <div className="branches-page">
      <div className="branches-header">
        <h2>Branch Overview</h2>
        <button className="action-btn" onClick={() => navigate('/topology')}>
          View Topology
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading branches...</p>
        </div>
      ) : (
        <div className="branches-grid">
          {branches.map((branch) => (
            <div key={branch.id} className="branch-card">
              <div className="branch-header">
                <h3>{branch.name}</h3>
                <span className={`status-badge ${getStatusClass(branch.status)}`}>
                  {branch.status}
                </span>
              </div>
              <div className="branch-info">
                <p className="branch-location">{branch.location}</p>
                <p className="branch-type">{branch.type}</p>
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
                  <span className="prediction-icon">🔮</span>
                  <span>Prediction Available</span>
                </div>
              )}
              <button 
                className="detail-btn"
                onClick={() => handleViewDetails(branch.id)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BranchesPage;