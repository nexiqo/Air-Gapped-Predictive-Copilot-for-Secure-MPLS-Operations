# 🛰️ ISRO HACKATHON 2026: SUBMISSION & JUDGES' GUIDE
## Challenge 13: Air-Gapped Predictive Copilot for Secure MPLS Operations

---

## 1. Executive Summary
This platform is a state-of-the-art **Air-Gapped Predictive Network Operations Center (NOC) Copilot** designed specifically for high-security, mission-critical environments (such as satellite ground stations, defense communication networks, and space operations centers). 

Operating under strict security protocols where cloud-based AI and internet-connected systems are prohibited, this solution delivers **real-time anomaly prediction, automated self-healing orchestration (Maker-Checker), and an intelligent local RAG-based Copilot** running 100% offline.

---

## 2. System Architecture & Tech Stack

```
+-------------------------------------------------------------------------+
|                        React-based User Interface                       |
|   (Holographic Login, Live Topology Canvas, Incident Lifecycles, etc.)   |
+------------------------------------+------------------------------------+
                                     |
                       WebSockets / HTTP Fallback
                                     v
+-------------------------------------------------------------------------+
|                         FastAPI Backend Server                          |
|    (Uvicorn Engine, Telemetry Synthesizer, Loop Orchestrator API)       |
+--------------------+---------------+- -----------------+----------------+
                     |                |                  |
                     v                v                  v
+------------------------+  +------------------+  +-------------------+
|  Local RAG Knowledge   |  |   Supervised ML  |  |   Loop Engine     |
|   Base (ChromaDB +    |  | Classifier (Scikit|  |   (Autonomous     |
|   TF-IDF Fast-path)    |  |   Random Forest) |  |   Maker-Checker)  |
+------------------------+  +------------------+  +-------------------+
```

### Core Technologies
1. **Frontend**: React.js with Vanilla CSS for a customized, high-performance, dark-mode-first dashboard.
2. **Backend**: Python 3.10+ powered by **FastAPI** and **Uvicorn** for low-latency asynchronous API operations and real-time WebSocket communication.
3. **Machine Learning**: **Scikit-Learn** for the supervised Random Forest classifier, alongside an interactive **Explainable AI (XAI)** simulation engine.
4. **AI/NLP**: Local Vector Store database (ChromaDB) paired with a high-speed, sub-millisecond keyword-mapping fallback (TF-IDF) for offline Llama3/Ollama LLM interactions.
5. **Real-time Push**: HTML5 WebSockets with automatic HTTP polling fallback for maximum reliability.
6. **Audible Alarms**: HTML5 Web Audio API synthesizer for browser-native sound wave generation (no external audio assets required).

---

## 3. Core Capabilities & Feature Catalog

### A. Secure Holographic Operator Gate
* **Authentication**: Restricts dashboard access to verified credentials (Operator ID: `ISRO-NOC-77`, Passkey: `isronoc2026`).
* **Interactive Visuals**: Renders a security scanning laser, real-time decrypting logs, and an ambient background grid.
* **Audio Init**: Unlocks the browser's audio permissions upon the first click, allowing background alarm sound waves to play without being blocked by modern browser security policies.

### B. Live Telemetry & Site Monitor
* **Geographical Latency Simulation**: Uses realistic routing latencies matching physical fiber distances from the New Delhi Hub (e.g. Mumbai: ~8.4ms, Bengaluru: ~12.5ms, Northeast/Guwahati: ~46.2ms, Chennai: ~31.8ms, etc.).
* **Metric Badges**: Replaced heavy line-wise graphs with clean, status-colored numerical latency badges that give a real-time status indication at a glance.
* **SLA Area Chart**: An interactive gradient area chart that tracks the global average SLA latency across the entire network in real time.

### C. NOC Incident Lifecycle Timeline
* **Horizontal Tracker**: A visual timeline at the bottom of the cockpit outlining the real-time status of incident remediation.
* **Milestones**: Tracks each incident's lifecycle: `Incident Triggered` [Red] ➔ `Loop Engaged` [Purple] ➔ `Verified Recovery` [Green].
* **Pulsing States**: Actively pulses the progress dot corresponding to the active stage of the loop engine (Triage, Mitigation, or Verification).

