import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import Topology from './pages/Topology';
import Overview from './pages/Overview';
import Branches from './pages/Branches';
import Alerts from './pages/Alerts';
import Predictions from './pages/Predictions';
import Runbooks from './pages/Runbooks';
import Reports from './pages/Reports';
import SettingsPage from './pages/SettingsPage';
import LoopEnginePanel from './pages/LoopEnginePanel';
import CopilotWidget from './components/CopilotWidget';
import LoginOnboard from './pages/LoginOnboard';
import './App.css';

// Incident Templates for game-like simulation
const incidentTemplates = [
  {
    type: "MPLS Tunnel Degradation",
    severity: "CRITICAL",
    message: "High packet loss (7.8%) detected on Primary MPLS tunnel.",
    metrics: { packet_loss_pct: 7.8, utilization_pct: 85.0, latency_ms: 120.0 },
    steps: [
      { label: "Drain congested MPLS tunnel link", status: "pending" },
      { label: "Reroute transit packets via Backup IPSec VPN path", status: "pending" },
      { label: "Verify link health and clear BGP warnings", status: "pending" }
    ]
  },
  {
    type: "BGP Peering Route Flap",
    severity: "CRITICAL",
    message: "BGP prefix advertisement drops detected. Routing loop risk.",
    metrics: { packet_loss_pct: 3.5, utilization_pct: 45.0, latency_ms: 85.0 },
    steps: [
      { label: "Reset BGP peering sessions", status: "pending" },
      { label: "Re-advertise stable prefix maps", status: "pending" },
      { label: "Flush transit routing table cache", status: "pending" }
    ]
  },
  {
    type: "SD-WAN Policy Drift",
    severity: "WARNING",
    message: "Local device configuration hash mismatch. Policy sync failed.",
    metrics: { packet_loss_pct: 1.8, utilization_pct: 72.0, latency_ms: 95.0 },
    steps: [
      { label: "Re-push SD-WAN policy template from controller", status: "pending" },
      { label: "Synchronize local config validation checksums", status: "pending" }
    ]
  },
  {
    type: "DDoS Mitigation Scrubbing",
    severity: "CRITICAL",
    message: "Sudden ingress traffic spike. Bandwidth saturation warning.",
    metrics: { packet_loss_pct: 9.5, utilization_pct: 98.0, latency_ms: 210.0 },
    steps: [
      { label: "Activate edge rate-limiting security group rules", status: "pending" },
      { label: "Divert suspicious prefixes to scrubbing center", status: "pending" },
      { label: "Verify egress path flow normalization", status: "pending" }
    ]
  }
];

