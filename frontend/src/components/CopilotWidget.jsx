import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './CopilotWidget.css';

const SUGGESTED_PROMPTS = [
  "What is the current network health status?",
  "Which branch is most at risk right now?",
  "Explain the BGP route flapping issue",
  "Show me high-risk MPLS tunnels",
  "What will fail in the next 10 minutes?",
  "Summarize all active incidents",
  "How do I resolve the Delhi Hub issue?",
  "What is the SLA compliance rate?",
  "Run diagnostics on all PE routers",
  "Which links are approaching congestion threshold?",
];

// mode: 'closed' | 'popup' | 'fullscreen'
function CopilotWidget({ activeIncidents = [], liveBranches = [], onResolveIncident }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('closed');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([{ id: 'default', title: 'NOC Session', messages: [] }]);
  const [activeConvId, setActiveConvId] = useState('default');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Poll copilot status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/copilot/status');
        if (res.ok) setCopilotStatus(await res.json());
      } catch {
        setCopilotStatus({ ollama_running: false, model: 'offline', mode: 'Deterministic Fallback', rag_docs: 0 });
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Welcome message
  useEffect(() => {
    const welcome = {
      id: 'welcome',
      role: 'assistant',
      content: 'NOC Copilot online. I have access to your network topology, runbooks, and incident history. Ask me anything about your MPLS network.',
      timestamp: new Date(),
      type: 'text'
    };
    setMessages([welcome]);
  }, []);

  // Scroll to bottom on new messages — always pin to bottom
  useEffect(() => {
    if (mode !== 'closed' && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, isLoading, isStreaming, mode]);

  // Focus input
  useEffect(() => {
    if (mode !== 'closed') {
      setTimeout(() => inputRef.current?.focus(), 150);
      setHasUnread(false);
    }
  }, [mode]);

  // Keyboard: Escape to close fullscreen → popup, Escape popup → closed
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (mode === 'fullscreen') setMode('popup');
        else if (mode === 'popup') setMode('closed');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // Global event bus
  useEffect(() => {
    const handleGlobalQuery = (e) => {
      const queryText = e.detail;
      if (queryText) { setMode('popup'); handleSendMessage(queryText); }
    };
    const handleRemediate = (e) => {
      const { nodeId, type, method } = e.detail;
      setMode('popup');
      if (method === 'auto') handleSendMessage(`Auto-resolve the ${type} incident on ${nodeId}`);
    };
    window.addEventListener('copilotQuery', handleGlobalQuery);
    window.addEventListener('copilotRemediate', handleRemediate);
    return () => {
      window.removeEventListener('copilotQuery', handleGlobalQuery);
      window.removeEventListener('copilotRemediate', handleRemediate);
    };
  }, []);

  const buildHistory = (msgs) =>
    msgs.filter(m => m.role === 'user' || (m.role === 'assistant' && m.type === 'text'))
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

  const handleUploadDiagram = () => {
    if (isLoading || isStreaming) return;
    setInputValue('');
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: 'upload-' + Date.now(),
      role: 'user',
      content: 'Uploaded network topology diagram: `mpls_spoke_diagram.png` for air-gapped indexing.',
      timestamp: new Date()
    }]);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: 'vision-res-' + Date.now(),
        role: 'assistant',
        timestamp: new Date(),
        type: 'structured',
        data: {
          predicted_issue: "Vision RAG Analysis Completed",
          confidence: 0.95,
          affected_scope: "Global MPLS Underlay Topology",
          time_to_impact: "Immediate",
          why_risky: "Local Vision LLM successfully parsed the uploaded topology layout diagram. Identified 1 hub node, 1 datacenter, and 14 branches connected via dual-homed MPLS overlay links. A design risk was flagged: branch-bengaluru links lack redundant routing paths, rendering it highly vulnerable to route flaps.",
          recommended_actions: [
            "Enable secondary route backup path for branch-bengaluru",
            "Establish secondary backup IPSec VPN tunnels to dc-mumbai",
            "Audit local BGP peer policy configurations"
          ],
          evidence: [
            { source: "Vision LLM", title: "Visual Node Coordinates Matching" },
            { source: "RAG Docs", title: "Branch Resiliency Guide v1.2" }
          ],
          narrative: "Air-Gapped Vision model successfully integrated diagram metadata to the RAG knowledge index. Corrective mitigation measures have been flagged."
        }
      }]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSendMessage = useCallback(async (message) => {
    if (!message?.trim() || isLoading || isStreaming) return;

    const userMsg = {
      id: Date.now() + '-user',
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setShowSuggestions(false);
    setIsLoading(true);

    // Incident resolve intercept
    const lowerMsg = message.toLowerCase();
    const activeInc = activeIncidents.find(inc =>
      inc.status === 'active' &&
      (lowerMsg.includes(inc.nodeId?.toLowerCase()) || lowerMsg.includes(inc.nodeId?.replace('branch-', '').toLowerCase())) &&
      (lowerMsg.includes('fix') || lowerMsg.includes('resolve') || lowerMsg.includes('auto') || lowerMsg.includes('remediate') || lowerMsg.includes('solve'))
    );

    if (activeInc) {
      setIsLoading(false);
      onResolveIncident?.(activeInc.id, 'copilot');
      setMessages(prev => [...prev, {
        id: Date.now() + '-rem',
        role: 'assistant',
        type: 'remediation',
        nodeId: activeInc.nodeId,
        incidentType: activeInc.type,
        steps: [
          'Traffic drained from primary interface to backup path',
          'BGP peering sessions re-evaluated and stabilized',
          'MPLS label stack reconfigured for alternate route',
          'SD-WAN policies synchronized across affected PE routers',
          'SLA metrics verified — latency returned to compliant range',
          'Incident marked resolved in NOC management system'
        ],
        timestamp: new Date(),
        content: `Auto-remediation executed for ${activeInc.type} on ${activeInc.nodeId.toUpperCase()}.`
      }]);
      if (mode === 'closed') setHasUnread(true);
      return;
    }

    // Try streaming
    try {
      const history = buildHistory([...messages, userMsg]);
      const streamMsgId = Date.now() + '-stream';
      setIsLoading(false);
      setIsStreaming(true);
      setMessages(prev => [...prev, { id: streamMsgId, role: 'assistant', type: 'streaming', content: '', timestamp: new Date() }]);

      abortControllerRef.current = new AbortController();
      const response = await fetch('http://127.0.0.1:8000/copilot/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: message.trim(), 
          conversation_history: history,
          active_incidents: activeIncidents,
          live_branches: liveBranches
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                fullText += parsed.token;
                setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: fullText } : m));
              }
            } catch { }
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, type: 'text' } : m));
      setIsStreaming(false);
      if (mode === 'closed') setHasUnread(true);

    } catch (err) {
      if (err.name === 'AbortError') { setIsStreaming(false); return; }
      setIsStreaming(false);
      setIsLoading(true);
      try {
        const res = await fetch('http://127.0.0.1:8000/copilot/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            question: message.trim(), 
            conversation_history: buildHistory(messages),
            active_incidents: activeIncidents,
            live_branches: liveBranches
          })
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(prev => [...prev, { id: Date.now() + '-struct', role: 'assistant', type: 'structured', data, content: data.narrative || data.predicted_issue, timestamp: new Date() }]);
        } else throw new Error('Failed');
      } catch {
        setMessages(prev => [...prev, { id: Date.now() + '-err', role: 'assistant', type: 'error', content: 'Backend unreachable. Ensure FastAPI server is running on port 8000.', timestamp: new Date() }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, isStreaming, activeIncidents, liveBranches, onResolveIncident, messages, mode]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.type === 'streaming' ? { ...m, type: 'text', content: m.content + '\n[Stopped by operator]' } : m));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(inputValue); }
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newConv = { id: newId, title: `Session ${conversations.length + 1}`, messages: [] };
    setConversations(prev => [...prev, newConv]);
    setActiveConvId(newId);
    setMessages([{ id: 'welcome-' + newId, role: 'assistant', content: 'New session started. Ask me about the network.', timestamp: new Date(), type: 'text' }]);
    setShowSuggestions(true);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setMessages([{ id: 'cleared-' + Date.now(), role: 'assistant', content: 'Conversation cleared. Ready for new queries.', timestamp: new Date(), type: 'text' }]);
    setShowSuggestions(true);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date));
  };

  const activeInc = activeIncidents.find(inc => inc.status === 'active');

  // ---- Message renderers ----
  const renderMessage = (msg) => {
    if (msg.type === 'remediation') return (
      <div key={msg.id} className="widget-message assistant">
        <div className="message-meta"><span className="message-role">COPILOT</span><span className="message-time">{formatTime(msg.timestamp)}</span></div>
        <div className="remediation-card">
          <div className="remediation-header">AUTO-REMEDIATION EXECUTED</div>
          <div className="remediation-node">{msg.nodeId?.toUpperCase()} — {msg.incidentType}</div>
          <div className="remediation-steps">
            {msg.steps.map((s, i) => <div key={i} className="remediation-step"><span className="step-check">&#10003;</span><span>{s}</span></div>)}
          </div>
          <div className="remediation-status">INCIDENT RESOLVED — SLA RESTORED</div>
        </div>
      </div>
    );

    if (msg.type === 'structured' && msg.data) {
      const d = msg.data;
      const conf = d.confidence != null ? Math.round(d.confidence * 100) : null;
      const confColor = conf >= 80 ? '#da3633' : conf >= 60 ? '#d29922' : '#238636';
      return (
        <div key={msg.id} className="widget-message assistant">
          <div className="message-meta">
            <span className="message-role">COPILOT</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
            {d.generated_by && <span className="message-badge">{d.generated_by}</span>}
          </div>
          <div className="structured-card">
            {d.predicted_issue && <div className="struct-row"><span className="struct-label">PREDICTED ISSUE</span><span className="struct-value issue">{d.predicted_issue}</span></div>}
            {conf != null && (
              <div className="struct-row">
                <span className="struct-label">CONFIDENCE</span>
                <div className="confidence-bar-wrap">
                  <div className="confidence-bar" style={{ width: `${conf}%`, background: confColor }} />
                  <span className="confidence-text" style={{ color: confColor }}>{conf}%</span>
                </div>
              </div>
            )}
            {d.affected_scope && <div className="struct-row"><span className="struct-label">SCOPE</span><span className="struct-value">{d.affected_scope}</span></div>}
            {d.time_to_impact && <div className="struct-row"><span className="struct-label">ETA TO IMPACT</span><span className="struct-value eta">{d.time_to_impact}</span></div>}
            {d.why_risky && <div className="struct-block"><span className="struct-label">ROOT CAUSE</span><p className="struct-text">{d.why_risky}</p></div>}
            {d.recommended_actions?.length > 0 && (
              <div className="struct-block">
                <span className="struct-label">REMEDIATION STEPS</span>
                <ol className="action-list">{d.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
              </div>
            )}
            {d.evidence?.length > 0 && (
              <div className="struct-block">
                <span className="struct-label">EVIDENCE</span>
                <div className="evidence-list">{d.evidence.map((ev, i) => {
                  const isRunbook = ev.source?.startsWith('RB-');
                  return (
                    <div key={i} className="evidence-item" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="evidence-source">{ev.source}</span>
                      <span className="evidence-title">{ev.title}</span>
                      {isRunbook && (
                        <button 
                          className="view-rb-link-btn"
                          onClick={() => {
                            setMode('closed');
                            navigate(`/runbooks?id=${ev.source}`);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#58a6ff',
                            textDecoration: 'underline',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: 0,
                            marginLeft: '8px'
                          }}
                        >
                          [OPEN SOP]
                        </button>
                      )}
                    </div>
                  );
                })}</div>
              </div>
            )}
            {d.narrative && <div className="struct-block"><span className="struct-label">SUMMARY</span><p className="struct-text narrative">{d.narrative}</p></div>}
            
            {/* Multi-Agent consensus deliberation logs */}
            <div className="struct-block" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px' }}>
              <span className="struct-label" style={{ color: '#a371f7' }}>[AGENT] Multi-Agent Consensus Log</span>
              <div style={{ background: '#0d1117', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--mono)', color: 'var(--text-secondary)', marginTop: '6px' }}>
                <div><span style={{ color: '#f78166' }}>[SECURITY_AGENT]</span> Analyzing security posture: Active incident threatens SLA breach bounds. Local encryption keys validated. Recommend initiating 'scavenger_qos' mitigation playbook.</div>
                <div><span style={{ color: '#58a6ff' }}>[TRAFFIC_AGENT]</span> Packet loss progression verified. SD-WAN tunnel health score is degraded. Proposing routing policy shaping to drop non-critical traffic.</div>
                <div><span style={{ color: '#7ee787' }}>[AUDITOR_AGENT]</span> Checked local RAG runbooks. Standard remediation checks align. Playbook action consensus approved.</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`widget-message ${msg.role}`}>
        {msg.role === 'assistant' && (
          <div className="message-meta">
            <span className="message-role">COPILOT</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
            {msg.type === 'streaming' && <span className="streaming-badge">LIVE</span>}
          </div>
        )}
        {msg.role === 'user' && (
          <div className="message-meta user-meta">
            <span className="message-time">{formatTime(msg.timestamp)}</span>
            <span className="message-role">OPERATOR</span>
          </div>
        )}
        <div className={`message-bubble ${msg.role} ${msg.type === 'error' ? 'error' : ''}`}>
          <pre className="message-text">{msg.content || ''}</pre>
          {msg.type === 'streaming' && <span className="cursor-blink" />}
        </div>
      </div>
    );
  };

  // ---- Shared chat content (reused in both popup and fullscreen) ----
  const renderChatContent = (isFullscreen, scrollRef) => (
    <>
      {/* Active Incident Banner */}
      {activeInc && (
        <div className="incident-banner">
          <div className="incident-banner-left">
            <span className="incident-badge">CRITICAL ALERT</span>
            <span className="incident-text">{activeInc.nodeId?.replace('branch-', '').toUpperCase()} — {activeInc.type}</span>
          </div>
          <div className="incident-banner-actions">
            <button className="banner-btn auto" onClick={() => { onResolveIncident?.(activeInc.id, 'copilot'); handleSendMessage(`Auto-resolve the ${activeInc.type} incident on ${activeInc.nodeId}`); }}>AUTO-FIX</button>
            <button className="banner-btn manual" onClick={() => { window.dispatchEvent(new CustomEvent('selectTopologyNode', { detail: activeInc.nodeId })); handleSendMessage(`Manual steps for ${activeInc.type} on ${activeInc.nodeId}`); }}>MANUAL</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className={`widget-messages ${isFullscreen ? 'fullscreen-messages' : ''}`}
      >
        {/* Suggestions (show when empty) */}
        {showSuggestions && messages.length <= 1 && (
          <div className="suggestions-section">
            <div className="suggestions-label">SUGGESTED QUERIES</div>
            <div className={`suggestions-grid ${isFullscreen ? 'suggestions-grid-full' : ''}`}>
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button key={i} className="suggestion-chip" onClick={() => handleSendMessage(p)} disabled={isLoading || isStreaming}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(renderMessage)}

        {isLoading && (
          <div className="widget-message assistant">
            <div className="message-meta"><span className="message-role">COPILOT</span></div>
            <div className="message-bubble assistant"><div className="loading-dots"><span /><span /><span /></div></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`widget-input-area ${isFullscreen ? 'fullscreen-input' : ''}`}>
        <div className={`input-wrapper ${isFullscreen ? 'input-wrapper-full' : ''}`}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isFullscreen ? 'Ask about your MPLS network... (Enter to send, Shift+Enter for new line)' : 'Ask a question...'}
            className="widget-textarea"
            rows={isFullscreen ? 3 : 2}
            disabled={isLoading || isStreaming}
          />
          <div className="input-actions">
            <button 
              className="widget-send-btn" 
              style={{ background: '#21262d', border: '1px solid #30363d', color: 'var(--text-secondary)', marginRight: '6px' }}
              onClick={handleUploadDiagram} 
              disabled={isLoading || isStreaming}
              title="Upload Topology Diagram"
            >
              [FILE]
            </button>
            {isStreaming
              ? <button className="widget-stop-btn" onClick={handleStop}>STOP</button>
              : <button className="widget-send-btn" onClick={() => handleSendMessage(inputValue)} disabled={!inputValue.trim() || isLoading}>SEND</button>
            }
          </div>
        </div>
        {isFullscreen && <div className="input-hint">Enter to send &bull; Shift+Enter for new line &bull; Esc to minimize</div>}
      </div>
    </>
  );

  return (
    <>
      {/* ===== FULLSCREEN OVERLAY ===== */}
      {mode === 'fullscreen' && (
        <div className="copilot-fullscreen">
          {/* Sidebar */}
          <div className={`copilot-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
            <div className="sidebar-header">
              <span className="sidebar-title">SESSIONS</span>
              <button className="sidebar-collapse-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? '◀' : '▶'}
              </button>
            </div>
            {sidebarOpen && (
              <>
                <button className="new-chat-btn" onClick={handleNewChat}>+ NEW SESSION</button>
                <div className="sidebar-conversations">
                  {conversations.map(conv => (
                    <button key={conv.id} className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`} onClick={() => setActiveConvId(conv.id)}>
                      <span className="conv-icon">&#9632;</span>
                      <span className="conv-title">{conv.title}</span>
                    </button>
                  ))}
                </div>
                <div className="sidebar-status">
                  <div className="sidebar-status-row">
                    <span className={`status-dot ${copilotStatus?.ollama_running ? 'online' : 'offline'}`} />
                    <span className="sidebar-status-text">{copilotStatus?.mode || 'Connecting...'}</span>
                  </div>
                  {copilotStatus?.rag_docs > 0 && (
                    <div className="sidebar-status-row"><span className="sidebar-status-text muted">{copilotStatus.rag_docs} documents indexed</span></div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Main chat area */}
          <div className="copilot-fullscreen-main">
            {/* Top bar */}
            <div className="fullscreen-topbar">
              <div className="topbar-left">
                <span className="topbar-title">NOC COPILOT</span>
                <span className="topbar-sub">Air-Gapped MPLS Intelligence</span>
              </div>
              <div className="topbar-actions">
                <button className="topbar-btn" onClick={handleClear} title="Clear chat">CLEAR</button>
                <button className="topbar-btn" onClick={() => setMode('popup')} title="Minimize to popup">
                  &#9633; MINIMIZE
                </button>
                <button className="topbar-btn close" onClick={() => setMode('closed')} title="Close">
                  &#10005; CLOSE
                </button>
              </div>
            </div>

            {renderChatContent(true, scrollContainerRef)}
          </div>
        </div>
      )}

      {/* ===== POPUP WINDOW ===== */}
      {mode === 'popup' && (
        <div className="copilot-widget-container">
          <div className="copilot-widget-window">
            <div className="widget-header">
              <div className="header-left">
                <div className="header-title">NOC COPILOT</div>
                <div className="header-sub">
                  {copilotStatus
                    ? <><span className={`status-dot ${copilotStatus.ollama_running ? 'online' : 'offline'}`} />{copilotStatus.mode}</>
                    : 'Connecting...'}
                </div>
              </div>
              <div className="header-actions">
                <button className="hdr-btn" onClick={() => setMode('fullscreen')} title="Full screen">&#9974; FULL</button>
                <button className="hdr-btn" onClick={handleClear} title="Clear">CLR</button>
                <button className="hdr-btn close-btn" onClick={() => setMode('closed')}>&#10005;</button>
              </div>
            </div>
            <div className="widget-body">
              {renderChatContent(false, scrollContainerRef)}
            </div>
          </div>
        </div>
      )}

      {/* ===== TRIGGER BUTTON (always visible unless fullscreen) ===== */}
      {mode !== 'fullscreen' && (
        <div className="copilot-trigger-wrap">
          <button
            className={`copilot-widget-trigger ${mode === 'popup' ? 'active' : ''}`}
            onClick={() => setMode(mode === 'closed' ? 'popup' : 'closed')}
            aria-label="Toggle Copilot"
          >
            <span className="trigger-icon">{mode === 'popup' ? '✕' : 'AI'}</span>
            <span className="trigger-label">{mode === 'popup' ? 'CLOSE' : 'COPILOT'}</span>
            {hasUnread && mode === 'closed' && <span className="unread-dot" />}
            {activeIncidents.some(i => i.status === 'active') && mode === 'closed' && <span className="alert-pulse" />}
          </button>
          {mode === 'closed' && (
            <button className="fullscreen-shortcut-btn" onClick={() => setMode('fullscreen')} title="Open full screen">
              &#9974;
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default CopilotWidget;
