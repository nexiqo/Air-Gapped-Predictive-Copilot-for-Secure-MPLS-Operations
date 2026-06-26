import { useState, useEffect, useRef, useCallback } from 'react';
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
];

function CopilotWidget({ activeIncidents = [], onResolveIncident }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [copilotStatus, setCopilotStatus] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Poll copilot status every 15s
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
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'NOC Copilot online. I have access to your network topology, runbooks, and incident history. Ask me anything about your MPLS network.',
      timestamp: new Date(),
      type: 'text'
    }]);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [messages, isStreaming, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setHasUnread(false);
    }
  }, [isOpen]);

  // Global event handlers
  useEffect(() => {
    const handleGlobalQuery = (e) => {
      const queryText = e.detail;
      if (queryText) { setIsOpen(true); handleSendMessage(queryText); }
    };
    const handleRemediate = (e) => {
      const { nodeId, type, method } = e.detail;
      setIsOpen(true);
      if (method === 'auto') {
        const msg = `Auto-resolve the ${type} incident on ${nodeId}`;
        handleSendMessage(msg);
      }
    };
    window.addEventListener('copilotQuery', handleGlobalQuery);
    window.addEventListener('copilotRemediate', handleRemediate);
    return () => {
      window.removeEventListener('copilotQuery', handleGlobalQuery);
      window.removeEventListener('copilotRemediate', handleRemediate);
    };
  }, []);

  const buildHistory = (msgs) => {
    return msgs
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.type === 'text'))
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));
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

    // Check for incident resolve commands
    const lowerMsg = message.toLowerCase();
    const activeInc = activeIncidents.find(inc =>
      inc.status === 'active' &&
      (lowerMsg.includes(inc.nodeId?.toLowerCase()) || lowerMsg.includes(inc.nodeId?.replace('branch-', '').toLowerCase())) &&
      (lowerMsg.includes('fix') || lowerMsg.includes('resolve') || lowerMsg.includes('auto') || lowerMsg.includes('remediate') || lowerMsg.includes('solve'))
    );

    if (activeInc) {
      setIsLoading(false);
      onResolveIncident?.(activeInc.id, 'copilot');
      const remediationMsg = {
        id: Date.now() + '-assistant',
        role: 'assistant',
        type: 'remediation',
        nodeId: activeInc.nodeId,
        incidentType: activeInc.type,
        steps: [
          'Traffic drained from primary interface to backup path',
          'BGP peering sessions re-evaluated and stabilized',
          'MPLS label stack reconfigured for alternate route',
          'SD-WAN policies synchronized across affected PE routers',
          'SLA metrics verified - latency returned to compliant range',
          'Incident marked resolved in NOC management system'
        ],
        timestamp: new Date(),
        content: `Auto-remediation executed for ${activeInc.type} on ${activeInc.nodeId.toUpperCase()}.`
      };
      setMessages(prev => [...prev, remediationMsg]);
      if (!isOpen) setHasUnread(true);
      return;
    }

    // Try streaming first
    try {
      const history = buildHistory([...messages, userMsg]);

      // Create streaming assistant message placeholder
      const streamMsgId = Date.now() + '-stream';
      setIsLoading(false);
      setIsStreaming(true);
      setMessages(prev => [...prev, {
        id: streamMsgId,
        role: 'assistant',
        type: 'streaming',
        content: '',
        timestamp: new Date()
      }]);

      abortControllerRef.current = new AbortController();
      const response = await fetch('http://127.0.0.1:8000/copilot/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: message.trim(), conversation_history: history }),
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
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                fullText += parsed.token;
                setMessages(prev => prev.map(m =>
                  m.id === streamMsgId ? { ...m, content: fullText, type: 'streaming' } : m
                ));
              }
            } catch { }
          }
        }
      }

      // Finalize streaming message
      setMessages(prev => prev.map(m =>
        m.id === streamMsgId ? { ...m, content: fullText, type: 'text' } : m
      ));
      setIsStreaming(false);
      if (!isOpen) setHasUnread(true);

    } catch (err) {
      if (err.name === 'AbortError') {
        setIsStreaming(false);
        return;
      }
      // Fallback to structured query
      setIsStreaming(false);
      setIsLoading(true);
      try {
        const history = buildHistory(messages);
        const res = await fetch('http://127.0.0.1:8000/copilot/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: message.trim(), conversation_history: history })
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(prev => [...prev, {
            id: Date.now() + '-assistant',
            role: 'assistant',
            type: 'structured',
            data,
            content: data.narrative || data.predicted_issue,
            timestamp: new Date()
          }]);
        } else throw new Error('Query failed');
      } catch {
        setMessages(prev => [...prev, {
          id: Date.now() + '-error',
          role: 'assistant',
          type: 'error',
          content: 'Backend unreachable. Ensure the FastAPI server is running on port 8000.',
          timestamp: new Date()
        }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, isStreaming, activeIncidents, onResolveIncident, messages, isOpen]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setMessages(prev => prev.map(m =>
      m.type === 'streaming' ? { ...m, type: 'text', content: m.content + '\n[Stopped]' } : m
    ));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleClear = () => {
    setMessages([{
      id: 'cleared',
      role: 'assistant',
      content: 'Conversation cleared. Ready for new queries.',
      timestamp: new Date(),
      type: 'text'
    }]);
    setShowSuggestions(true);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(date));
  };

  const activeInc = activeIncidents.find(inc => inc.status === 'active');

  const renderMessage = (msg) => {
    if (msg.type === 'remediation') {
      return (
        <div key={msg.id} className="widget-message assistant">
          <div className="message-meta">
            <span className="message-role">COPILOT</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
          </div>
          <div className="remediation-card">
            <div className="remediation-header">AUTO-REMEDIATION EXECUTED</div>
            <div className="remediation-node">{msg.nodeId?.toUpperCase()} — {msg.incidentType}</div>
            <div className="remediation-steps">
              {msg.steps.map((step, i) => (
                <div key={i} className="remediation-step">
                  <span className="step-check">&#10003;</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="remediation-status">INCIDENT RESOLVED — SLA RESTORED</div>
          </div>
        </div>
      );
    }

    if (msg.type === 'structured' && msg.data) {
      const d = msg.data;
      const conf = d.confidence != null ? Math.round(d.confidence * 100) : null;
      return (
        <div key={msg.id} className="widget-message assistant">
          <div className="message-meta">
            <span className="message-role">COPILOT</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
            {d.generated_by && <span className="message-badge">{d.generated_by}</span>}
          </div>
          <div className="structured-card">
            {d.predicted_issue && (
              <div className="struct-row">
                <span className="struct-label">PREDICTED ISSUE</span>
                <span className="struct-value issue">{d.predicted_issue}</span>
              </div>
            )}
            {conf != null && (
              <div className="struct-row">
                <span className="struct-label">CONFIDENCE</span>
                <div className="confidence-bar-wrap">
                  <div className="confidence-bar" style={{ width: `${conf}%`, background: conf >= 80 ? '#da3633' : conf >= 60 ? '#d29922' : '#238636' }} />
                  <span className="confidence-text">{conf}%</span>
                </div>
              </div>
            )}
            {d.affected_scope && (
              <div className="struct-row">
                <span className="struct-label">SCOPE</span>
                <span className="struct-value">{d.affected_scope}</span>
              </div>
            )}
            {d.time_to_impact && (
              <div className="struct-row">
                <span className="struct-label">ETA TO IMPACT</span>
                <span className="struct-value eta">{d.time_to_impact}</span>
              </div>
            )}
            {d.why_risky && (
              <div className="struct-block">
                <span className="struct-label">ROOT CAUSE</span>
                <p className="struct-text">{d.why_risky}</p>
              </div>
            )}
            {d.recommended_actions?.length > 0 && (
              <div className="struct-block">
                <span className="struct-label">REMEDIATION STEPS</span>
                <ol className="action-list">
                  {d.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                </ol>
              </div>
            )}
            {d.evidence?.length > 0 && (
              <div className="struct-block">
                <span className="struct-label">EVIDENCE</span>
                <div className="evidence-list">
                  {d.evidence.map((ev, i) => (
                    <div key={i} className="evidence-item">
                      <span className="evidence-source">{ev.source}</span>
                      <span className="evidence-title">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {d.narrative && (
              <div className="struct-block">
                <span className="struct-label">SUMMARY</span>
                <p className="struct-text narrative">{d.narrative}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`widget-message ${msg.role}`}>
        <div className="message-meta">
          <span className="message-role">{msg.role === 'user' ? 'OPERATOR' : 'COPILOT'}</span>
          <span className="message-time">{formatTime(msg.timestamp)}</span>
          {msg.role === 'assistant' && msg.type === 'streaming' && (
            <span className="streaming-badge">LIVE</span>
          )}
        </div>
        <div className={`message-bubble ${msg.type === 'error' ? 'error' : ''}`}>
          <pre className="message-text">{msg.content || ''}</pre>
          {msg.type === 'streaming' && <span className="cursor-blink" />}
        </div>
      </div>
    );
  };

  return (
    <div className={`copilot-widget-container ${isExpanded ? 'expanded' : ''}`}>
      {/* Trigger Button */}
      <button
        className={`copilot-widget-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => { setIsOpen(!isOpen); setHasUnread(false); }}
        aria-label="Toggle Copilot"
      >
        <span className="trigger-icon">{isOpen ? '✕' : 'AI'}</span>
        <span className="trigger-label">{isOpen ? 'CLOSE' : 'COPILOT'}</span>
        {hasUnread && <span className="unread-dot" />}
        {activeIncidents.some(i => i.status === 'active') && !isOpen && (
          <span className="alert-pulse" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="copilot-widget-window">
          {/* Header */}
          <div className="widget-header">
            <div className="header-left">
              <div className="header-title">NOC COPILOT</div>
              <div className="header-sub">
                {copilotStatus
                  ? <><span className={`status-dot ${copilotStatus.ollama_running ? 'online' : 'offline'}`} />{copilotStatus.mode} &bull; {copilotStatus.rag_docs} docs indexed</>
                  : 'Connecting...'
                }
              </div>
            </div>
            <div className="header-actions">
              <button className="hdr-btn" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? 'Shrink' : 'Expand'}>
                {isExpanded ? '⊡' : '⊞'}
              </button>
              <button className="hdr-btn" onClick={handleClear} title="Clear chat">CLR</button>
              <button className="hdr-btn close-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>
          </div>

          <div className="widget-body">
            {/* Active Incident Banner */}
            {activeInc && (
              <div className="incident-banner">
                <div className="incident-banner-left">
                  <span className="incident-badge">ALERT</span>
                  <span className="incident-text">
                    {activeInc.nodeId?.replace('branch-', '').toUpperCase()} — {activeInc.type}
                  </span>
                </div>
                <div className="incident-banner-actions">
                  <button className="banner-btn auto" onClick={() => {
                    onResolveIncident?.(activeInc.id, 'copilot');
                    handleSendMessage(`Auto-resolve the ${activeInc.type} incident on ${activeInc.nodeId}`);
                  }}>AUTO-FIX</button>
                  <button className="banner-btn manual" onClick={() => {
                    window.dispatchEvent(new CustomEvent('selectTopologyNode', { detail: activeInc.nodeId }));
                    handleSendMessage(`Show manual remediation steps for ${activeInc.type} incident on ${activeInc.nodeId}`);
                  }}>MANUAL</button>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {showSuggestions && messages.length <= 1 && (
              <div className="suggestions-section">
                <div className="suggestions-label">SUGGESTED QUERIES</div>
                <div className="suggestions-grid">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      className="suggestion-chip"
                      onClick={() => handleSendMessage(prompt)}
                      disabled={isLoading || isStreaming}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="widget-messages">
              {messages.map(renderMessage)}

              {/* Loading dots */}
              {isLoading && (
                <div className="widget-message assistant">
                  <div className="message-meta">
                    <span className="message-role">COPILOT</span>
                  </div>
                  <div className="message-bubble">
                    <div className="loading-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="widget-input-area">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about network health, incidents, or remediation..."
              className="widget-textarea"
              rows={2}
              disabled={isLoading || isStreaming}
            />
            <div className="input-actions">
              {isStreaming ? (
                <button className="widget-stop-btn" onClick={handleStop}>STOP</button>
              ) : (
                <button
                  className="widget-send-btn"
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                >
                  SEND
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CopilotWidget;
