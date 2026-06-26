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

SYSTEM_PROMPT = """You are an elite NOC (Network Operations Center) Copilot deployed in an offline, air-gapped MPLS network environment for ISRO (Indian Space Research Organisation). You have deep expertise in:
- MPLS/BGP routing protocols and SD-WAN operations
- Network fault analysis and predictive maintenance
- Runbook-driven incident response and remediation
- SLA compliance and network health assessment

You analyze real-time telemetry from 16 branch sites across India. You always provide:
1. Clear, structured responses with confidence scores
2. Specific actionable remediation steps from runbooks
3. Impact assessment and urgency classification
4. Root cause hypothesis based on telemetry patterns

You are concise, technical, and precise. Never say you cannot help - always provide your best analysis based on available data. Format responses in clean sections without markdown headers - use CAPS labels instead."""


class CopilotService:
    def __init__(self) -> None:
        self.rag = RAGService()
        self._ollama_available: bool | None = None
        self._last_check = 0.0

    def _check_ollama(self) -> bool:
        """Check if Ollama is running. Cache result for 10 seconds."""
        now = time.time()
        if self._ollama_available is not None and now - self._last_check < 10:
            return self._ollama_available
        try:
            req = Request("http://127.0.0.1:11434/api/tags", method="GET")
            with urlopen(req, timeout=2.0) as resp:
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

    def query(self, question: str, conversation_history: list[dict] | None = None) -> dict[str, Any]:
        """Main query method - tries Ollama first, falls back to deterministic analysis."""
        docs = self.rag.query(question, limit=5)
        
        if self._check_ollama():
            result = self._query_ollama_chat(question, docs, conversation_history or [])
            if result:
                return result

        return self._generate_deterministic_fallback(question, docs)

    def stream_query(self, question: str, conversation_history: list[dict] | None = None) -> Generator[str, None, None]:
        """Stream tokens from Ollama for real-time response display."""
        docs = self.rag.query(question, limit=5)
        context_str = self._build_context(docs)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Add conversation history (last 6 messages max)
        for msg in (conversation_history or [])[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add context-enriched user message
        augmented_question = f"""Context from NOC knowledge base:
{context_str}

User question: {question}

Provide a structured analysis. Start with ANALYSIS, then CONFIDENCE (0-100%), then ROOT CAUSE, then AFFECTED SCOPE, then REMEDIATION STEPS (numbered), then end with a one-line SUMMARY."""

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
            fallback = self._generate_deterministic_fallback(question, docs)
            yield self._format_fallback_as_text(fallback)

    def _build_context(self, docs: list[dict]) -> str:
        return "\n\n".join([
            f"[{doc['metadata'].get('type', 'doc').upper()} - {doc['id']}]: {doc['document'][:400]}"
            for doc in docs
        ])

    def _query_ollama_chat(self, question: str, docs: list[dict], history: list[dict]) -> dict[str, Any] | None:
        context_str = self._build_context(docs)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

        user_content = f"""Knowledge Base Context:
{context_str}

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

    def _generate_deterministic_fallback(self, question: str, docs: list[dict]) -> dict[str, Any]:
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

        # Find most relevant prediction
        q_lower = question.lower()
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
