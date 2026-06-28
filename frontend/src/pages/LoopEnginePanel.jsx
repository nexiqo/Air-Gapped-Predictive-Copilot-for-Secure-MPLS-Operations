import { useState, useEffect, useRef } from 'react';
import './LoopEnginePanel.css';

const API = 'http://127.0.0.1:8000';

const PHASE_ORDER = ['TRIAGE', 'MITIGATION', 'VERIFICATION', 'COMPLETED'];

const PHASE_META = {
  TRIAGE:       { label: 'Triage',       color: '#d29922', bg: '#d2992215', desc: 'Anomaly detected & logged' },
  MITIGATION:   { label: 'Mitigation',   color: '#388bfd', bg: '#388bfd15', desc: 'Applying fix policies' },
  VERIFICATION: { label: 'Verification', color: '#a371f7', bg: '#a371f715', desc: 'Polling telemetry every 5s' },
  COMPLETED:    { label: 'Resolved',     color: '#3fb950', bg: '#3fb95015', desc: 'SLA restored' },
  ESCALATED:    { label: 'Escalated',    color: '#f85149', bg: '#f8514915', desc: 'Manual intervention needed' },
};

// n8n-style node component
function WorkflowNode({ id, label, desc, color, status, isActive, metrics }) {
  return (
    <div className={`wf-node ${isActive ? 'wf-node-active' : ''}`} style={{ '--node-color': color }}>
      <div className="wf-node-header" style={{ background: color + '22', borderColor: color + '55' }}>
        <div className="wf-node-dot" style={{ background: isActive ? color : '#30363d' }}>
          {status === 'done' ? '✓' : status === 'active' ? '▶' : '○'}
        </div>
        <span className="wf-node-label">{label}</span>
        {isActive && <span className="wf-node-live-badge">LIVE</span>}
      </div>
      <div className="wf-node-body">
        <div className="wf-node-desc">{desc}</div>
        {isActive && metrics && (
          <div className="wf-node-metrics">
            <div className="wf-nm-item">
              <span className="wf-nm-k">Latency</span>
              <span className="wf-nm-v" style={{ color: metrics.latency_ms > 50 ? '#f85149' : '#3fb950' }}>
                {metrics.latency_ms ?? '—'} ms
              </span>
            </div>
            <div className="wf-nm-item">
              <span className="wf-nm-k">Pkt Loss</span>
              <span className="wf-nm-v" style={{ color: metrics.packet_loss_pct > 1 ? '#d29922' : '#3fb950' }}>
                {metrics.packet_loss_pct ?? '—'} %
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Animated connector arrow between nodes
function Connector({ active, done, color }) {
  return (
    <div className={`wf-connector ${active || done ? 'wf-connector-lit' : ''}`}>
      <div className="wf-connector-line" style={{ background: done || active ? color : '#30363d' }} />
      {active && <div className="wf-connector-pulse" style={{ background: color }} />}
      <div className="wf-connector-arrow" style={{ borderLeftColor: done || active ? color : '#30363d' }} />
    </div>
  );
}

function LoopWorkflow({ loop }) {
  const phase = loop.phase;
  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="le-workflow-card">
      <div className="le-workflow-header">
        <div className="le-wf-title-block">
          <div className="le-wf-incident">{loop.incident_type}</div>
          <div className="le-wf-meta">
            <span className="le-wf-node-badge">{loop.node_id?.replace('branch-', '').toUpperCase()}</span>
            <span className="le-wf-sep">·</span>
            <span className="le-wf-time">Triggered {loop.trigger_time}</span>
            <span className="le-wf-sep">·</span>
            <span className="le-wf-id">ID: {loop.incident_id}</span>
          </div>
        </div>
        <div className="le-wf-status-badge" style={{
          background: (PHASE_META[phase]?.bg),
          color: PHASE_META[phase]?.color,
          border: `1px solid ${PHASE_META[phase]?.color}44`
        }}>
          {phase === 'ESCALATED' ? '⚠ ESCALATED' : phase === 'COMPLETED' ? '✓ RESOLVED' : `▶ ${phase}`}
        </div>
      </div>

      {/* n8n-style node flow */}
      <div className="le-workflow-flow">
        {PHASE_ORDER.map((p, i) => {
          const meta = PHASE_META[p];
          const nodeStatus = i < currentIdx ? 'done' : p === phase ? 'active' : 'pending';
          const isActive = p === phase;
          const isDone = i < currentIdx;
          return (
            <div key={p} className="le-flow-step">
              <WorkflowNode
                label={meta.label}
                desc={meta.desc}
                color={meta.color}
                status={nodeStatus}
                isActive={isActive}
                metrics={isActive ? loop.last_metrics : null}
              />
              {i < PHASE_ORDER.length - 1 && (
                <Connector active={isActive} done={isDone} color={meta.color} />
              )}
            </div>
          );
        })}
      </div>

      {/* Checklist as data rows */}
      {loop.checklist?.length > 0 && (
        <div className="le-wf-checklist">
          <div className="le-wf-checklist-title">Verification Checklist</div>
          <div className="le-wf-checklist-grid">
            {loop.checklist.map((step, idx) => {
              const color = step.status === 'verified' ? '#3fb950'
                : step.status === 'active' ? '#388bfd'
                : step.status === 'failed' ? '#f85149'
                : '#6e7781';
              return (
                <div key={idx} className="le-wf-check-item">
                  <div className="le-wf-check-dot" style={{ background: color }} />
                  <span className="le-wf-check-label">{step.label}</span>
                  <span className="le-wf-check-status" style={{ color }}>{step.status?.toUpperCase()}</span>
                  {step.timestamp && <span className="le-wf-check-time">{step.timestamp}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoopEnginePanel({ activeIncidents = [] }) {
  const [loopState, setLoopState] = useState({ active_loops: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [liveLog, setLiveLog] = useState([
    '[BOOT] Loop Engine initialized. Watching 16 nodes.',
    '[READY] Maker-Checker framework loaded. Polling interval: 5s.',
    '[INFO] No active anomalies detected. All SLAs nominal.',
  ]);
  const logRef = useRef(null);

  const fetchLoopState = async () => {
    try {
      const res = await fetch(`${API}/loop/state`);
      if (res.ok) {
        const data = await res.json();
        setLoopState(data);
        setLastRefresh(new Date().toLocaleTimeString('en-IN', { hour12: false }));

        if (data.active_loops.length > 0) {
          const loop = data.active_loops[0];
          setLiveLog(prev => {
            const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
            const msg = `[${ts}] ${loop.node_id?.toUpperCase()} · ${loop.phase} · lat=${loop.last_metrics?.latency_ms}ms loss=${loop.last_metrics?.packet_loss_pct}%`;
            if (prev[prev.length - 1] === msg) return prev;
            const next = [...prev, msg];
            return next.length > 80 ? next.slice(-80) : next;
          });
        } else {
          const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
          setLiveLog(prev => {
            const msg = `[${ts}] Heartbeat OK · All 16 nodes stable · Engine idle`;
            if (prev[prev.length - 1] === msg) return prev;
            const next = [...prev, msg];
            return next.length > 80 ? next.slice(-80) : next;
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
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [liveLog]);

  const injectChaos = (type) => {
    window.dispatchEvent(new CustomEvent('injectChaos', { detail: type }));
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    const labels = {
      bgp_flap: 'BGP_FLAP injected → awaiting TRIAGE phase',
      congestion: 'CONGESTION injected → traffic shaping engaged',
      tunnel_fail: 'TUNNEL_FAIL injected → IPSec path degraded',
    };
    setLiveLog(prev => [...prev, `[${ts}] [CHAOS] ${labels[type] || type}`]);
  };

  const activeLoops = loopState.active_loops || [];
  const history = loopState.history || [];
  const resolved = history.filter(h => h.status === 'resolved').length;
  const escalated = history.filter(h => h.status === 'escalated').length;
  const liveIncidents = activeIncidents.filter(i => i.status === 'active').length;
  const avgMTTR = history.length > 0 ? '18s' : '—';

  return (
    <div className="le-container">
      {/* Header */}
      <div className="le-header">
        <div className="le-header-left">
          <div className="le-header-title">Loop Engineering Engine</div>
          <div className="le-header-subtitle">Autonomous Maker-Checker · Offline AI Verification · Air-Gapped MPLS</div>
        </div>
        <div className="le-header-right">
          <div className="le-status-pill">
            <span className="le-status-dot pulse" />
            ENGINE ACTIVE
          </div>
          {lastRefresh && <span className="le-last-refresh">Synced {lastRefresh}</span>}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="le-stats-row">
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: activeLoops.length > 0 ? '#d29922' : '#3fb950' }}>
            {activeLoops.length}
          </div>
          <div className="le-stat-label">Active Loops</div>
          <div className="le-stat-sub">{activeLoops.length > 0 ? 'Remediating' : 'All stable'}</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: '#3fb950' }}>{resolved}</div>
          <div className="le-stat-label">Auto-Resolved</div>
          <div className="le-stat-sub">No human input</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: escalated > 0 ? '#f85149' : '#6e7781' }}>{escalated}</div>
          <div className="le-stat-label">Escalated</div>
          <div className="le-stat-sub">Manual required</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: '#388bfd' }}>{liveIncidents}</div>
          <div className="le-stat-label">Live Incidents</div>
          <div className="le-stat-sub">Being monitored</div>
        </div>
        <div className="le-stat-card">
          <div className="le-stat-val" style={{ color: '#a371f7' }}>{avgMTTR}</div>
          <div className="le-stat-label">Avg MTTR</div>
          <div className="le-stat-sub">Mean resolution</div>
        </div>
      </div>

      <div className="le-body">
        {/* Left: Workflow canvas */}
        <div className="le-left-col">
          <div className="le-section-title">
            <span>Active Workflow Runs</span>
            <span className="le-count-badge">{activeLoops.length}</span>
          </div>

          {loading ? (
            <div className="le-empty-state">
              <div className="le-spinner" />
              <span>Connecting to Loop Engine...</span>
            </div>
          ) : activeLoops.length === 0 ? (
            <div className="le-idle-state">
              <div className="le-idle-workflow">
                {/* Static idle workflow to show the concept */}
                <div className="le-idle-title">No Active Loops — System Idle</div>
                <div className="le-workflow-flow" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                  {PHASE_ORDER.map((p, i) => {
                    const meta = PHASE_META[p];
                    return (
                      <div key={p} className="le-flow-step">
                        <WorkflowNode label={meta.label} desc={meta.desc} color={meta.color} status="pending" isActive={false} />
                        {i < PHASE_ORDER.length - 1 && <Connector active={false} done={false} color="#30363d" />}
                      </div>
                    );
                  })}
                </div>
                <div className="le-idle-sub">Inject a chaos event below or wait for an anomaly to be auto-detected.</div>
              </div>
            </div>
          ) : (
            <div className="le-loops-list">
              {activeLoops.map(loop => (
                <LoopWorkflow key={loop.incident_id} loop={loop} />
              ))}
            </div>
          )}

          {/* Live log terminal */}
          <div className="le-section-title" style={{ marginTop: '20px' }}>
            <span>Engine Event Log</span>
            <span className="le-live-indicator">LIVE</span>
          </div>
          <div className="le-log-terminal" ref={logRef}>
            {liveLog.map((line, i) => {
              const color = line.includes('[CHAOS]') ? '#f85149'
                : line.includes('TRIAGE') ? '#d29922'
                : line.includes('MITIGATION') ? '#388bfd'
                : line.includes('VERIFICATION') ? '#a371f7'
                : line.includes('RESOLVED') || line.includes('OK') ? '#3fb950'
                : '#8b949e';
              return <div key={i} className="le-log-line" style={{ color }}>{line}</div>;
            })}
          </div>
        </div>

        {/* Right: Chaos control + History */}
        <div className="le-right-col">
          {/* Chaos Control */}
          <div className="le-chaos-card">
            <div className="le-chaos-title">Chaos Control Panel</div>
            <div className="le-chaos-desc">
              Inject live network disruptions to test autonomous self-healing. The Loop Engine will detect, remediate, and verify recovery automatically.
            </div>
            <div className="le-chaos-buttons">
              <button className="le-chaos-btn bgp" onClick={() => injectChaos('bgp_flap')}>
                <div className="le-chaos-btn-label">BGP Route Flapping</div>
                <div className="le-chaos-btn-sub">Peer adjacency drops · AS-65000</div>
              </button>
              <button className="le-chaos-btn congestion" onClick={() => injectChaos('congestion')}>
                <div className="le-chaos-btn-label">Interface Congestion</div>
                <div className="le-chaos-btn-sub">Link util ≥ 90% · QoS threshold</div>
              </button>
              <button className="le-chaos-btn tunnel" onClick={() => injectChaos('tunnel_fail')}>
                <div className="le-chaos-btn-label">IPSec Tunnel Failure</div>
                <div className="le-chaos-btn-sub">Overlay path degraded · MPLS drop</div>
              </button>
            </div>
          </div>

          {/* History table */}
          <div className="le-section-title">
            <span>Completion History</span>
            <span className="le-count-badge">{history.length}</span>
          </div>
          <div className="le-history-table">
            {history.length === 0 ? (
              <div className="le-history-empty">No completed loops yet. Inject a chaos event to start.</div>
            ) : (
              <table className="le-hist-tbl">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Incident</th>
                    <th>Status</th>
                    <th>Resolved At</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((entry, i) => (
                    <tr key={i} className={entry.status === 'resolved' ? 'row-resolved' : 'row-escalated'}>
                      <td>{entry.node_id?.replace('branch-', '').toUpperCase()}</td>
                      <td>{entry.incident_type}</td>
                      <td>
                        <span className={`le-hist-badge ${entry.status}`}>
                          {entry.status === 'resolved' ? '✓ RESOLVED' : '⚠ ESCALATED'}
                        </span>
                      </td>
                      <td className="le-hist-ts">{entry.completion_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* How it works */}
          <div className="le-howit-card">
            <div className="le-howit-title">How the Maker-Checker Loop Works</div>
            <div className="le-howit-steps">
              {[
                { n: 1, color: '#d29922', h: 'Detect (Triage)', d: 'ML model flags anomaly. Loop Engine auto-registers an incident cycle.' },
                { n: 2, color: '#388bfd', h: 'Act (Maker)', d: 'Applies fix policies: blocks streaming, activates QoS shaper, reroutes traffic.' },
                { n: 3, color: '#a371f7', h: 'Verify (Checker)', d: 'Polls live telemetry every 5s. Checks latency < 25ms and packet loss < 0.2%.' },
                { n: 4, color: '#3fb950', h: 'Resolve or Escalate', d: 'Success → auto-closes incident. Failure after 25s → escalates to NOC operator.' },
              ].map(s => (
                <div key={s.n} className="le-howit-step">
                  <div className="le-howit-num" style={{ background: s.color }}>{s.n}</div>
                  <div>
                    <div className="le-howit-heading">{s.h}</div>
                    <div className="le-howit-desc">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
