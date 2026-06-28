import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Monkey patch fetch to redirect API calls to the correct server origin when accessed externally (e.g. ngrok)
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === 'string' && (input.includes('127.0.0.1:8000') || input.includes('localhost:8000'))) {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    const base = isLocal ? `http://${host}:8000` : window.location.origin;
    input = input.replace(/https?:\/\/(127\.0\.0\.1|localhost):8000/g, base);
  }
  return originalFetch(input, init);
};

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
