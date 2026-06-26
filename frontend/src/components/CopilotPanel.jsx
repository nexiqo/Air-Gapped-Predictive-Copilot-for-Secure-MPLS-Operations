import { useState, useEffect, useRef, useCallback } from 'react';
import './CopilotPanel.css';

function CopilotPanel({ onClose, initialQuery = '' }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const hasProcessedInitialQuery = useRef(false);

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
        content: 'I apologize, but I encountered an error processing your request. Please try again or check the network connection.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        role: 'assistant',
        content: 'Welcome to the NOC Copilot. I can help you analyze network issues, predict failures, and provide operational guidance. Ask me anything about the current network state.'
      }
    ]);
  }, []);

  useEffect(() => {
    // If there's an initial query and we haven't processed it yet
    if (initialQuery.trim() && !hasProcessedInitialQuery.current) {
      hasProcessedInitialQuery.current = true;
      setInputValue(initialQuery);
      setTimeout(() => {
        handleSendMessage(initialQuery);
      }, 500);
    }
  }, [initialQuery, handleSendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatCopilotResponse = (response) => {
    if (typeof response === 'string') {
      return response;
    }

    let formatted = '';
    
    if (response.predicted_issue) {
      formatted += `**Predicted Issue:** ${response.predicted_issue}\n\n`;
    }
    
    if (response.current_state) {
      formatted += `**Current State:** ${response.current_state}\n\n`;
    }
    
    if (response.confidence) {
      formatted += `**Confidence:** ${(response.confidence * 100).toFixed(0)}%\n\n`;
    }
    
    if (response.time_to_impact_minutes) {
      formatted += `**Time to Impact:** ${response.time_to_impact_minutes} minutes\n\n`;
    }
    
    if (response.recommended_actions && response.recommended_actions.length > 0) {
      formatted += '**Recommended Actions:**\n';
      response.recommended_actions.forEach(action => {
        formatted += `- ${action}\n`;
      });
      formatted += '\n';
    }
    
    if (response.evidence && response.evidence.length > 0) {
      formatted += '**Evidence Sources:**\n';
      response.evidence.forEach(evidence => {
        formatted += `- ${evidence.source || 'Unknown'}: ${evidence.title || 'No title'}\n`;
      });
      formatted += '\n';
    }
    
    if (response.narrative) {
      formatted += `**Summary:** ${response.narrative}`;
    }

    return formatted || response;
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
        content: 'Conversation cleared. How can I help you with the network operations?'
      }
    ]);
  };

  return (
    <div className="copilot-panel-overlay">
      <div className="copilot-panel">
        <div className="copilot-header">
          <h3>NOC Copilot</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="copilot-content">
          {/* Suggested Prompts */}
          <div className="suggested-prompts">
            <h4>Suggested Questions:</h4>
            <div className="prompt-buttons">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  className="prompt-btn"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="messages-container">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-role">
                  {message.role === 'user' ? 'Operator' : 'Copilot'}
                </div>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-role">Copilot</div>
                <div className="message-content loading">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="copilot-input">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask the NOC Copilot..."
              className="message-input"
              rows={2}
              disabled={isLoading}
            />
            <div className="input-actions">
              <button 
                className="action-btn clear-btn"
                onClick={handleClear}
                disabled={isLoading}
              >
                Clear
              </button>
              <button 
                className="action-btn send-btn"
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isLoading}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CopilotPanel;