// Web Audio API Sound Synthesizer for NOC audible alarms
const playAlertSound = (severity = 'CRITICAL') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    if (severity === 'CRITICAL') {
      // Double alarm chirp (High A5 note)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.16);
      gain2.gain.setValueAtTime(0.12, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.28);
    } else {
      // Warm warning tone (Triangle D5 note)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (err) {
    console.warn("Audio playback blocked or failed:", err);
  }
};

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'dark');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isro-noc-auth') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [liveSummary, setLiveSummary] = useState(null);
  const [liveTopology, setLiveTopology] = useState(null);
  const [liveBranches, setLiveBranches] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);

  // Game-like interactive incident states
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [currentToast, setCurrentToast] = useState(null);

  // Play audible alarm when toast fires
  useEffect(() => {
    if (currentToast) {
      playAlertSound(currentToast.severity);
    }
  }, [currentToast]);
  
  const [activePolicies, setActivePolicies] = useState({
    block_streaming: false,
    scavenger_qos: false,
    load_balancers: true,
    maintenance_nodes: []
  });

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/settings/policy');
        if (response.ok) {
          const data = await response.json();
          setActivePolicies(data);
        }
      } catch (error) {
        console.error('Failed to fetch global policies:', error);
      }
    };
    fetchPolicies();
    const interval = setInterval(fetchPolicies, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial data on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const [sumRes, topRes, brRes, alRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/summary'),
          fetch('http://127.0.0.1:8000/topology'),
          fetch('http://127.0.0.1:8000/branches'),
          fetch('http://127.0.0.1:8000/alerts')
        ]);
        if (sumRes.ok) setLiveSummary(await sumRes.json());
        if (topRes.ok) setLiveTopology(await topRes.json());
        if (brRes.ok) {
          const data = await brRes.json();
          setLiveBranches(data.branches || []);
        }
        if (alRes.ok) {
          const data = await alRes.json();
          setLiveAlerts(data.alerts || []);
        }

        // Initialize Bangalore CRITICAL and Chennai WARNING incidents on start
        setTimeout(() => {
          const bangaloreTemplate = incidentTemplates[0]; // MPLS Tunnel Degradation
          const chennaiTemplate = incidentTemplates[2]; // SD-WAN Policy Drift

          const inc1 = {
            id: `INC-1024`,
            nodeId: 'branch-bengaluru',
            type: bangaloreTemplate.type,
            severity: bangaloreTemplate.severity,
            message: bangaloreTemplate.message,
            metrics: bangaloreTemplate.metrics,
            steps: bangaloreTemplate.steps.map((s, idx) => ({ ...s, id: idx, status: 'pending' })),
            status: 'active'
          };

          const inc2 = {
            id: `INC-1025`,
            nodeId: 'branch-chennai',
            type: chennaiTemplate.type,
            severity: chennaiTemplate.severity,
            message: chennaiTemplate.message,
            metrics: chennaiTemplate.metrics,
            steps: chennaiTemplate.steps.map((s, idx) => ({ ...s, id: idx, status: 'pending' })),
            status: 'active'
          };

          setActiveIncidents([inc1, inc2]);
          setCurrentToast({
            id: inc1.id,
            nodeId: inc1.nodeId,
            type: inc1.type,
            severity: inc1.severity,
            message: inc1.message
          });
        }, 1200);

      } catch (e) {
        console.error("Init fetch failed:", e);
      }
    };
    initData();
  }, []);

  // Telemetry simulation progression loop
  useEffect(() => {
    if (!liveSummary || !liveTopology || liveBranches.length === 0) return;

    const interval = setInterval(() => {
      // 1. Fluctuate branch stats (respect active incidents, maintenance windows, and shaper policies)
      const nextBranches = liveBranches.map(br => {
        // A. Respect scheduled maintenance window
        if (activePolicies.maintenance_nodes?.includes(br.id)) {
          const currentMetrics = {
            latency_ms: 12.5,
            bandwidth_util_pct: 32.4,
            packet_loss_pct: 0.0,
            jitter_ms: 0.8
          };
          
          // Auto resolve any active incident for it
          const activeInc = activeIncidents.find(inc => inc.nodeId === br.id && inc.status === 'active');
          if (activeInc) {
            setTimeout(() => {
              handleResolveIncident(activeInc.id, 'remediation');
            }, 0);
          }
          
          return {
            ...br,
            status: 'NORMAL',
            latency_ms: 12.5,
            packet_loss_pct: 0.0,
            utilization_pct: 32.4,
            current_metrics: currentMetrics
          };
        }

        const activeInc = activeIncidents.find(inc => inc.nodeId === br.id && inc.status === 'active');
        
        // B. If streaming block shaper policy is active, auto-resolve congestion incidents
        if (activeInc && activePolicies.block_streaming && 
            (activeInc.type.toLowerCase().includes('congestion') || 
             activeInc.type.toLowerCase().includes('exhaustion') || 
             activeInc.type.toLowerCase().includes('utilization'))) {
          setTimeout(() => {
            handleResolveIncident(activeInc.id, 'firewall_policy');
          }, 0);
        }

        // C. If scavenger QoS policy is active, auto-resolve tunnel/latency/loss/degradation incidents
        if (activeInc && activePolicies.scavenger_qos && 
            (activeInc.type.toLowerCase().includes('tunnel') || 
             activeInc.type.toLowerCase().includes('latency') || 
             activeInc.type.toLowerCase().includes('loss') ||
             activeInc.type.toLowerCase().includes('degradation'))) {
          setTimeout(() => {
            handleResolveIncident(activeInc.id, 'qos_policy');
          }, 0);
        }

        // D. If load balancers policy is active, auto-resolve routing/BGP incidents
        if (activeInc && activePolicies.load_balancers && 
            (activeInc.type.toLowerCase().includes('bgp') || 
             activeInc.type.toLowerCase().includes('flap') || 
             activeInc.type.toLowerCase().includes('route') ||
             activeInc.type.toLowerCase().includes('routing'))) {
          setTimeout(() => {
            handleResolveIncident(activeInc.id, 'route_optimization');
          }, 0);
        }

        if (activeInc) {
          const currentMetrics = { ...br.current_metrics, ...activeInc.metrics };
          // Keep it degraded but add a small fluctuation
          currentMetrics.latency_ms = Math.max(60.0, parseFloat((currentMetrics.latency_ms + (Math.random() - 0.5) * 4.0).toFixed(2)));
          currentMetrics.bandwidth_util_pct = Math.max(70.0, Math.min(100.0, parseFloat((currentMetrics.bandwidth_util_pct + (Math.random() - 0.5) * 1.5).toFixed(2))));
          currentMetrics.packet_loss_pct = Math.max(1.0, Math.min(15.0, parseFloat((currentMetrics.packet_loss_pct + (Math.random() - 0.5) * 0.3).toFixed(2))));

          return {
            ...br,
            status: activeInc.severity,
            latency_ms: currentMetrics.latency_ms,
            packet_loss_pct: currentMetrics.packet_loss_pct,
            utilization_pct: currentMetrics.bandwidth_util_pct,
            current_metrics: currentMetrics
          };
        }

        const currentMetrics = { ...br.current_metrics };
        const latencyOffset = (Math.random() - 0.5) * 1.0;
        const utilOffset = (Math.random() - 0.5) * 2.5;
        
        currentMetrics.latency_ms = Math.max(0.5, parseFloat((currentMetrics.latency_ms + latencyOffset).toFixed(2)));
        currentMetrics.bandwidth_util_pct = Math.max(5.0, Math.min(100.0, parseFloat((currentMetrics.bandwidth_util_pct + utilOffset).toFixed(2))));
        currentMetrics.packet_loss_pct = Math.max(0.0, Math.min(10.0, parseFloat((currentMetrics.packet_loss_pct + (Math.random() - 0.5) * 0.1).toFixed(2))));
        
        let status = 'NORMAL';
        if (currentMetrics.bandwidth_util_pct > 80.0 || currentMetrics.packet_loss_pct > 5.0) {
          status = 'CRITICAL';
        } else if (currentMetrics.bandwidth_util_pct > 60.0 || currentMetrics.packet_loss_pct > 2.0) {
          status = 'WARNING';
        }
        
        return {
          ...br,
          status,
          latency_ms: currentMetrics.latency_ms,
          packet_loss_pct: currentMetrics.packet_loss_pct,
          utilization_pct: currentMetrics.bandwidth_util_pct,
          current_metrics: currentMetrics
        };
      });

      // 2. Synchronize topology node stats
      const nextNodes = { ...liveTopology.nodes };
      Object.keys(nextNodes).forEach(nodeId => {
        const node = { ...nextNodes[nodeId] };
        const matchingBranch = nextBranches.find(b => b.id === nodeId);
        if (matchingBranch) {
          node.status = matchingBranch.status;
          node.metrics = {
            ...node.metrics,
            latency_ms: matchingBranch.latency_ms,
            packet_loss_pct: matchingBranch.packet_loss_pct,
            utilization_pct: matchingBranch.utilization_pct
          };

          // Attach active incident details to node predictions checklist
          const activeInc = activeIncidents.find(inc => inc.nodeId === nodeId && inc.status === 'active');
          if (activeInc) {
            node.prediction = {
              issue: activeInc.type,
              confidence: 0.98,
              eta_minutes: 5,
              reasoning: activeInc.message,
              recommended_actions: activeInc.steps.map(s => s.label)
            };
          } else {
            // Remove prediction warning if resolved
            delete node.prediction;
          }
        } else {
          // Delhi Hub / DC Core fluctuations
          const m = { ...node.metrics };
          m.latency_ms = Math.max(0.1, parseFloat((m.latency_ms + (Math.random() - 0.5) * 0.1).toFixed(2)));
          m.utilization_pct = Math.max(5.0, Math.min(100.0, parseFloat((m.utilization_pct + (Math.random() - 0.5) * 1.2).toFixed(2))));
          node.metrics = m;
        }
        nextNodes[nodeId] = node;
      });

      // 3. Synchronize topology edge stats
      const nextEdges = liveTopology.edges.map(edge => {
        const m = { ...edge.metrics };
        m.latency_ms = Math.max(0.5, parseFloat((m.latency_ms + (Math.random() - 0.5) * 0.3).toFixed(2)));
        m.utilization_pct = Math.max(5.0, Math.min(100.0, parseFloat((m.utilization_pct + (Math.random() - 0.5) * 2.0).toFixed(2))));
        
        let status = 'NORMAL';
        if (m.utilization_pct > 75.0) status = 'CRITICAL';
        else if (m.utilization_pct > 55.0) status = 'DEGRADED';
        
        return {
          ...edge,
          status,
          metrics: m
        };
      });

      // 4. Summarize dynamic node health counters
      const criticalCount = Object.values(nextNodes).filter(n => n.status === 'CRITICAL').length;
      const warningCount = Object.values(nextNodes).filter(n => n.status === 'WARNING').length;
      const normalCount = Object.values(nextNodes).filter(n => n.status === 'NORMAL').length;
      
      let overallHealth = 'NORMAL';
      if (criticalCount > 0) overallHealth = 'CRITICAL';
      else if (warningCount > 0) overallHealth = 'DEGRADED';

      const nextSummary = {
        ...liveSummary,
        overall_health: overallHealth,
        critical_nodes: criticalCount,
        warning_nodes: warningCount,
        normal_nodes: normalCount,
        alert_count: {
          critical: criticalCount + 2,
          warning: warningCount + 6
        }
      };

      // 5. Sync dynamic alert records
      let nextAlerts = [...liveAlerts];
      nextBranches.forEach(br => {
        const activeInc = activeIncidents.find(inc => inc.nodeId === br.id && inc.status === 'active');
        if (activeInc) {
          const alreadyAlerted = nextAlerts.some(a => a.entity_name === br.name && a.message.includes(activeInc.type));
          if (!alreadyAlerted) {
            nextAlerts.unshift({
              id: `INC-SIM-${Date.now()}`,
              entity_name: br.name,
              message: `${activeInc.type}: ${activeInc.message}`,
              severity: activeInc.severity.toLowerCase(),
              timestamp: new Date().toISOString().replace('Z', '').split('.')[0],
              metrics: br.current_metrics
            });
          }
        }
      });

      setLiveBranches(nextBranches);
      setLiveTopology({
        ...liveTopology,
        nodes: nextNodes,
        edges: nextEdges
      });
      setLiveSummary(nextSummary);
      setLiveAlerts(nextAlerts);

    }, 5000);

    return () => clearInterval(interval);
  }, [liveSummary, liveTopology, liveBranches, liveAlerts, activeIncidents, activePolicies]);

  // Periodic random incident generator (trigger problem check every 45s)
  useEffect(() => {
    if (!liveBranches.length) return;

    const interval = setInterval(() => {
      // Don't inject if there are already active incidents
      const hasActive = activeIncidents.some(inc => inc.status === 'active');
      if (hasActive) return;

      // Select a random branch node
      const randomBranch = liveBranches[Math.floor(Math.random() * liveBranches.length)];
      if (randomBranch) {
        injectIncident(randomBranch.id);
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [liveBranches, activeIncidents]);

  // Periodic random Bandwidth Abuser event generator
  useEffect(() => {
    if (!liveBranches.length || !isAuthenticated) return;

    const interval = setInterval(() => {
      // Don't inject if there is already an active incident or security toast
      if (currentToast) return;

      const nonHqBranches = liveBranches.filter(b => b.id !== 'hub-delhi' && b.id !== 'dc-mumbai');
      if (nonHqBranches.length === 0) return;
      const target = nonHqBranches[Math.floor(Math.random() * nonHqBranches.length)];
      
      const apps = [
        { name: 'YouTube', appName: 'YouTube (4K Video Stream)', wasted: '2.3GB' },
        { name: 'Facebook', appName: 'Facebook Video Scrolling', wasted: '1.4GB' },
        { name: 'BitTorrent', appName: 'High-Volume Bittorrent Download', wasted: '8.7GB' },
        { name: 'Netflix', appName: 'Netflix (HD Streaming)', wasted: '3.1GB' }
      ];
      const selectedApp = apps[Math.floor(Math.random() * apps.length)];
      
      const nodeId = target.id;
      const branchName = target.name || nodeId.replace('branch-', '').toUpperCase();

      setCurrentToast({
        id: `SEC-AUDIT-${Date.now()}`,
        nodeId: nodeId,
        type: 'SECURITY_AUDIT',
        severity: 'warning',
        message: `${selectedApp.name} traffic detected on ${nodeId}, ${selectedApp.wasted} wasted.`,
        appName: selectedApp.appName,
        wasted: selectedApp.wasted,
        branchName: branchName
      });
    }, 40000);

    return () => clearInterval(interval);
  }, [liveBranches, currentToast, isAuthenticated]);

  // Global listener for node selection requests
  useEffect(() => {
    const handleSelectNodeEvent = (e) => {
      const nodeId = e.detail;
      if (liveTopology && liveTopology.nodes && liveTopology.nodes[nodeId]) {
        setSelectedNode(liveTopology.nodes[nodeId]);
        setSelectedEdge(null);
      }
    };
    window.addEventListener('selectTopologyNode', handleSelectNodeEvent);
    return () => window.removeEventListener('selectTopologyNode', handleSelectNodeEvent);
  }, [liveTopology]);

  // Listen to chaos injection events from Loop Engine Control Panel
  useEffect(() => {
    const handleInjectChaos = (e) => {
      const type = e.detail;
      let templateIdx = 0;
      if (type === 'bgp_flap') templateIdx = 1;
      else if (type === 'congestion') templateIdx = 3;
      else if (type === 'tunnel_fail') templateIdx = 0;

      const template = incidentTemplates[templateIdx];
      const nonHqBranches = liveBranches.filter(b => b.id !== 'hub-delhi' && b.id !== 'dc-mumbai');
      if (nonHqBranches.length === 0) return;
      const targetBranch = nonHqBranches[Math.floor(Math.random() * nonHqBranches.length)];

      if (activeIncidents.some(i => i.nodeId === targetBranch.id && i.status === 'active')) {
        return;
      }

      const newIncident = {
        id: `INC-${Date.now().toString().slice(-4)}`,
        nodeId: targetBranch.id,
        type: template.type,
        severity: template.severity,
        message: template.message,
        metrics: template.metrics,
        steps: template.steps.map((s, idx) => ({ ...s, id: idx, status: 'pending' })),
        status: 'active'
      };

      setActiveIncidents(prev => [...prev, newIncident]);
      setCurrentToast({
        id: newIncident.id,
        nodeId: newIncident.nodeId,
        type: newIncident.type,
        severity: newIncident.severity,
        message: newIncident.message
      });
    };
    window.addEventListener('injectChaos', handleInjectChaos);
    return () => window.removeEventListener('injectChaos', handleInjectChaos);
  }, [liveBranches, activeIncidents]);

  // Inject a new incident manually/randomly
  const injectIncident = (nodeId) => {
    const template = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
    const newIncident = {
      id: `INC-${Date.now().toString().slice(-4)}`,
      nodeId,
      type: template.type,
      severity: template.severity,
      message: template.message,
      metrics: template.metrics,
      steps: template.steps.map((s, idx) => ({ ...s, id: idx, status: 'pending' })),
      status: 'active'
    };

    setActiveIncidents(prev => {
      if (prev.some(inc => inc.nodeId === nodeId && inc.status === 'active')) {
        return prev;
      }
      return [...prev, newIncident];
    });

    setCurrentToast({
      id: newIncident.id,
      nodeId,
      type: newIncident.type,
      severity: newIncident.severity,
      message: newIncident.message
    });

    // Append log alert record
    setLiveAlerts(prev => [
      {
        id: `INC-ALERT-${Date.now()}`,
        entity_name: nodeId,
        message: `${newIncident.type}: ${newIncident.message}`,
        severity: newIncident.severity.toLowerCase(),
        timestamp: new Date().toISOString().replace('Z', '').split('.')[0],
        metrics: newIncident.metrics
      },
      ...prev
    ]);
  };

  // Resolve active incident fully
  const handleResolveIncident = (incidentId, method = 'manual') => {
    setActiveIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return {
          ...inc,
          status: 'resolved',
          steps: inc.steps.map(s => ({ ...s, status: 'completed' }))
        };
      }
      return inc;
    }));

    const incident = activeIncidents.find(inc => inc.id === incidentId);
    if (incident) {
      // Stabilize the branch metrics immediately in the liveBranches state
      setLiveBranches(prev => prev.map(br => {
        if (br.id === incident.nodeId) {
          return {
            ...br,
            status: 'NORMAL',
            latency_ms: 12.5,
            packet_loss_pct: 0.0,
            utilization_pct: 35.0,
            current_metrics: {
              latency_ms: 12.5,
              packet_loss_pct: 0.0,
              bandwidth_util_pct: 35.0,
              jitter_ms: 1.5
            }
          };
        }
        return br;
      }));

      setLiveAlerts(prev => [
        {
          id: `RESOLVE-ALERT-${Date.now()}`,
          entity_name: incident.nodeId,
          message: `Incident ${incident.type} RESOLVED via ${method.toUpperCase()}. Telemetry stabilized.`,
          severity: 'info',
          timestamp: new Date().toISOString().replace('Z', '').split('.')[0],
          metrics: { latency_ms: 12.5, packet_loss_pct: 0.0, utilization_pct: 35.0 }
        },
        ...prev
      ]);
    }

    if (currentToast && currentToast.id === incidentId) {
      setCurrentToast(null);
    }
  };

  // Execute a single step in manual remediation checklist
  const handleStepExecute = (incidentId, stepId) => {
    setActiveIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        const nextSteps = inc.steps.map(s => {
          if (s.id === stepId) {
            return { ...s, status: 'completed' };
          }
          return s;
        });

        const allDone = nextSteps.every(s => s.status === 'completed');
        return {
          ...inc,
          steps: nextSteps,
          status: allDone ? 'resolved' : inc.status
        };
      }
      return inc;
    }));

    // Auto-stabilize node once last checklist action completes
    setTimeout(() => {
      setActiveIncidents(curr => {
        const inc = curr.find(i => i.id === incidentId);
        if (inc && inc.steps.every(s => s.status === 'completed') && inc.status === 'active') {
          handleResolveIncident(incidentId, 'manual');
        }
        return curr;
      });
    }, 100);
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeSelect = (edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <LoginOnboard onLoginSuccess={() => setIsAuthenticated(true)} />
      ) : (
        <>
          <AppShell 
            networkSummary={liveSummary}
            currentToast={currentToast}
            onCloseToast={() => setCurrentToast(null)}
            onResolveIncident={handleResolveIncident}
          >
            <Routes>
              <Route 
                path="/" 
                element={
                  <Overview 
                    networkSummary={liveSummary} 
                    topology={liveTopology} 
                    alerts={liveAlerts} 
                    onNodeSelect={handleNodeSelect} 
                  />
                } 
              />
              <Route 
                path="/topology" 
                element={
                  <Topology 
                    topology={liveTopology}
                    networkSummary={liveSummary}
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    onNodeSelect={handleNodeSelect}
                    onEdgeSelect={handleEdgeSelect}
                    activeIncidents={activeIncidents}
                    onStepExecute={handleStepExecute}
                    onResolveIncident={handleResolveIncident}
                  />
                } 
              />
              <Route 
                path="/branches" 
                element={
                  <Branches 
                    branches={liveBranches} 
                    onNodeSelect={handleNodeSelect} 
                  />
                } 
              />
              <Route 
                path="/alerts" 
                element={
                  <Alerts 
                    alerts={liveAlerts} 
                  />
                } 
              />
              <Route 
                path="/predictions" 
                element={
                  <Predictions 
                    topology={liveTopology} 
                  />
                } 
              />
              <Route 
                path="/reports" 
                element={
                  <Reports />
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <SettingsPage theme={theme} setTheme={setTheme} />
                } 
              />
              <Route 
                path="/loop-engine" 
                element={
                  <LoopEnginePanel activeIncidents={activeIncidents} />
                } 
              />
              <Route 
                path="/runbooks" 
                element={
                  <Runbooks />
                } 
              />
            </Routes>
          </AppShell>
          
          {/* Universal Floating Copilot popup chatbot */}
          <CopilotWidget 
            activeIncidents={activeIncidents}
            liveBranches={liveBranches}
            onResolveIncident={handleResolveIncident}
          />
        </>
      )}
    </BrowserRouter>
  );
}

export default App;