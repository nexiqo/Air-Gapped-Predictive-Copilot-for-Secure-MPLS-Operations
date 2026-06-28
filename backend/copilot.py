from __future__ import annotations

import json
import re
import time
from typing import Any, Generator
from urllib.request import Request, urlopen
from urllib.error import URLError

from backend.rag import RAGService
from backend.data_loader import load_predictions, load_incidents, load_runbooks

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = "llama3"

SYSTEM_PROMPT = """You are an elite NOC (Network Operations Center) Copilot deployed in an offline, air-gapped MPLS network environment for ISRO (Indian Space Research Organisation).
If the user asks an operational or diagnostics question about a branch, incident, or network telemetry, respond with a structured NOC analysis using CAPS labels (ANALYSIS, CONFIDENCE, ROOT CAUSE, REMEDIATION STEPS, SUMMARY) without markdown headers.
If the user asks a general networking, conceptual, coding, or conversational question, respond naturally as a helpful, expert NOC engineer and general assistant using clean markdown layout (paragraphs, lists, code blocks, etc.). Be technical, concise, and precise."""


class CopilotService:
    def __init__(self) -> None:
        self.rag = RAGService()
        self._ollama_available: bool | None = None
        self._last_check = 0.0

    def _check_ollama(self) -> bool:
        """Check if Ollama is running. Cache forever once confirmed unavailable."""
        now = time.time()
        # If already confirmed False, never retry — Ollama is not installed
        if self._ollama_available is False:
            return False
        if self._ollama_available is not None and now - self._last_check < 60:
            return self._ollama_available
        try:
            req = Request("http://127.0.0.1:11434/api/tags", method="GET")
            with urlopen(req, timeout=1.0) as resp:
                data = json.loads(resp.read())
                models = [m["name"] for m in data.get("models", [])]
                self._ollama_available = any("llama" in m for m in models)
        except Exception:
            self._ollama_available = False
        self._last_check = now
        return self._ollama_available

    def status(self) -> dict[str, Any]:
        available = self._check_ollama()
        return {
            "ollama_running": available,
            "model": OLLAMA_MODEL if available else "fallback",
            "rag_docs": self.rag.doc_count(),
            "mode": "LLaMA 3 (Offline)" if available else "Deterministic Fallback"
        }

    def _get_loop_engine_context(self) -> str:
        """Fetch the live Loop Engine state and format it as Copilot-readable context."""
        try:
            from backend.loop_engine import loop_engine
            active = list(loop_engine.active_loops.values())
            history = list(loop_engine.history)

            lines = ["LOOP ENGINE — AUTONOMOUS MAKER-CHECKER STATUS:"]

            if active:
                lines.append(f"  Active verification loops ({len(active)}):")
                for loop in active:
                    checklist_summary = ", ".join(
                        f"{s['label']} [{s['status'].upper()}]" for s in loop.get("checklist", [])
                    )
                    lines.append(
                        f"  • Incident {loop['incident_id']} on {loop['node_id'].upper()}: "
                        f"Type={loop['incident_type']} | Phase={loop['phase']} | "
                        f"Latency={loop.get('last_metrics', {}).get('latency_ms', '?')}ms | "
                        f"Loss={loop.get('last_metrics', {}).get('packet_loss_pct', '?')}% | "
                        f"Checklist: [{checklist_summary}]"
                    )
            else:
                lines.append("  No active verification loops. All monitored incidents are stable.")

            if history:
                resolved = [h for h in history if h.get("status") == "resolved"]
                escalated = [h for h in history if h.get("status") == "escalated"]
                lines.append(f"  Loop history: {len(resolved)} auto-resolved, {len(escalated)} escalated to NOC operator.")
                for h in history[-3:]:
                    badge = "AUTO-RESOLVED" if h["status"] == "resolved" else "ESCALATED"
                    lines.append(f"  • [{badge}] {h['node_id'].upper()} — {h['incident_type']} at {h.get('completion_time', '?')}")

            return "\n".join(lines)
        except Exception as e:
            return f"LOOP ENGINE: Unavailable ({e})"

    def _build_live_context(self, active_incidents: list[dict] | None, live_branches: list[dict] | None) -> str:
        lines = []
        
        # 1. Inject global policies status
        try:
            from backend.main import GLOBAL_POLICIES
        except ImportError:
            GLOBAL_POLICIES = {"block_streaming": False, "scavenger_qos": False, "load_balancers": True, "maintenance_nodes": []}
            
        lines.append("GLOBAL SECURITY POLICIES:")
        lines.append(f"- Block Unauthorized Media Streaming: {'ENABLED (Active Filtering)' if GLOBAL_POLICIES.get('block_streaming') else 'DISABLED (Permissive)'}")
        lines.append(f"- Scavenger Queue Rate-Limiting: {'ENABLED (QoS Active)' if GLOBAL_POLICIES.get('scavenger_qos') else 'DISABLED (Default)'}")
        lines.append(f"- Route Optimization: {'ENABLED' if GLOBAL_POLICIES.get('load_balancers') else 'DISABLED'}")
        if GLOBAL_POLICIES.get("maintenance_nodes"):
            lines.append(f"- Sites in Maintenance Mode: {', '.join(GLOBAL_POLICIES['maintenance_nodes'])}")
        lines.append("")

        # 2. Inject Loop Engine live state
        lines.append(self._get_loop_engine_context())
        lines.append("")

        if active_incidents:
            lines.append("CURRENT ACTIVE SIMULATED INCIDENTS:")
            for inc in active_incidents:
                if inc.get("status") == "active":
                    steps_str = "; ".join([f"{idx+1}. {step.get('label')}" for idx, step in enumerate(inc.get("steps", []))])
                    lines.append(
                        f"- Incident {inc.get('id')}: {inc.get('type')} on branch/node {inc.get('nodeId')} "
                        f"(Severity: {inc.get('severity')}). Description: {inc.get('message')}. "
                        f"Remediation Steps: {steps_str}"
                    )
        else:
            lines.append("NO ACTIVE INCIDENTS REPORTED CURRENTLY.")

        if live_branches:
            lines.append("\nLIVE NETWORK STATUS & METRICS:")
            from backend.employee_simulator import generate_employee_activity, get_branch_assets_and_subnets
            for br in live_branches:
                br_id = br.get('id')
                status = br.get('status', 'NORMAL')
                
                # Check maintenance mode override
                in_maint = br_id in GLOBAL_POLICIES.get("maintenance_nodes", [])
                status_label = "MAINTENANCE" if in_maint else status
                
                extra = get_branch_assets_and_subnets(br_id)
                status_str = f"- {br.get('name')} ({br_id}): Unit={extra['role']} | Status={status_label}, Latency={br.get('latency_ms')}ms, Packet Loss={br.get('packet_loss_pct')}%, Bandwidth Util={br.get('utilization_pct')}%"
                
                # Add asset summaries
                devices = ", ".join([f"{a['name']} ({a['model']})" for a in extra['assets']])
                status_str += f" | Hardware: [{devices}]"
                
                # Extract abusers to enrich LLM prompt context
                if status != 'NORMAL' and not in_maint:
                    employees = generate_employee_activity(br_id, status, active_incidents, policies=GLOBAL_POLICIES)
                    abusers = [e for e in employees if e.get("status") == "Abuse"]
                    throttled = [e for e in employees if e.get("status") == "Throttled"]
                    if abusers:
                        abuse_details = ", ".join([
                            f"{e.get('name')} ({e.get('role')}) on {e.get('device_id')} [{e.get('ip_address')}] running '{e.get('active_application')}' utilizing {e.get('bandwidth_mbps')} Mbps"
                            for e in abusers
                        ])
                        status_str += f" | Root Cause: Bandwidth abusers detected: {abuse_details}"
                    elif throttled:
                        throttle_details = ", ".join([
                            f"{e.get('name')} throttled to {e.get('bandwidth_mbps')} Mbps on '{e.get('active_application')}'"
                            for e in throttled
                        ])
                        status_str += f" | Policies Enforced: {throttle_details}"
                lines.append(status_str)
        return "\n".join(lines)

    def query(self, question: str, conversation_history: list[dict] | None = None, active_incidents: list[dict] | None = None, live_branches: list[dict] | None = None) -> dict[str, Any]:
        """Main query method - tries local NLP router first, falls back to Ollama."""
        docs = self.rag.query(question, limit=5)
        fallback = self._generate_deterministic_fallback(question, docs, active_incidents, live_branches)
        
        is_generic_conversational = (
            fallback.get("predicted_issue") == "CONVERSATIONAL" 
            and "Offline RAG NLP Mode" in fallback.get("current_state", "")
        )
        
        if not is_generic_conversational or not self._check_ollama():
            return fallback
            
        result = self._query_ollama_chat(question, docs, conversation_history or [], active_incidents, live_branches)
        return result or fallback

    def stream_query(self, question: str, conversation_history: list[dict] | None = None, active_incidents: list[dict] | None = None, live_branches: list[dict] | None = None) -> Generator[str, None, None]:
        """Stream response. Uses high-speed local NLP router first, falls back to Ollama if general question."""
        docs = self.rag.query(question, limit=5)
        
        fallback = self._generate_deterministic_fallback(question, docs, active_incidents, live_branches)
        
        is_generic_conversational = (
            fallback.get("predicted_issue") == "CONVERSATIONAL" 
            and "Offline RAG NLP Mode" in fallback.get("current_state", "")
        )
        
        if not is_generic_conversational or not self._check_ollama():
            text = self._format_fallback_as_text(fallback)
            words = text.split(" ")
            # Yield in small groups of words for a smooth, high-fidelity simulated streaming typing effect
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i:i+3]) + " "
                yield chunk
                import time
                time.sleep(0.015)  # 15ms delay per 3 words -> smooth typing effect!
            return

        context_str = self._build_context(docs)
        live_str = self._build_live_context(active_incidents, live_branches)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Add conversation history (last 6 messages max)
        for msg in (conversation_history or [])[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Adaptive Prompting: Detect if it is a NOC operational query or a general chat query
        noc_keywords = [
            "incident", "remediate", "resolve", "solve", "fix", "branch", "hub", "dc-", "site", 
            "latency", "packet", "loss", "utilization", "status", "error", "flap", "failure", "alert", 
            "ping", "diagnose", "issue", "prediction", "warning", "critical", "bengaluru", "mumbai", 
            "delhi", "chennai", "hyderabad", "pune", "ahmedabad", "kolkata", "bhubaneswar", "guwahati", 
            "chandigarh", "jaipur", "lucknow", "kochi", "nagpur", "bhopal",
            # Loop Engine keywords
            "loop", "verify", "verification", "maker", "checker", "escalat", "mitigat", "triage",
            "autonomous", "auto-fix", "autofix", "self-heal", "loop engine", "start loop"
        ]
        q_lower = question.lower()
        is_noc_query = any(kw in q_lower for kw in noc_keywords)

        if is_noc_query:
            augmented_question = f"""Context from NOC knowledge base:
{context_str}

Live Network Operations Status:
{live_str}

User question: {question}

Provide a structured analysis. Start with ANALYSIS, then CONFIDENCE (0-100%), then ROOT CAUSE, then AFFECTED SCOPE, then REMEDIATION STEPS (numbered), then end with a one-line SUMMARY."""
        else:
            augmented_question = f"""Context from NOC knowledge base:
{context_str}

Live Network Operations Status:
{live_str}

User question: {question}

You are a general NOC operations assistant. Answer the user's question clearly, naturally, and helpfully using the provided knowledge base context and live network status if relevant. You do not need to follow any specific layout or uppercase headings - chat naturally and format your response with clean markdown."""

        messages.append({"role": "user", "content": augmented_question})
        
        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.15,
                "top_p": 0.9,
                "num_predict": 1024
            }
        }).encode("utf-8")

        try:
            req = Request(OLLAMA_CHAT_URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(req, timeout=60.0) as response:
                for line in response:
                    if line:
                        try:
                            chunk = json.loads(line.decode("utf-8"))
                            token = chunk.get("message", {}).get("content", "")
                            if token:
                                yield token
                            if chunk.get("done", False):
                                break
                        except (json.JSONDecodeError, KeyError):
                            continue
        except Exception as e:
            # Fall back to deterministic
            fallback = self._generate_deterministic_fallback(question, docs, active_incidents, live_branches)
            yield self._format_fallback_as_text(fallback)

    def _build_context(self, docs: list[dict]) -> str:
        return "\n\n".join([
            f"[{doc['metadata'].get('type', 'doc').upper()} - {doc['id']}]: {doc['document'][:400]}"
            for doc in docs
        ])

    def _query_ollama_chat(self, question: str, docs: list[dict], history: list[dict], active_incidents: list[dict] | None = None, live_branches: list[dict] | None = None) -> dict[str, Any] | None:
        context_str = self._build_context(docs)
        live_str = self._build_live_context(active_incidents, live_branches)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

        user_content = f"""Knowledge Base Context:
{context_str}

Live Network Operations Status:
{live_str}

Question: {question}

Respond with a JSON object with these exact keys:
- "predicted_issue": string (fault type)
- "confidence": number 0.0-1.0
- "current_state": string (network state description)
- "why_risky": string (threat explanation)
- "affected_scope": string (impacted nodes/sites)
- "time_to_impact": string (e.g. "8 minutes")
- "time_to_impact_minutes": number
- "recommended_actions": array of strings (step-by-step)
- "evidence": array of objects with "source" and "title"
- "narrative": string (one-paragraph summary)
- "generated_by": "LLaMA 3 (Offline)"

Return ONLY valid JSON, no other text."""

        messages.append({"role": "user", "content": user_content})

        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.05, "num_predict": 1024}
        }).encode("utf-8")

        try:
            req = Request(OLLAMA_CHAT_URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(req, timeout=30.0) as response:
                data = json.loads(response.read())
                raw = data.get("message", {}).get("content", "").strip()

                # Try to extract JSON even if model wraps it
                json_match = re.search(r'\{.*\}', raw, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    if "predicted_issue" in parsed:
                        # Ensure evidence is in correct format
                        evidence = parsed.get("evidence", [])
                        parsed["evidence"] = [
                            {"source": ev, "title": "Network Document"} if isinstance(ev, str) else ev
                            for ev in evidence
                        ]
                        # Add RAG evidence
                        for doc in docs[:2]:
                            if not any(e.get("source") == doc["id"] for e in parsed["evidence"]):
                                parsed["evidence"].append({
                                    "source": doc["id"],
                                    "title": f"{doc['metadata'].get('type','doc').title()}: {doc['document'][:60]}..."
                                })
                        return parsed
        except Exception as e:
            print(f"[Copilot] Ollama chat query failed: {e}")
        return None

    def _format_fallback_as_text(self, fb: dict) -> str:
        if fb.get("predicted_issue") == "CONVERSATIONAL":
            return fb.get("narrative", "")

        lines = [
            f"ANALYSIS: {fb.get('predicted_issue', 'Unknown')}",
            f"CONFIDENCE: {int(float(fb.get('confidence', 0.75)) * 100)}%",
            f"ROOT CAUSE: {fb.get('why_risky', 'Telemetry analysis')}",
            f"STATE: {fb.get('current_state', '')}",
            f"AFFECTED SCOPE: {fb.get('affected_scope', 'Unknown')}",
            f"ETA: {fb.get('time_to_impact', 'Unknown')}",
            "",
            "REMEDIATION STEPS:"
        ]
        for i, action in enumerate(fb.get("recommended_actions", []), 1):
            lines.append(f"{i}. {action}")
        lines.append("")
        lines.append(f"SUMMARY: {fb.get('narrative', fb.get('why_risky', ''))}")
        return "\n".join(lines)

    def _generate_deterministic_fallback(self, question: str, docs: list[dict], active_incidents: list[dict] | None = None, live_branches: list[dict] | None = None) -> dict[str, Any]:
        q_lower = question.lower()

        # ── Hackathon / ISRO challenges info ──
        if any(hk in q_lower for hk in ["hackathon", "challenge", "isro", "bharatiya antariksh"]):
            if "13" in q_lower or "mpls" in q_lower or "copilot" in q_lower:
                msg = (
                    "We are solving Challenge 13: 'Air-Gapped Predictive Copilot for Secure MPLS Operations' "
                    "for the Bharatiya Antariksh Hackathon 2026. "
                    "Our solution fulfills the four main objectives:\n"
                    "1. Objective 1 (Simulation): Multi-site SD-WAN/MPLS environment (1 hub, 1 datacenter, 14 branches) with underlay/overlay networks.\n"
                    "2. Objective 2 (Prediction): Time-series metrics and Random Forest classifier modeling path degradation & congestion anomalies.\n"
                    "3. Objective 3 (Offline Copilot): Quantized LLaMA 3 model RAG parsing local inventory documents and runbooks.\n"
                    "4. Objective 4 (NOC Automation): Loop Engine Maker-Checker workflows, auto-remediating issues like Chennai's BGP flap."
                )
            elif any(c in q_lower for c in ["8", "lunar", "south pole", "ice"]):
                msg = (
                    "Challenge 8 focuses on the 'Detection and Characterization of Subsurface Ice in Lunar South Polar Regions' "
                    "using Chandrayaan-2 Dual-Frequency Synthetic Aperture Radar (DFSAR) and optical imagery data. This is critical "
                    "for landing site selection and rover traverse planning."
                )
            elif any(c in q_lower for c in ["15", "solar", "flare", "aditya"]):
                msg = (
                    "Challenge 15 focuses on 'Forecasting and/or Nowcasting of Solar Flares' "
                    "using combined Soft and Hard X-ray spectrometer telemetry from ISRO's Aditya-L1 solar observatory."
                )
            else:
                msg = (
                    "Welcome to the Bharatiya Antariksh Hackathon 2026! "
                    "ISRO has presented 15 challenges for student innovators across India, ranging from satellite image cloud removal, "
                    "lunar subsurface ice mapping, solar flare forecasting, to secure MPLS network operations copilot (Challenge 13). "
                    "Ask me about any specific challenge to learn more!"
                )
            return {
                "predicted_issue": "HACKATHON INFO",
                "confidence": 1.0,
                "current_state": "Bharatiya Antariksh Hackathon 2026",
                "why_risky": "N/A",
                "affected_scope": "N/A",
                "time_to_impact": "N/A",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": [],
                "evidence": [{"source": "ISRO-BAH-2026", "title": "Official Challenge Booklet"}],
                "narrative": msg,
                "generated_by": "Hackathon Info Agent"
            }

        noc_keywords = [
            "incident", "remediate", "resolve", "solve", "fix", "branch", "hub", "dc-", "site", 
            "latency", "packet", "loss", "utilization", "status", "error", "flap", "failure", "alert", 
            "ping", "diagnose", "issue", "prediction", "warning", "critical", "bengaluru", "mumbai", 
            "delhi", "chennai", "hyderabad", "pune", "ahmedabad", "kolkata", "bhubaneswar", "guwahati", 
            "chandigarh", "jaipur", "lucknow", "kochi", "nagpur", "bhopal",
            "loop", "verify", "verification", "maker", "checker", "escalat", "mitigat", "triage",
            "autonomous", "auto-fix", "autofix", "self-heal", "loop engine", "start loop"
        ]

        # ── Loop Engine Intent: "what is the loop engine doing?" ──────────────
        loop_query_keywords = ["loop", "loop engine", "maker", "checker", "verify", "verification",
                               "escalat", "autonomous", "self-heal", "triage", "mitigat"]
        start_loop_keywords = ["start loop", "start a loop", "register loop", "begin loop", "create loop"]

        if any(kw in q_lower for kw in start_loop_keywords):
            # Try to figure out which node the user wants to loop on
            all_node_ids = ["branch-bengaluru", "branch-mumbai", "branch-chennai", "branch-hyderabad",
                            "branch-pune", "branch-ahmedabad", "branch-kolkata", "branch-bhubaneswar",
                            "branch-guwahati", "branch-chandigarh", "branch-jaipur", "branch-lucknow",
                            "branch-kochi", "branch-nagpur", "branch-bhopal"]
            matched_node = next((n for n in all_node_ids if n.replace("branch-", "") in q_lower), None)

            if matched_node and active_incidents:
                inc = next((i for i in active_incidents if i.get("nodeId") == matched_node and i.get("status") == "active"), None)
                if inc:
                    try:
                        from backend.loop_engine import loop_engine
                        loop_engine.register_loop(
                            inc["id"], matched_node, inc["type"],
                            {"latency_ms": inc.get("metrics", {}).get("latency_ms", 75.0),
                             "packet_loss_pct": inc.get("metrics", {}).get("packet_loss_pct", 2.0)}
                        )
                        node_name = matched_node.replace("branch-", "").title()
                        return {
                            "predicted_issue": f"LOOP REGISTERED: {inc['type'].upper()}",
                            "confidence": 1.0,
                            "current_state": f"Loop Engine has registered a Maker-Checker verification loop for incident {inc['id']} on {node_name}.",
                            "why_risky": "Loop Engine will autonomously apply mitigations and verify recovery.",
                            "affected_scope": matched_node.upper(),
                            "time_to_impact": "Loop resolves in ~25 seconds",
                            "time_to_impact_minutes": 0.5,
                            "recommended_actions": [
                                f"Loop Engine Phase 1: Triage — anomaly logged for {node_name}",
                                f"Loop Engine Phase 2: Mitigation (Maker) — policies will be auto-applied",
                                f"Loop Engine Phase 3: Verification (Checker) — telemetry polling every 5s",
                                "Check the Loop Engine tab to track live phase progress"
                            ],
                            "evidence": [{"source": inc['id'], "title": f"Active Incident on {node_name}"}],
                            "narrative": f"Loop Engine has started a Maker-Checker cycle for {inc['type']} on {node_name}. "
                                         f"It will automatically apply mitigation policies and verify that latency drops below 25ms and packet loss below 0.2%. "
                                         f"If unresolved in 25 seconds, it will escalate to you. Track it live on the Loop Engine dashboard.",
                            "generated_by": "Loop Engine Intent Handler"
                        }
                    except Exception as e:
                        pass

            return {
                "predicted_issue": "LOOP ENGINE — NO ACTIVE INCIDENT TO LOOP",
                "confidence": 0.9,
                "current_state": "No active incident found for the specified node to register a loop.",
                "why_risky": "A loop can only be registered when an active incident exists on a node.",
                "affected_scope": matched_node.upper() if matched_node else "Unknown",
                "time_to_impact": "N/A",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": ["Check if the node has an active incident in the Alerts tab",
                                         "Try: 'What is the status of Bengaluru?' first"],
                "evidence": [],
                "narrative": "There is no active incident on that node right now so no loop can be registered. Once an incident is detected, say 'start a loop on Bengaluru' again.",
                "generated_by": "Loop Engine Intent Handler"
            }

        if any(kw in q_lower for kw in loop_query_keywords):
            loop_ctx = self._get_loop_engine_context()
            try:
                from backend.loop_engine import loop_engine
                active = list(loop_engine.active_loops.values())
                history = list(loop_engine.history)
            except Exception:
                active, history = [], []

            resolved_count = len([h for h in history if h.get("status") == "resolved"])
            escalated_count = len([h for h in history if h.get("status") == "escalated"])

            if active:
                loop = active[0]
                phase_desc = {
                    "TRIAGE": "detecting and logging the anomaly",
                    "MITIGATION": "applying autonomous firewall and QoS mitigation policies (Maker phase)",
                    "VERIFICATION": "polling live telemetry every 5 seconds to verify recovery (Checker phase)",
                    "ESCALATED": "escalating to the NOC operator — automatic fix failed",
                    "COMPLETED": "completed successfully"
                }.get(loop["phase"], loop["phase"])
                narrative = (
                    f"The Loop Engine is currently active. It is monitoring incident {loop['incident_id']} "
                    f"({loop['incident_type']}) on {loop['node_id'].upper()}. "
                    f"Current phase: {loop['phase']} — {phase_desc}. "
                    f"Live metrics: Latency={loop.get('last_metrics', {}).get('latency_ms', '?')}ms, "
                    f"Packet Loss={loop.get('last_metrics', {}).get('packet_loss_pct', '?')}%. "
                    f"Historical record: {resolved_count} auto-resolved, {escalated_count} escalated."
                )
            else:
                narrative = (
                    f"The Loop Engine is running but has no active loops right now — all incidents are stable. "
                    f"Historical record: {resolved_count} incidents auto-resolved, {escalated_count} escalated to NOC. "
                    f"When a new incident is detected, the engine will automatically start a Maker-Checker cycle. "
                    f"You can also manually trigger one by saying 'start a loop on [branch name]'."
                )

            return {
                "predicted_issue": "LOOP ENGINE STATUS REPORT",
                "confidence": 1.0,
                "current_state": f"{len(active)} active loop(s) running",
                "why_risky": loop_ctx,
                "affected_scope": ", ".join([l['node_id'].upper() for l in active]) or "None",
                "time_to_impact": "Continuous monitoring",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": [
                    "Check Loop Engine tab for live phase progress and checklist",
                    "Say 'start a loop on [branch]' to manually register a new loop",
                    f"{resolved_count} incidents have been auto-resolved by the engine",
                    f"{escalated_count} incidents escalated (manual intervention required)"
                ],
                "evidence": [{"source": "LOOP-ENGINE", "title": "Autonomous Maker-Checker Engine"}],
                "narrative": narrative,
                "generated_by": "Loop Engine Status Reporter"
            }

        # ── NLP Intent Router for Conversational / Concepts Q&A ──
        is_noc = any(kw in q_lower for kw in noc_keywords)
        is_abuse_query = any(kw in q_lower for kw in ["facebook", "youtube", "abuse", "abuser", "streaming", "torrent", "bittorrent", "social media", "netflix", "instagram"])
        
        # If the user asks about BGP, OSPF, MPLS, QoS, Latency, or Hackathon, bypass is_noc and treat as conversational concept Q&A
        is_concept_query = any(kw in q_lower for kw in ["bgp", "ospf", "mpls", "qos", "scavenger", "latency", "packet loss", "error", "sfp", "crc"])
        
        if not is_noc or is_concept_query or is_abuse_query:
            msg = ""
            predicted_issue = "CONVERSATIONAL"
            evidence = []
            
            if any(h in q_lower for h in ["hello", "hi", "hey", "greetings"]):
                msg = "Hello! I am your air-gapped ISRO NOC Copilot, trained in secure offline mode for MPLS Operations.\nI can assist you in troubleshooting route flaps, link congestion, underlay failures, and identifying network policy violations. How can I help you today?"
            
            elif is_abuse_query:
                # Compile a live report of all abusers across the simulated network
                abuser_records = []
                from backend.employee_simulator import generate_employee_activity
                for br in (live_branches or []):
                    br_id = br.get("id")
                    br_status = br.get("status", "NORMAL")
                    employees = generate_employee_activity(br_id, br_status, active_incidents)
                    for emp in employees:
                        if emp.get("status") == "Abuse":
                            abuser_records.append({
                                "branch": br.get("name"),
                                "name": emp.get("name"),
                                "role": emp.get("role"),
                                "app": emp.get("active_application"),
                                "bandwidth": emp.get("bandwidth_mbps"),
                                "device": emp.get("device_id"),
                                "ip": emp.get("ip_address")
                            })
                
                if abuser_records:
                    lines = [
                        "[NOC SECURITY & AUDIT - ACTIVE BANDWIDTH ABUSE REPORT]",
                        "The following users are currently consuming substantial bandwidth on non-corporate applications:",
                        ""
                    ]
                    for rec in abuser_records:
                        lines.append(f"• Site: {rec['branch']} | User: {rec['name']} ({rec['role']})")
                        lines.append(f"  Device ID: {rec['device']} | IP Address: {rec['ip']}")
                        lines.append(f"  Application: {rec['app']} | Bandwidth Consumed: {rec['bandwidth']} Mbps")
                        lines.append("")
                    
                    lines.append("SUGGESTED CORRECTIVE ACTION PLAYBOOK:")
                    lines.append("1. Revert/apply the Scavenger QoS Rate-Limiting Policy map via the Settings tab to drop non-critical traffic queues.")
                    lines.append("2. Implement edge switch rate-limiting to restrict workstations to 10 Mbps (Runbook RB-002).")
                    lines.append("3. Deploy an access control rule (ACL) on the local PE router firewall to block traffic to unauthorized video-sharing destinations.")
                    
                    msg = "\n".join(lines)
                    predicted_issue = "BANDWIDTH POLICY VIOLATION"
                    evidence.append({"source": "NETFLOW", "title": "Top-Talkers Stream Ingestion"})
                else:
                    msg = (
                        "Audit completed. No active bandwidth abuse detected on any branch links. All workstations "
                        "are operating within baseline compliance guidelines. Traffic flows show standard corporate "
                        "applications (Microsoft Teams, Outlook, GitHub commit sync, database SQL queries)."
                    )
            
            elif "bgp" in q_lower:
                msg = (
                    "BGP (Border Gateway Protocol) is a Path Vector protocol running over TCP port 179, managing routing decisions "
                    "across autonomous systems (AS).\n\n"
                    "Common Causes of BGP neighbor flaps or down states in our network:\n"
                    "• Link layer errors: Bad transceivers causing physical carrier loss and TCP session drop.\n"
                    "• Keepalive drops: CPU spikes on routers causing BGP keepalive packets to be dropped, triggering hold-time expiration (default 90s).\n"
                    "• MTU mismatch on peer interfaces: Prevents exchange of large BGP UPDATE packets, keeping neighbor stuck in ExStart/Active state.\n\n"
                    "Diagnostics & Mitigation commands:\n"
                    "- Check neighbor summary: vtysh -c 'show bgp summary'\n"
                    "- Apply route dampening: vtysh -c 'conf t' -c 'router bgp 65000' -c 'bgp dampening' (suppresses flapping routes)\n"
                    "- Soft reset session: vtysh -c 'clear bgp neighbor <ip> soft' (reloads route entries without dropping TCP connection)"
                )
                predicted_issue = "BGP TELEMETRY KNOWLEDGE"
                evidence.append({"source": "RB-001", "title": "BGP Neighbors SOP"})
                
            elif "ospf" in q_lower:
                msg = (
                    "OSPF (Open Shortest Path First) is a Link-State routing protocol utilizing the SPF (Dijkstra) algorithm "
                    "for interior gateway routing.\n\n"
                    "OSPF Adjacency Failures (OSPF state stuck in ExStart or Exchange):\n"
                    "• Cause: Interface MTU mismatch. OSPF DBD packets carry MTU size; if they don't match on both sides of the link, "
                    "Database Description updates fail and routers flap OSPF neighbor states.\n"
                    "• Other causes: Hello/Dead interval mismatch, Area ID mismatch, or subnet mask mismatch.\n\n"
                    "Diagnostics & Mitigation commands:\n"
                    "- Verify interface parameters: vtysh -c 'show ip ospf interface'\n"
                    "- Set interface MTU size matching peer: ip link set <iface> mtu 9000\n"
                    "- Restart stuck adjacency: vtysh -c 'clear ip ospf process'"
                )
                predicted_issue = "OSPF TELEMETRY KNOWLEDGE"
                evidence.append({"source": "RB-004", "title": "OSPF Adjacency SOP"})
                
            elif "mpls" in q_lower:
                msg = (
                    "MPLS (Multiprotocol Label Switching) operates between L2 (Data Link) and L3 (Network Layer), speeding up "
                    "forwarding by swapping labels rather than performing long-longest prefix route lookups.\n\n"
                    "MPLS Tunnel Degradation causes:\n"
                    "• Path congestion: Underlay link utilization approaching capacity, causing label-switched path (LSP) drops.\n"
                    "• LDP session failures: LDP (Label Distribution Protocol) neighbor adjacency lost, halting path label mapping.\n\n"
                    "Diagnostics & Mitigation commands:\n"
                    "- Check LDP states: vtysh -c 'show mpls ldp neighbor'\n"
                    "- traceroute path labels: traceroute mpls ipv4 <destination_ip>\n"
                    "- Set path cost metric override: vtysh -c 'ip route <prefix> <next_hop> 5' (directs packets to alternate overlay path)"
                )
                predicted_issue = "MPLS TELEMETRY KNOWLEDGE"
                evidence.append({"source": "RB-003", "title": "MPLS Tunnel SOP"})
                
            elif "qos" in q_lower or "scavenger" in q_lower:
                msg = (
                    "Quality of Service (QoS) prioritizes critical network applications using Class Maps and Policy Maps based "
                    "on DSCP (Differentiated Services Code Point) headers:\n\n"
                    "• EF (Expedited Forwarding): VoIP and real-time streams requiring sub-millisecond delay.\n"
                    "• AF (Assured Forwarding): Corporate database traffic, ERP-Client, and collaborative tools.\n"
                    "• Scavenger Class (CS1): Background non-corporate traffic (YouTube 4K, social media scrolling, torrents).\n\n"
                    "Mitigation commands:\n"
                    "- Apply rate limit on Bulk/Scavenger queues: vtysh -c 'conf t' -c 'policy-map BRANCH-OUT' -c 'class BULK' -c 'police rate 50 mbps'\n"
                    "- Check active drops on policy maps: vtysh -c 'show policy-map interface'"
                )
                predicted_issue = "QOS POLICY KNOWLEDGE"
                evidence.append({"source": "RB-002", "title": "Interface Congestion SOP"})
                
            elif "latency" in q_lower or "packet loss" in q_lower or "error" in q_lower or "sfp" in q_lower or "crc" in q_lower:
                msg = (
                    "High Latency & Packet Loss diagnostics guide:\n"
                    "• CRC errors: Indicate physical layer noise, dirty fiber connections, or failing transceivers.\n"
                    "• Duplex Mismatch: Causes high collision rates and output errors under load.\n"
                    "• SFP Optics Power levels: Check if optical receive (Rx) or transmit (Tx) power falls below -20 dBm.\n\n"
                    "Diagnostics & Mitigation commands:\n"
                    "- Inspect interface error statistics: show interface <interface> | grep -E 'CRC|error|drops'\n"
                    "- Replace degraded SFP module if optical power is poor.\n"
                    "- Force speed/duplex negotiation: show interface status"
                )
                predicted_issue = "PHYSICAL DIAGNOSTICS"
                evidence.append({"source": "RB-005", "title": "Packet Loss & CRC SOP"})
                
            elif "help" in q_lower:
                msg = (
                    "Here are some operational queries you can ask me:\n"
                    "1. 'What is the status of Bengaluru?' (provides live telemetry metrics and user list)\n"
                    "2. 'Who is using facebook / youtube right now?' (queries NetFlow and lists bandwidth abusers)\n"
                    "3. 'How do OSPF MTU mismatches behave?' (concept diagnostics explanation)\n"
                    "4. 'Explain how to configure BGP dampening' (runbook configuration commands)\n"
                    "5. 'Show details on Challenge 13' (hackathon problem statement roadmap)"
                )
                predicted_issue = "COPILOT HELP DESK"
            else:
                snippet = docs[0]['document'] if docs else 'N/A'
                msg = (
                    f"I've scanned the local RAG offline knowledge base regarding your question.\n\n"
                    f"To perform a live telemetry lookup, specify a site name (e.g. 'Bengaluru status') or an active incident keyword.\n\n"
                    f"Relevant knowledge base context:\n- {snippet}"
                )
            
            return {
                "predicted_issue": predicted_issue,
                "confidence": 1.0,
                "current_state": "Offline RAG NLP Mode",
                "why_risky": "N/A",
                "affected_scope": "N/A",
                "time_to_impact": "N/A",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": [],
                "evidence": evidence,
                "narrative": msg,
                "generated_by": "Offline NLP Conversational Agent"
            }

        active_inc = None
        if active_incidents:
            for inc in active_incidents:
                if inc.get("status") == "active":
                    node_id = inc.get("nodeId", "").lower()
                    node_short = node_id.replace("branch-", "").replace("hub-", "")
                    inc_type = inc.get("type", "").lower()
                    
                    if any(kw in q_lower for kw in [node_id, node_short, inc_type]):
                        active_inc = inc
                        break
            
            if not active_inc and any(kw in q_lower for kw in ["solve", "fix", "remediate", "active", "problem", "incident"]):
                for inc in active_incidents:
                    if inc.get("status") == "active":
                        active_inc = inc
                        break
 
        if active_inc:
            from backend.employee_simulator import generate_employee_activity
            steps = [s.get("label") for s in active_inc.get("steps", [])]
            node_name = active_inc.get("nodeId", "").replace("branch-", "").replace("hub-", "").title()
            node_id = active_inc.get("nodeId", "")
            
            # Fetch employee activity for the incident branch
            employees = generate_employee_activity(node_id, active_inc.get("severity", "CRITICAL"), active_incidents)
            abusers = [e for e in employees if e.get("status") == "Abuse"]
            
            abuse_narrative = ""
            if abusers:
                abuser_strs = [
                    f"{e.get('name')} ({e.get('role')}) on device {e.get('device_id')} ({e.get('ip_address')}) streaming '{e.get('active_application')}' consuming {e.get('bandwidth_mbps')} Mbps"
                    for e in abusers
                ]
                abuse_narrative = " Specific bandwidth abusers identified on link: " + "; ".join(abuser_strs) + "."
                
            return {
                "predicted_issue": active_inc.get("type", "Network Anomaly").upper(),
                "confidence": 0.98,
                "current_state": f"Site {node_name} has a CRITICAL alert: {active_inc.get('message')}.{abuse_narrative}",
                "why_risky": f"Active network degradation on {node_name} link is threatening SLA thresholds due to unauthorized bandwidth utilization.",
                "affected_scope": active_inc.get("nodeId", "Unknown").upper(),
                "time_to_impact": "Active / Immediate",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": steps + [f"Apply traffic rate-limit policy on device: {e.get('device_id')} ({e.get('ip_address')})" for e in abusers],
                "evidence": [{"source": active_inc.get("id"), "title": f"Telemetry Incident Alert for {node_name}"}],
                "narrative": f"Live telemetry confirms an active {active_inc.get('type')} on {node_name}." + 
                             (f" RAG inspection detects heavy congestion caused by employee {abusers[0].get('name')} utilizing {abusers[0].get('bandwidth_mbps')} Mbps." if abusers else "") +
                             " To resolve this immediately, follow the runbook steps or click the AUTO-FIX action button.",
                "generated_by": "Live Incident Analyzer"
            }

        matching_branch = None
        if live_branches:
            for br in live_branches:
                name = br.get("name", "").lower()
                br_id = br.get("id", "").lower()
                if any(kw in q_lower for kw in [name, br_id]):
                    matching_branch = br
                    break
        
        if matching_branch:
            from backend.employee_simulator import generate_employee_activity, get_branch_assets_and_subnets
            try:
                from backend.main import GLOBAL_POLICIES
            except ImportError:
                GLOBAL_POLICIES = {"block_streaming": False, "scavenger_qos": False, "load_balancers": True, "maintenance_nodes": []}
                
            br_id = matching_branch.get("id")
            in_maint = br_id in GLOBAL_POLICIES.get("maintenance_nodes", [])
            status = "MAINTENANCE" if in_maint else matching_branch.get("status", "NORMAL")
            
            latency = 12.5 if in_maint else matching_branch.get("latency_ms", 0.0)
            loss = 0.0 if in_maint else matching_branch.get("packet_loss_pct", 0.0)
            util = 32.4 if in_maint else matching_branch.get("utilization_pct", 0.0)
            sla = "MAINTENANCE MODE (EXEMPT)" if in_maint else matching_branch.get("sla", "COMPLIANT")
            
            extra = get_branch_assets_and_subnets(br_id)
            employees = generate_employee_activity(br_id, status, active_incidents, policies=GLOBAL_POLICIES)
            abusers = [e for e in employees if e.get("status") == "Abuse"]
            throttled = [e for e in employees if e.get("status") == "Throttled"]
            
            abuse_desc = ""
            rec_actions = ["No action required. Site telemetry is within nominal parameters."]
            
            if in_maint:
                abuse_desc = " Site is in scheduled maintenance window. Active alerts are suppressed."
                rec_actions = ["Verify maintenance tasks completion", "Restore site to active SLA monitoring once completed"]
            elif status != "NORMAL":
                rec_actions = [
                    "Isolate link interface and review optical signal levels",
                    "Verify routing table convergence and path cost overrides",
                    "Verify if security group shaper or media block policies should be enabled in settings"
                ]
                if abusers:
                    abuser_strs = [
                        f"{e.get('name')} ({e.get('role')}) on device {e.get('device_id')} running '{e.get('active_application')}' ({e.get('bandwidth_mbps')} Mbps)"
                        for e in abusers
                    ]
                    abuse_desc = " Bandwidth abusers detected: " + ", ".join(abuser_strs) + "."
                    rec_actions.append(f"Deploy QoS rate-limits on device: {abusers[0].get('device_id')}")
            elif throttled:
                abuse_desc = f" Traffic shaper has actively throttled {len(throttled)} streaming devices."
                
            devices_str = ", ".join([f"{a['name']} ({a['model']})" for a in extra['assets']])
            subnet_str = ", ".join([f"{s['name']}: {s['cidr']}" for s in extra['subnets'][:3]])
            
            return {
                "predicted_issue": f"STATUS CHECK: {matching_branch.get('name').upper()}",
                "confidence": 0.95,
                "current_state": f"{matching_branch.get('name')} ({extra['role']}) status is currently {status}.{abuse_desc}",
                "why_risky": "Link is within safe operating bounds." if status == "NORMAL" or in_maint else f"Elevated telemetry readings (Latency: {latency}ms, Loss: {loss}%, Util: {util}%) jeopardize SLA compliance.",
                "affected_scope": br_id.upper(),
                "time_to_impact": "None" if status == "NORMAL" or in_maint else "Immediate",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": rec_actions,
                "evidence": [
                    {"source": br_id, "title": f"Live metrics: Latency {latency}ms, Loss {loss}%"},
                    {"source": "INVENTORY", "title": f"Devices: {devices_str}"},
                    {"source": "IPAM", "title": f"Subnets: {subnet_str}"}
                ],
                "narrative": f"Telemetry check for {matching_branch.get('name')} ({extra['role']}) shows status is {status}. Current metrics: Latency = {latency}ms, Loss = {loss}%, Util = {util}%. IPAM Subnets: {subnet_str}. Active hardware inventory: {devices_str}." +
                             (f" Offending traffic is actively throttled by global firewall rules." if throttled else "") +
                             (f" High bandwidth utilization is traced to {abusers[0].get('name')} streaming '{abusers[0].get('active_application')}'." if abusers else ""),
                "generated_by": "Live Telemetry Tracker"
            }
        predictions = load_predictions()
        incidents = load_incidents()
        runbooks = load_runbooks()

        if not predictions:
            return {
                "predicted_issue": "Telemetry Data Unavailable",
                "confidence": 0.5,
                "current_state": "Cannot retrieve telemetry data from local store.",
                "why_risky": "Without telemetry, SLA compliance cannot be verified.",
                "affected_scope": "All Sites",
                "time_to_impact": "Unknown",
                "time_to_impact_minutes": 0.0,
                "recommended_actions": ["Verify data directory integrity", "Restart backend service", "Check local database health"],
                "evidence": [{"source": "SYS-001", "title": "System Diagnostic"}],
                "narrative": "Data unavailable. Manual verification required.",
                "generated_by": "Deterministic Fallback"
            }

        best_pred = None
        for p in predictions:
            site = p.get("predicted_at_site", "").lower()
            fault = p.get("predicted_fault_type", "").lower()
            if any(kw in q_lower for kw in [site, fault.replace("_", " "), fault]):
                best_pred = p
                break
        if not best_pred:
            best_pred = predictions[0]

        predicted_fault_type = best_pred.get("predicted_fault_type", "congestion_buildup")
        confidence = float(best_pred.get("confidence", 0.8))
        eta = best_pred.get("prophet_breach_eta_minutes", "10")
        site = best_pred.get("predicted_at_site", "Unknown")
        reasoning = best_pred.get("reasoning", "")
        inc_ref = best_pred.get("incident_reference", "")

        matching_inc = next((i for i in incidents if i.get("incident_id") == inc_ref), None)
        related_rb_str = best_pred.get("related_runbooks", "")
        rb_ids = [r.strip() for r in related_rb_str.split(",") if r.strip()]
        matching_rb = next((rb for rb in runbooks if rb.get("runbook_id") in rb_ids), None)
        if not matching_rb and runbooks:
            matching_rb = runbooks[0]

        recommended_actions = []
        if matching_rb:
            for i in range(1, 9):
                step = matching_rb.get(f"step_{i}")
                if step:
                    recommended_actions.append(step)
        if not recommended_actions:
            recommended_actions = [
                "Verify interface status and error counters",
                "Check BGP session state and route table",
                "Review MPLS label forwarding table",
                "Activate backup link if primary is degraded",
                "Notify on-call NOC engineer for escalation"
            ]

        evidence = []
        if matching_rb:
            evidence.append({"source": matching_rb.get("runbook_id"), "title": f"Runbook: {matching_rb.get('title', 'SOP')}"})
        if matching_inc:
            evidence.append({"source": matching_inc.get("incident_id"), "title": f"Incident: {matching_inc.get('description', '')[:50]}..."})
        for doc in docs[:3]:
            if not any(e.get("source") == doc["id"] for e in evidence):
                evidence.append({"source": doc["id"], "title": f"{doc['metadata'].get('type', 'doc').title()}: {doc['document'][:60]}..."})

        try:
            eta_float = float(eta)
        except (ValueError, TypeError):
            eta_float = 10.0

        return {
            "predicted_issue": predicted_fault_type.upper().replace("_", " "),
            "confidence": confidence,
            "current_state": f"Site {site} shows elevated risk signals: {reasoning}",
            "why_risky": f"Pattern matches known precursor for {predicted_fault_type.replace('_', ' ')} failures, threatening SLA compliance.",
            "affected_scope": best_pred.get("affected_scope", site),
            "time_to_impact": f"{eta} minutes",
            "time_to_impact_minutes": eta_float,
            "recommended_actions": recommended_actions,
            "evidence": evidence,
            "narrative": f"Predictive engine forecasts {predicted_fault_type.replace('_', ' ')} at {site} with {int(confidence*100)}% confidence. "
                         f"Estimated impact in {eta} minutes. Immediate execution of runbook procedures is recommended.",
            "generated_by": "Deterministic Fallback"
        }
