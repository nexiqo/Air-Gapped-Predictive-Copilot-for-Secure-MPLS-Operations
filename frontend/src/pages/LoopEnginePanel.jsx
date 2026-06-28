import { useState, useEffect, useRef } from 'react';
import './LoopEnginePanel.css';

const API = 'http://127.0.0.1:8000';

const PHASE_META = {
  TRIAGE:       { label: 'Triage',       color: '#d29922', icon: '[TRIAGE]' },
  MITIGATION:   { label: 'Mitigation',   color: '#388bfd', icon: '[MITIGATE]' },
  VERIFICATION: { label: 'Verification', color: '#a371f7', icon: '[VERIFY]' },
  COMPLETED:    { label: 'Completed',    color: '#3fb950', icon: '[OK]' },
  ESCALATED:    { label: 'Escalated',    color: '#f85149', icon: '[ALERT]' },
};

const STEP_STATUS_META = {
  verified: { icon: '[OK]', color: '#3fb950' },
  active:   { icon: '[RUN]', color: '#388bfd' },
  failed:   { icon: '[FAIL]', color: '#f85149' },
  pending:  { icon: '[PEND]', color: '#6e7781' },
};

function PhaseBar({ phase }) {
  const phases = ['TRIAGE', 'MITIGATION', 'VERIFICATION', 'COMPLETED'];
  const currentIdx = phases.indexOf(phase);
  return (
    <div className="le-phase-bar">
      {phases.map((p, i) => {
        const meta = PHASE_META[p];
        const active = p === phase;
        const done = i < currentIdx;
        return (
          <div key={p} className={`le-phase-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
            <div className="le-phase-dot" style={{ background: done || active ? meta.color : '#30363d' }}>
              {done ? '✓' : (i + 1)}
            </div>
            <span className="le-phase-label">{meta.label}</span>
            {i < phases.length - 1 && (
              <div className={`le-phase-connector ${done ? 'done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoopCard({ loop }) {
  const [expanded, setExpanded] = useState(true);
  const meta = PHASE_META[loop.phase] || PHASE_META.TRIAGE;

  return (
    <div className="le-loop-card" style={{ borderLeft: `3px solid ${meta.color}` }}>
      <div className="le-loop-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="le-loop-card-title">
          <span className="le-loop-icon">{meta.icon}</span>
          <div>
            <div className="le-loop-incident-type">{loop.incident_type}</div>
            <div className="le-loop-node-id">{loop.node_id?.replace('branch-', '').toUpperCase()} · Triggered {loop.trigger_time}</div>
          </div>
        </div>
        <div className="le-loop-card-right">
          <span className="le-phase-badge" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>
            {meta.label}
          </span>
          <span className="le-expand-btn">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="le-loop-card-body">
          <PhaseBar phase={loop.phase} />

          <div className="le-metrics-row">
            <div className="le-metric-chip">
              <span className="le-metric-label">Latency</span>
              <span className="le-metric-val" style={{ color: loop.last_metrics?.latency_ms > 50 ? '#f85149' : '#3fb950' }}>
                {loop.last_metrics?.latency_ms ?? '—'} ms
              </span>
            </div>
            <div className="le-metric-chip">
              <span className="le-metric-label">Packet Loss</span>
              <span className="le-metric-val" style={{ color: loop.last_metrics?.packet_loss_pct > 1 ? '#d29922' : '#3fb950' }}>
                {loop.last_metrics?.packet_loss_pct ?? '—'} %
              </span>
            </div>
          </div>

          <div className="le-checklist">
            <div className="le-checklist-title">Maker-Checker Verification Checklist</div>
            {loop.checklist?.map(step => {
              const sm = STEP_STATUS_META[step.status] || STEP_STATUS_META.pending;
              return (
                <div className="le-checklist-item" key={step.id}>
                  <span className="le-step-icon">{sm.icon}</span>
                  <span className="le-step-label" style={{ color: sm.color === '#6e7781' ? '#8b949e' : sm.color }}>
                    {step.label}
                  </span>
                  <span className="le-step-ts">{step.timestamp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ entry }) {
  const resolved = entry.status === 'resolved';
  return (
    <div className={`le-history-row ${resolved ? 'resolved' : 'escalated'}`}>
      <span className="le-hist-icon" style={{ fontSize: 11, fontWeight: 'bold', color: resolved ? '#3fb950' : '#f85149' }}>
        {resolved ? '[OK]' : '[ALERT]'}
      </span>
      <div className="le-hist-info">
        <span className="le-hist-node">{entry.node_id?.replace('branch-', '').toUpperCase()}</span>
        <span className="le-hist-type">{entry.incident_type}</span>
      </div>
      <div className="le-hist-right">
        <span className={`le-hist-badge ${resolved ? 'resolved' : 'escalated'}`}>
          {resolved ? 'RESOLVED' : 'ESCALATED'}
        </span>
        <span className="le-hist-time">{entry.completion_time}</span>
      </div>
    </div>
  );
}

export default function LoopEnginePanel({ activeIncidents = [] }) {
  const [loopState, setLoopState] = useState({ active_loops: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [liveLog, setLiveLog] = useState([]);
  const logRef = useRef(null);

  const fetchLoopState = async () => {
    try {
      const res = await fetch(`${API}/loop/state`);
      if (res.ok) {
        const data = await res.json();
        setLoopState(data);
        setLastRefresh(new Date().toLocaleTimeString());
        
        // Simulate live event log updates
        if (data.active_loops.length > 0) {
          const loop = data.active_loops[0];
          setLiveLog(prev => {
            const msg = `[${new Date().toLocaleTimeString()}] LoopEngine · ${loop.node_id?.toUpperCase()} · Phase: ${loop.phase} · Latency: ${loop.last_metrics?.latency_ms}ms`;
            if (prev[prev.length - 1] === msg) return prev;
            const next = [...prev, msg];
            return next.length > 50 ? next.slice(-50) : next;
          });
        }
      }
    } catch {
      // backend not ready
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoopState();
    const interval = setInterval(fetchLoopState, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [liveLog]);

  const injectChaos = (type) => {
    window.dispatchEvent(new CustomEvent('injectChaos', { detail: type }));
  };

  const activeLoops = loopState.active_loops || [];
  const history = loopState.history || [];

  return (
    <div className="le-container">
      {/* Header */}
      <div className="le-header">
        <div className="le-header-left">
          <div className="le-header-title">
            <span className="le-header-icon">[SYS]</span>
            Loop Engineering Engine
          </div>
          <div className="le-header-subtitle">
            Autonomous Maker-Checker · Offline AI Verification Loops
          </div>
        </div>
        <div className="le-header-right">
          <div className="le-status-pill">
            <span className="le-status-dot pulse" />
            ENGINE RUNNING
          </div>
          {lastRefresh && <span className="le-last-refresh">Last sync: {lastRefresh}</span>}
        </div>
      </div>

      {/* Stats row */}
      <div className="le-stats-row">
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: activeLoops.length > 0 ? '#d29922' : '#3fb950' }}>
            {activeLoops.length}
          </div>
          <div className="le-stat-label">Active Loops</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: '#3fb950' }}>
            {history.filter(h => h.status === 'resolved').length}
          </div>
          <div className="le-stat-label">Resolved</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: '#f85149' }}>
            {history.filter(h => h.status === 'escalated').length}
          </div>
          <div className="le-stat-label">Escalated</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: '#388bfd' }}>
            {activeIncidents.filter(i => i.status === 'active').length}
          </div>
          <div className="le-stat-label">Live Incidents</div>
        </div>
      </div>

      <div className="le-body">
        {/* Left column: active loops */}
        <div className="le-left-col">
          <div className="le-section-title">
            <span>Active Verification Loops</span>
            <span className="le-count-badge">{activeLoops.length}</span>
          </div>

          {loading ? (
            <div className="le-empty-state">
              <div className="le-spinner" />
              <span>Connecting to Loop Engine...</span>
            </div>
          ) : activeLoops.length === 0 ? (
            <div className="le-empty-state">
              <span className="le-empty-icon">[NO ACTIVE]</span>
              <span className="le-empty-title">No Active Loops</span>
              <span className="le-empty-sub">All network incidents are stable. The engine will automatically register a loop when an anomaly is detected.</span>
            </div>
          ) : (
            <div className="le-loops-list">
              {activeLoops.map(loop => (
                <LoopCard key={loop.incident_id} loop={loop} />
              ))}
            </div>
          )}

          {/* Live log terminal */}
          <div className="le-section-title" style={{ marginTop: '20px' }}>
            <span>Live Engine Log</span>
            <span className="le-live-indicator">LIVE</span>
          </div>
          <div className="le-log-terminal" ref={logRef}>
            {liveLog.length === 0 ? (
              <div className="le-log-line le-log-muted">Waiting for loop activity...</div>
            ) : (
              liveLog.map((line, i) => (
                <div key={i} className="le-log-line">{line}</div>
              ))
            )}
          </div>
        </div>

        {/* Right column: history + chaos control + how it works */}
        <div className="le-right-col">
          {/* Chaos Control Panel */}
          <div className="le-explainer-card" style={{ marginBottom: '20px', borderColor: '#30363d' }}>
            <div className="le-explainer-title" style={{ color: '#58a6ff' }}>[CONTROL] Chaos Control Panel</div>
            <div className="le-ex-desc" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Inject active disruptions into the SD-WAN/MPLS simulation to test the autonomous self-healing loops.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="toast-btn auto-btn" style={{ background: '#21262d', border: '1px solid #30363d', color: '#58a6ff', padding: '8px' }} onClick={() => injectChaos('bgp_flap')}>
                Inject BGP Route Flapping Scenario
              </button>
              <button className="toast-btn auto-btn" style={{ background: '#21262d', border: '1px solid #30363d', color: '#d29922', padding: '8px' }} onClick={() => injectChaos('congestion')}>
                Inject Interface Traffic Congestion
              </button>
              <button className="toast-btn auto-btn" style={{ background: '#21262d', border: '1px solid #30363d', color: '#f85149', padding: '8px' }} onClick={() => injectChaos('tunnel_fail')}>
                Inject IPSec Tunnel Degradation
              </button>
            </div>
          </div>

          <div className="le-section-title">
            <span>Completion History</span>
            <span className="le-count-badge">{history.length}</span>
          </div>
          <div className="le-history-list" style={{ marginBottom: '20px' }}>
            {history.length === 0 ? (
              <div className="le-empty-state small">
                <span className="le-empty-sub">Completed loops will appear here.</span>
              </div>
            ) : (
              [...history].reverse().map((entry, i) => (
                <HistoryRow key={i} entry={entry} />
              ))
            )}
          </div>

          {/* How it works explainer */}
          <div className="le-explainer-card">
            <div className="le-explainer-title">How the Loop Engine Works</div>
            <div className="le-explainer-steps">
              <div className="le-ex-step">
                <div className="le-ex-num" style={{ background: '#d29922' }}>1</div>
                <div>
                  <div className="le-ex-heading">Detect (Triage)</div>
                  <div className="le-ex-desc">Engine watches all active incidents every 5 seconds. When an anomaly is found, a Maker-Checker loop is automatically registered.</div>
                </div>
              </div>
              <div className="le-ex-step">
                <div className="le-ex-num" style={{ background: '#388bfd' }}>2</div>
                <div>
                  <div className="le-ex-heading">Act (Maker)</div>
                  <div className="le-ex-desc">Engine applies mitigation policies autonomously — blocks rogue streaming, activates load-balancers, or enables QoS shapers based on incident type.</div>
                </div>
              </div>
              <div className="le-ex-step">
                <div className="le-ex-num" style={{ background: '#a371f7' }}>3</div>
                <div>
                  <div className="le-ex-heading">Verify (Checker)</div>
                  <div className="le-ex-desc">A separate checker process polls live telemetry. If latency &lt; 25ms and packet loss &lt; 0.2%, the incident is verified as resolved.</div>
                </div>
              </div>
              <div className="le-ex-step">
                <div className="le-ex-num" style={{ background: '#3fb950' }}>4</div>
                <div>
                  <div className="le-ex-heading">Resolve or Escalate</div>
                  <div className="le-ex-desc">On success, the loop auto-closes the incident. On failure after 25s, it escalates to the NOC operator with full evidence.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
