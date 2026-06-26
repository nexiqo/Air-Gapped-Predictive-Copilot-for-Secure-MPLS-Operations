import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import TopologyPage from './pages/TopologyPage';
import OverviewPage from './pages/OverviewPage';
import BranchesPage from './pages/BranchesPage';
import AlertsPage from './pages/AlertsPage';
import PredictionsPage from './pages/PredictionsPage';
import ReportsPage from './pages/ReportsPage';
import CopilotPage from './pages/CopilotPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [networkSummary, setNetworkSummary] = useState(null);

  useEffect(() => {
    // Fetch initial network summary
    fetchNetworkSummary();
  }, []);

  const fetchNetworkSummary = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/summary');
      if (response.ok) {
        const data = await response.json();
        setNetworkSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch network summary:', error);
    }
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeSelect = (edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const toggleCopilot = () => {
    setCopilotOpen(!copilotOpen);
  };

  return (
    <BrowserRouter>
      <AppShell
        networkSummary={networkSummary}
        copilotOpen={copilotOpen}
        onToggleCopilot={toggleCopilot}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/topology" replace />} />
          <Route 
            path="/topology" 
            element={
              <TopologyPage 
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                onNodeSelect={handleNodeSelect}
                onEdgeSelect={handleEdgeSelect}
                copilotOpen={copilotOpen}
              />
            } 
          />
          <Route path="/overview" element={<OverviewPage networkSummary={networkSummary} />} />
          <Route path="/branches" element={<BranchesPage onNodeSelect={handleNodeSelect} />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/copilot" element={<CopilotPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;