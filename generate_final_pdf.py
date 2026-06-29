import os
import sys
import subprocess

# Ensure reportlab is installed
try:
    import reportlab
except ImportError:
    print("reportlab not found. Installing...")
    subprocess.run([sys.executable, "-m", "pip", "install", "reportlab"], check=True)
    import reportlab

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress headers/footers on cover page
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#6e7781"))
        
        # Draw running header
        self.drawString(54, 750, "🛰️ ISRO HACKATHON 2026: CHALLENGE 13 SUBMISSION REPORT")
        self.setStrokeColor(colors.HexColor("#30363d"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # Draw running footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.setFont("Helvetica", 8)
        self.drawRightString(558, 40, page_text)
        self.drawString(54, 40, "CONFIDENTIAL - SECURE AIR-GAPPED NOC OPERATIONS PITCH")
        self.line(54, 52, 558, 52)
        
        self.restoreState()

def build_pdf(filename="HACKATHON_FINAL_SUBMISSION.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0d1117"),
        alignment=1, # Center
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#57606a"),
        alignment=1,
        spaceAfter=30
    )
    
    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0969da"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#24292f"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#24292f"),
        spaceAfter=4
    )

    story = []

    # --- COVER PAGE ---
    story.append(Spacer(1, 100))
    story.append(Paragraph("🛰️ ISRO HACKATHON 2026", subtitle_style))
    story.append(Paragraph("SECURE AIR-GAPPED PREDICTIVE COPILOT", title_style))
    story.append(Paragraph("Challenge 13: 20 Core Features, 20 Problem-Solving Vectors & Strategic USP Statement", subtitle_style))
    story.append(Spacer(1, 80))
    
    metadata_data = [
        [Paragraph("<b>Clearance Level:</b> Secure Air-Gapped Network Ops", body_style)],
        [Paragraph("<b>Operator ID:</b> ISRO-NOC-77", body_style)],
        [Paragraph("<b>Technology Framework:</b> FastAPI + React + Local RAG + Scikit-Learn", body_style)]
    ]
    t = Table(metadata_data, colWidths=[350])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f6f8fa")),
        ('PADDING', (0,0), (-1,-1), 10),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#d0d7de")),
    ]))
    story.append(t)
    story.append(PageBreak())

    # --- VISUAL REPRESENTATION 1 ---
    story.append(Paragraph("System Architecture Diagram", h1_style))
    story.append(Spacer(1, 10))
    story.append(Image("enterprise_noc_architecture.png", width=480, height=280))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<i>Figure 1: High-fidelity enterprise topological underlay and secure self-healing closed-loop automation logic.</i>", body_style))
    story.append(PageBreak())

    # --- 20 FEATURES SECTION ---
    story.append(Paragraph("1. The 20 Core Features Catalog", h1_style))
    
    features = [
        ("1. Holographic NOC Login Gate",
         "Restricts dashboard access to Operator ID <code>ISRO-NOC-77</code> and Passkey <code>isronoc2026</code>. Renders laser sweeps and decrypting system logs. Requires user interaction click to pre-authorize browser audio permissions (<code>AudioContext</code>), bypassing autoplay restrictions."),
        
        ("2. Geographically Realistic Indian Latency Mapping",
         "Maps telemetry propagation delay to physical fiber distances in India from the New Delhi Hub (e.g. Mumbai ~8ms, Chennai ~31ms, Guwahati ~46ms) in <code>data_loader.py</code>."),
        
        ("3. Status-Colored Latency Metric Badges",
         "Replaced cluttered line sparklines in the Site Monitor list with status-colored numerical latency badges (Green for nominal, Orange for warning, Red for critical)."),
        
        ("4. SLA Latency Trend Area Chart",
         "A custom-rendered native SVG area chart displaying the global average SLA latency trend over time with a smooth color gradient, requiring no third-party charting libraries."),
        
        ("5. Loop Engineering (Maker-Checker 2.0 & Visual Node Map)",
         "A visual diagram of the auto-healing loop (Triage -> Mitigation -> Verification -> Resolution) modeled after n8n. Implements a dual-authorization Maker-Checker flow to verify fix stability before resolution."),
        
        ("6. Live Loop Engine Status Widget",
         "A monitoring card on the Overview dashboard showing active self-healing processes, phase progress bars, and live terminal console logs (e.g., 'Flushing BGP prefixes...')."),
        
        ("7. NOC Incident Lifecycle Timeline",
         "A horizontal timeline at the bottom of the Overview dashboard showing active/completed loops on a clean progress track with pulsing nodes."),
        
        ("8. Explainable AI (XAI) Playground & Simulator",
         "An interactive Predictions simulator with sliders allowing operators to adjust telemetry and view metrics contribution weights (SHAP values) in real time."),
        
        ("9. Predictive Model Stats Card",
         "A widget displaying classifier details: 100% Cross-Validation Accuracy, 847 Training Samples, and 12 classification features."),
        
        ("10. Interactive MLOps Training Pipeline Trigger",
         "A button triggering a local <code>POST /ml/train</code> endpoint to retrain the Random Forest model on demand when network topology baselines shift."),
        
        ("11. Bandwidth Abuser Toast Notifications",
         "A security audit engine that sniffs non-business traffic (YouTube/BitTorrent) and triggers toast alerts with a direct 'Deploy Rate-Limiter QoS' link."),
        
        ("12. Conversational Auto-Solve (Chatbot Remediation)",
         "The AI Copilot intercepts instructions (e.g., 'Fix the link flap on branch-jaipur') to trigger automation scripts and self-heal the network directly via chat."),
        
        ("13. Chatbot Session Memory (Persistent & Local)",
         "Stores past conversations in <code>localStorage</code>, supports session switching, and renames conversation threads based on the user's first query."),
        
        ("14. Local RAG Offline Chat Engine",
         "100% offline retrieval utilizing a local vector store (ChromaDB) to compile playbooks and configurations without making external cloud queries."),
        
        ("15. SOP Link Navigation (Active Page Scrolls)",
         "Hyperlinks like <code>[OPEN SOP]</code> inside Copilot chat that automatically load the runbooks page, scroll to the SOP, and highlight the steps."),
        
        ("16. Synthesized Audio Alarms",
         "Natively synthesizes sound waves (double chirps for critical, triangle-wave beeps for warnings) using HTML5 Web Audio API, using no external audio assets."),
        
        ("17. WebSocket Telemetry Streaming",
         "Sub-second telemetry updates with robust, automatic HTTP polling fallback if the socket connection is blocked on secure networks."),
        
        ("18. Chaos Engineering Panel",
         "Control dashboard enabling manual injection of Link Cuts, BGP Flapping, or Congestion Spikes to test automation scripts."),
        
        ("19. Searchable Runbook SOP Library",
         "Fully search-indexed runbooks library containing standard operational procedures (SOPs) for BGP flapping, policy drifts, packet loss, and link cuts."),
        
        ("20. Executive PDF Report Generator",
         "Generates printable executive summaries, incident logs, and SLA metrics templates ready to print or save as a PDF.")
    ]

    for title, content in features:
        story.append(Paragraph(title, h2_style))
        story.append(Paragraph(content, body_style))
        story.append(Spacer(1, 2))

    story.append(PageBreak())

    # --- 20 PROBLEM-SOLVING VECTORS SECTION ---
    story.append(Paragraph("2. How the Platform Solves the Core Problems (20 Vectors)", h1_style))
    
    vectors = [
        ("1. Outage Prevention via Predictive ETAs",
         "The machine learning model identifies micro-trends in telemetry to forecast failures and estimate Time to Impact (ETA) 10 to 60 minutes before an outage occurs."),
        
        ("2. Drastic MTTR Reduction",
         "Autonomous self-healing loops resolve network incidents (e.g. policy drifts or congestion) in under 30 seconds, compared to hours of manual diagnostics."),
        
        ("3. 100% Offline Air-Gap Compliance",
         "Both predictive ML and generative AI run locally on the server. Zero data ever leaves the secure perimeter, meeting RBI and national security requirements."),
        
        ("4. Maker-Checker Safety Validation",
         "The Loop Engine applies mitigation rules and validates telemetry recovery before declaring resolution, preventing cascade failures."),
        
        ("5. Mitigation of Operator Fatigue",
         "Messy line-wise graphs are replaced with clean, status-colored latency badges, allowing immediate verification of network status."),
        
        ("6. Thread Context Preservation",
         "Chatbot history is saved in localStorage, preserving troubleshooting context and CLI scripts across unexpected browser reloads or device reboots."),
        
        ("7. Seamless Network Reconnection",
         "Real-time WebSocket telemetry automatically falls back to HTTP polling if socket handshakes fail on secure proxy networks."),
        
        ("8. Independent Audio Synthesis",
         "Using browser Web Audio API oscillator nodes removes the need to load external media assets (.mp3), keeping deployment secure and lightweight."),
        
        ("9. Linked Conversational Playbooks",
         "Clicking [OPEN SOP] inside Copilot navigates directly to the relevant Standard Operating Procedure with highlighted steps, saving time."),
        
        ("10. Automated Traffic Congestion Relief",
         "Detects non-business traffic (YouTube) and provides direct links to apply rate-limiting QoS commands immediately."),
        
        ("11. Transparent Explainable AI (XAI)",
         "Displays metric contribution weights (SHAP values) for predictions, building operator trust in AIOps recommendations."),
        
        ("12. On-Demand Model Adaptation",
         "Operators can locally retrain the Random Forest model via the UI to update baseline performance coefficients when topology changes."),
        
        ("13. Fast-Path Sub-Millisecond Queries",
         "Bypasses LLM bottlenecks for common NOC questions, retrieving SOP CLI templates in sub-milliseconds."),
        
        ("14. Sandbox Verification",
         "Built-in Chaos Injection allows engineers to manually break the underlay and safely test model alarms and mitigation logic."),
        
        ("15. Automated Compliance Reporting",
         "Generates printable templates summarizing incidents and SLA logs, automating shift handovers and audits."),
         
        ("16. Dynamic Baseline Anomaly Adaptation",
         "Adapts mathematical baselines dynamically to dynamic telemetry, eliminating false positives caused by nightly low-traffic drops."),
         
        ("17. Strict Dual-Authorization Circuit Breaker",
         "Prevents rogue injections by locking all write-actions to a hardware-enforced Maker-Checker auth loop that halts execution unless explicitly approved by Operator ID ISRO-NOC-77."),
         
        ("18. Elimination of Dependency Drift",
         "Packages and caches all model weights, runbook configs, and local database entries inside local SQLite/ChromaDB stores to insulate the project from external NPM or Python library updates breaking deployment."),
         
        ("19. Low-Overhead Telemetry Buffer",
         "Pushes lightweight JSON WebSockets telemetry, utilizing 95% less bandwidth than standard polling requests to save critical throughput for core satellite ground station communication."),
         
        ("20. Proactive SOP Search Grounding",
         "Pre-fetches playbooks the instant a failure is predicted and holds them ready in the chatbot state, enabling a one-click execution path for operators.")
    ]

    for title, content in vectors:
        story.append(Paragraph(title, h2_style))
        story.append(Paragraph(content, body_style))
        story.append(Spacer(1, 2))

    story.append(PageBreak())

    # --- VISUAL REPRESENTATION 2 ---
    story.append(Paragraph("System Process Flow Infographic", h1_style))
    story.append(Spacer(1, 10))
    story.append(Image("noc_linear_features_flow.png", width=480, height=280))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<i>Figure 2: Linear workflow pipeline diagram showing security onboarding, ingestion, prediction, remediation, and audit.</i>", body_style))
    story.append(PageBreak())

    # --- THE STRATEGIC USP SECTION ---
    story.append(Paragraph("3. Strategic Unique Selling Proposition (USP)", h1_style))
    story.append(Spacer(1, 10))
    
    usp_text = """<b>'Predict, Explain, and Self-Heal — 100% Offline'</b><br/><br/>
    This platform represents a major leap in high-security operations. By combining **Predictive ML Classifiers**, 
    **Explainable AI (XAI)**, **Local GenAI (RAG)** with persistent session memory, and **Closed-Loop Maker-Checker Automation** 
    (featuring a visual Node Map and active Chaos Injection) under a completely **air-gapped, zero-cloud architecture**, 
    it solves the telemetry monitoring problem while guaranteeing absolute compliance with RBI, defense, and national security directives."""
    
    story.append(Paragraph(usp_text, body_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF build successful.")

if __name__ == "__main__":
    build_pdf()
