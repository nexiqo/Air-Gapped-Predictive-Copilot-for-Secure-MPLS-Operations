import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CopilotPanel from '../components/CopilotPanel';
import './Copilot.css';

function CopilotPage() {
  const [searchParams] = useSearchParams();
  const [copilotOpen, setCopilotOpen] = useState(true);
  const initialQuery = searchParams.get('q') || '';

  useEffect(() => {
    // Auto-open copilot panel when page loads
    setCopilotOpen(true);
  }, []);

  const handleClose = () => {
    setCopilotOpen(false);
    // Navigate back to topology
    window.location.href = '/topology';
  };

  return (
    <div className="copilot-page">
      <div className="copilot-page-header">
        <h2>NOC Copilot</h2>
        <p>Ask questions about network state, predictions, and operational guidance</p>
      </div>
      
      {copilotOpen && (
        <CopilotPanel onClose={handleClose} initialQuery={initialQuery} />
      )}
    </div>
  );
}

export default CopilotPage;