### D. Autonomous Loop Engineering (Maker-Checker 2.0)
* **n8n-style Node Map**: Visualizes the internal pipeline steps of the self-healing engine (Triage ➔ Mitigation ➔ Verification ➔ Resolution).
* **Maker-Checker Checklist**: Ensures that automated actions are double-verified (e.g., config changes are checked against live telemetry) before resolving an incident.
* **Chaos Engineering**: Allows the judges to manually inject network failures (Link Cut, BGP Flap, Congestion Spike) to watch the loop engine automatically detect, mitigate, and resolve the issue in under 30 seconds.

### E. Bandwidth Abuser Security Audit
* **Intelligent Sniffing**: Detects non-business network traffic (YouTube, BitTorrent, Facebook) causing congestion on remote branches.
* **Toast Notifications**: Pops up real-time security alerts (e.g., `"YouTube traffic detected on branch-pune, 2.3GB wasted"`).
* **QoS Action Link**: Clicking "Deploy Rate-Limiter QoS" directly loads the necessary commands into the Copilot chat queue for execution.

### F. Intelligent Local Copilot
* **Session History Memory**: Saves past conversations locally in `localStorage`, allows session switching, and automatically names sessions based on the first prompt.
* **SOP Link Navigation**: Clicking `[OPEN SOP]` inside the chat closes the Copilot, opens the **Runbooks Library**, and automatically scrolls to and expands the correct Standard Operating Procedure (SOP).
* **Fast-Path Responses**: Bypasses LLM latency bottlenecks for common queries, resulting in sub-millisecond response times.

### G. Executive PDF & HTML Report Generator
* **Clean Print Layout**: Formats executive summaries, incident logs, and SLA metrics into an exportable layout.
* **Browser-Native PDF Export**: Opens the native print dialog to quickly print or save the report as a PDF.

---

## 4. How We Built It (Step-by-Step)

1. **Database & Data Loader**: Created a seed database (`topology.json`, `network_summary.json`) using real-world geographical coordinates of Indian cities.
2. **Predictive Model**: Built a supervised Random Forest classifier in `backend/ml_trainer.py` to identify 5 network states (Nominal, Congestion, Routing Instability, Tunnel Health Drop, Policy Drift).
3. **API & WebSockets**: Implemented a FastAPI server in `backend/main.py`. Added a WebSocket channel (`/ws/telemetry`) to stream active loops and historical states.
4. **Holographic Frontend**: Coded a modern, dark-themed dashboard using React, featuring a custom SVG renderer, responsive cards, and audio synthesis using `AudioContext`.
5. **Copilot & RAG**: Linked a local TF-IDF search engine with a knowledge base containing standard network playbooks, facilitating quick and context-aware responses.

---

## 5. Walkthrough Guide for Judges

To demonstrate the full power of this platform to a judge, follow these steps:

1. **Log In**: Enter `ISRO-NOC-77` (Operator ID) and `isronoc2026` (Passkey) and click **"Authorize Clearance"**.
2. **Observe the Live Telemetry**: Point out the **Topology Site Monitor** with live, fluctuating, realistic latencies, and the **SLA Latency Area Chart**.
3. **Inject Anomaly (Chaos)**: Navigate to the **Loop Engine** tab, and click **"Inject BGP Flap"** or **"Inject Link Cut"**. 
4. **Watch the Self-Healing**: Go back to the **Overview** page. You will see a critical alert appear, hear the audible alarm chime, and watch the **NOC Incident Lifecycle Timeline** pulse through "Loop Engaged" to "Verified Recovery" as the system automatically resolves the issue.
5. **Ask Copilot**: Open the Copilot panel, click the suggested prompt *"What is likely to fail next?"*, and watch the sub-millisecond response.
6. **Generate Report**: Navigate to the **Reports** tab and click **"Print / Export PDF"** to export the completed incident report.
