import { useState, useEffect, useRef, useCallback } from 'react';
import './CopilotWidget.css';

function CopilotWidget({ activeIncidents = [], onResolveIncident, initialQuery = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const suggestedPrompts = [
    "What is likely to fail next?",
    "Why is Bangalore branch at risk?",
    "Show high-risk tunnels",
    "Which branch is closest to SLA breach?",
    "Summarize current network state"
  ];

  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || isLoading) return;

    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Command interceptor: check if user asks to fix/resolve an active incident
    const lowerMsg = message.toLowerCase();
    const activeInc = activeIncidents.find(inc => inc.status === 'active' && 
      (lowerMsg.includes(inc.nodeId.toLowerCase()) || lowerMsg.includes(inc.nodeId.replace('branch-', '').toLowerCase()))
    );

    if (activeInc && (lowerMsg.includes('fix') || lowerMsg.includes('resolve') || lowerMsg.includes('remediate') || lowerMsg.includes('solve') || lowerMsg.includes('clear'))) {
      setTimeout(() => {
        onResolveIncident(activeInc.id, 'copilot');
        const assistantMessage = {
          role: 'assistant',
          content: `Auto-remediation triggered for ${activeInc.type} at ${activeInc.nodeId.toUpperCase()}:\n- Deploying recovery script...\n- Diverting transit traffic to backup link...\n- Synchronizing config templates...\n- Alert cleared. Metrics returning to SLA compliance.`
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1500);
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/copilot/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: message })
      });
      if (response.ok) {
        const data = await response.json();
        const assistantMessage = {
          role: 'assistant',
          content: formatCopilotResponse(data)
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Copilot query failed:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Error: Failed to fetch response from local AI copilot.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, activeIncidents, onResolveIncident]);

  useEffect(() => {
    // Welcome message
    setMessages([
      {
        role: 'assistant',
        content: 'NOC Predictive Copilot active. Ask questions regarding network state, predictions, and runbook procedures.'
      }
    ]);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const handleGlobalQuery = (e) => {
      const queryText = e.detail;
      if (queryText) {
        setIsOpen(true);
        handleSendMessage(queryText);
      }
    };
    window.addEventListener('copilotQuery', handleGlobalQuery);
    return () => window.removeEventListener('copilotQuery', handleGlobalQuery);
  }, [handleSendMessage]);

  // Listen to remote auto-remediation requests from toasts and panels
  useEffect(() => {
    const handleRemediateEvent = (e) => {
      const { nodeId, type, method } = e.detail;
      setIsOpen(true);
      if (method === 'auto') {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: `Auto-resolve incident on ${nodeId}` },
          { role: 'assistant', content: `Auto-remediation triggered for ${type} on ${nodeId}.\nRunning runbook recovery...\nTraffic drained from primary interface.\nRouting policies re-evaluated and synchronized.\nSLA validated: metrics returned to compliant limits.` }
        ]);
      }
    };
    window.addEventListener('copilotRemediate', handleRemediateEvent);
    return () => window.removeEventListener('copilotRemediate', handleRemediateEvent);
  }, []);

  const formatCopilotResponse = (response) => {
    if (typeof response === 'string') {
      return response;
    }

    let formatted = '';
    
    if (response.predicted_issue) {
      formatted += `ISSUE: ${response.predicted_issue}\n\n`;
    }
    
    if (response.current_state) {
      formatted += `STATE: ${response.current_state}\n\n`;
    }
    
    if (response.confidence) {
      formatted += `CONFIDENCE: ${(response.confidence * 100).toFixed(0)}%\n\n`;
    }
    
    if (response.time_to_impact_minutes) {
      formatted += `ETA: ${response.time_to_impact_minutes} minutes\n\n`;
    }
    
    if (response.recommended_actions && response.recommended_actions.length > 0) {
      formatted += 'REMEDIATION STEPS:\n';
      response.recommended_actions.forEach((action, idx) => {
        formatted += `${idx + 1}. ${action}\n`;
      });
      formatted += '\n';
    }
    
    if (response.evidence && response.evidence.length > 0) {
      formatted += 'EVIDENCE:\n';
      response.evidence.forEach(ev => {
        formatted += `- ${ev.source || 'Doc'}: ${ev.title || 'Log'}\n`;
      });
      formatted += '\n';
    }
    
    if (response.narrative) {
      formatted += `SUMMARY: ${response.narrative}`;
    }

    return formatted || JSON.stringify(response);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation history cleared.'
      }
    ]);
  };

  // Find the first active unresolved incident
  const activeInc = activeIncidents.find(inc => inc.status === 'active');

  return (
    <div className="copilot-widget-container">
      {/* Trigger Button */}
      <button 
        className={`copilot-widget-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Copilot Chat"
      >
        {isOpen ? 'CLOSE' : 'COPILOT'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="copilot-widget-window">
          <div className="widget-header">
            <h3>NOC COPILOT</h3>
            <button className="clear-chat-btn" onClick={handleClear}>CLEAR</button>
          </div>

          <div className="widget-content">
            {/* Suggested prompts in a list */}
            <div className="widget-suggested">
              <span className="suggested-title">SUGGESTIONS:</span>
              <div className="suggested-list">
                {suggestedPrompts.map((prompt, idx) => (
                  <button 
                    key={idx} 
                    className="suggested-item"
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isLoading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* In-chat Incident Mitigation Alert Card */}
            {activeInc && (
              <div className="chat-incident-alert">
                <div className="chat-alert-header">
                  <span>CRITICAL ALERT ACTIVE</span>
                </div>
                <p className="chat-alert-body">
                  Node {activeInc.nodeId.replace('branch-', '').toUpperCase()} reports {activeInc.type}.
                </p>
                <div className="chat-alert-actions">
                  <button 
                    className="chat-alert-btn auto"
                    onClick={() => {
                      onResolveIncident(activeInc.id, 'copilot');
                      setMessages(prev => [
                        ...prev,
                        { role: 'user', content: `Auto-resolve incident on ${activeInc.nodeId}` },
                        { role: 'assistant', content: `Initiating auto-remediation scripts for ${activeInc.type}...\n[1/3] Diverting traffic... Done.\n[2/3] Aligning BGP peering... Done.\n[3/3] SD-WAN policies synchronized.\n\nIncident successfully resolved. Latency returned to normal.` }
                      ]);
                    }}
                  >
                    Auto-Resolve
                  </button>
                  <button 
                    className="chat-alert-btn manual"
                    onClick={() => {
                      const event = new CustomEvent('selectTopologyNode', { detail: activeInc.nodeId });
                      window.dispatchEvent(event);
                      setMessages(prev => [
                        ...prev,
                        { role: 'user', content: `How do I resolve incident on ${activeInc.nodeId} manually?` },
                        { role: 'assistant', content: `To resolve the incident on ${activeInc.nodeId} manually, select the node in the Topology map and execute the checklist steps in the Details panel:\n\n` + activeInc.steps.map((s, idx) => `${idx + 1}. ${s.label}`).join('\n') }
                      ]);
                    }}
                  >
                    Manual Steps
                  </button>
                </div>
              </div>
            )}

            {/* Messages log */}
            <div className="widget-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`widget-message ${msg.role}`}>
                  <div className="message-header">
                    {msg.role === 'user' ? 'OPERATOR' : 'COPILOT'}
                  </div>
                  <pre className="message-text">{msg.content}</pre>
                </div>
              ))}
              {isLoading && (
                <div className="widget-message assistant loading">
                  <div className="message-header">COPILOT</div>
                  <div className="typing-indicator">Analyzing local knowledge...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="widget-input-area">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask a question..."
                className="widget-textarea"
                rows={2}
                disabled={isLoading}
              />
              <button 
                className="widget-send-btn"
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isLoading}
              >
                SEND
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CopilotWidget;
