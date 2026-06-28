import { useState, useEffect } from 'react';
import './Runbooks.css';

function RunbooksPage() {
  const [runbooks, setRunbooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedRunbooks, setExpandedRunbooks] = useState({});

  useEffect(() => {
    fetchRunbooks();
  }, []);

  useEffect(() => {
    if (runbooks.length > 0) {
      const queryParams = new URLSearchParams(window.location.search);
      const targetId = queryParams.get('id');
      if (targetId) {
        setExpandedRunbooks({ [targetId]: true });
        setSelectedCategory('ALL');
        setTimeout(() => {
          const el = document.getElementById(`runbook-${targetId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
      }
    }
  }, [runbooks]);

  const fetchRunbooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/runbooks');
      if (response.ok) {
        const data = await response.json();
        setRunbooks(data);
        // expand first runbook by default
        if (data.length > 0) {
          setExpandedRunbooks({ [data[0].runbook_id]: true });
        }
      }
    } catch (error) {
      console.error('Failed to fetch runbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedRunbooks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const categories = ['ALL', ...new Set(runbooks.map(rb => rb.category))];

  const filteredRunbooks = runbooks.filter(rb => {
    const matchesSearch = 
      rb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rb.runbook_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rb.trigger_conditions.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ALL' || rb.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="runbooks-page">
      <div className="runbooks-header">
        <div>
          <h2>Standard Operational Runbooks (SOPs)</h2>
          <p className="subtitle">Air-Gapped operational runbooks and command sequences for MPLS incidents</p>
        </div>
      </div>

      <div className="runbooks-controls">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search runbooks by ID, title, or trigger..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="runbooks-search"
          />
        </div>
        <div className="category-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading runbooks...</p>
        </div>
      ) : filteredRunbooks.length === 0 ? (
        <div className="no-runbooks">
          <p>No runbooks match your search criteria</p>
        </div>
      ) : (
        <div className="runbooks-list">
          {filteredRunbooks.map((rb) => {
            const isExpanded = expandedRunbooks[rb.runbook_id];
            
            // Gather all step strings
            const steps = [];
            for (let i = 1; i <= 8; i++) {
              if (rb[`step_${i}`]) {
                steps.push(rb[`step_${i}`]);
              }
            }

            return (
              <div key={rb.runbook_id} id={`runbook-${rb.runbook_id}`} className={`runbook-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="runbook-card-header" onClick={() => toggleExpand(rb.runbook_id)}>
                  <div className="header-left">
                    <span className="expand-indicator">{isExpanded ? '▼' : '▶'}</span>
                    <span className="runbook-id-badge">{rb.runbook_id}</span>
                    <h3 className="runbook-title">{rb.title}</h3>
                  </div>
                  <div className="header-right">
                    <span className="category-badge">{rb.category}</span>
                    <span className={`success-badge ${rb.success_rate_pct >= 90 ? 'high' : 'medium'}`}>
                      {rb.success_rate_pct}% Success
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="runbook-card-body">
                    <div className="meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">APPLICABILITY SEVERITY:</span>
                        <span className="meta-value">{rb.severity_applicability}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">EXPECTED RECOVERY TIME:</span>
                        <span className="meta-value">{rb.expected_recovery_time_minutes} minutes</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">LAST USED INCIDENT:</span>
                        <span className="meta-value">{rb.last_used_incident || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="trigger-box">
                      <strong>TRIGGER CONDITIONS:</strong> {rb.trigger_conditions}
                    </div>

                    <div className="steps-section">
                      <h4>COMMAND EXECUTION SEQUENCE</h4>
                      <div className="steps-list">
                        {steps.map((step, idx) => {
                          // Extract command vs description if commands are present (e.g. vtysh -c '...')
                          const hasCommand = step.includes(': ');
                          let desc = step;
                          let cmd = '';
                          
                          if (hasCommand) {
                            const splitIdx = step.indexOf(': ');
                            desc = step.slice(0, splitIdx);
                            cmd = step.slice(splitIdx + 2);
                          }

                          return (
                            <div key={idx} className="step-item">
                              <div className="step-number">{idx + 1}</div>
                              <div className="step-content">
                                <div className="step-desc">{desc}</div>
                                {cmd && (
                                  <div className="step-cmd-box">
                                    <code className="step-cmd">{cmd}</code>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RunbooksPage;
