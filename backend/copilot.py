from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from backend.rag import RAGService
from backend.data_loader import load_predictions, load_incidents, load_runbooks

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "llama3:8b"

class CopilotService:
    def __init__(self) -> None:
        self.rag = RAGService()

    def query(self, question: str) -> dict[str, Any]:
        # 1. Retrieve top 4 docs from ChromaDB
        docs = self.rag.query(question, limit=4)
        
        # 2. Try to query local Ollama LLM
        llm_response = self._try_ollama(question, docs)
        
        if llm_response:
            try:
                # Parse structured JSON if returned
                parsed_json = json.loads(llm_response)
                # Ensure it has all the required keys
                required_keys = ["predicted_issue", "current_state", "why_risky", "affected_scope", "time_to_impact", "recommended_actions", "evidence"]
                if all(key in parsed_json for key in required_keys):
                    parsed_json["generated_by"] = "AI Response"
                    # Format evidence as a list of dicts to match frontend expectation
                    parsed_json["evidence"] = [
                        {"source": ev, "title": "Network Log/Runbook Document"} if isinstance(ev, str) else ev
                        for ev in parsed_json["evidence"]
                    ]
                    # Ensure time_to_impact_minutes is present
                    if "time_to_impact_minutes" not in parsed_json:
                        try:
                            time_val = parsed_json["time_to_impact"]
                            nums = [float(s) for s in time_val.replace("min", " ").replace("minute", " ").split() if s.replace(".", "", 1).isdigit()]
                            parsed_json["time_to_impact_minutes"] = nums[0] if nums else 10.0
                        except Exception:
                            parsed_json["time_to_impact_minutes"] = 10.0
                    return parsed_json
            except (json.JSONDecodeError, TypeError):
                # If LLM didn't return valid JSON, we can try to extract or proceed to fallback
                pass
        
        # 3. Fallback to deterministic rule-based response
        return self._generate_deterministic_fallback(question, docs)

    def _try_ollama(self, question: str, docs: list[dict[str, Any]]) -> str | None:
        # Build context from retrieved docs
        context_str = "\n\n".join([
            f"Doc {i+1} ({doc['metadata'].get('type', 'unknown')}: {doc['id']}): {doc['document']}"
            for i, doc in enumerate(docs)
        ])
        
        prompt = f"""
You are an expert Network Operations Center (NOC) Copilot operating in an offline, air-gapped system.
Answer the user's question based on the retrieved local network topology, runbook, and incident records.

User Question: {question}

Retrieved Knowledge Base Context:
{context_str}

Instruction:
You MUST respond with a single valid JSON object. Do not include any conversational text outside the JSON.
The JSON object must have exactly the following keys:
1. "predicted_issue": A string identifying the predicted fault type or network problem.
2. "current_state": A string describing the current telemetry values or network conditions.
3. "why_risky": A string explaining why this scenario poses an operational threat.
4. "affected_scope": A string listing the branches, links, or hubs impacted.
5. "time_to_impact": A string indicating when the failure is expected to occur (e.g., "7.5 minutes").
6. "recommended_actions": A list of strings detailing step-by-step remediation commands/tasks from runbooks.
7. "evidence": A list of strings representing the IDs of the matched runbooks (e.g. "RB-001") or incidents (e.g. "INC-0001").

Response:
"""
        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1
            }
        }).encode("utf-8")

        request = Request(
            OLLAMA_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            # Short timeout to fail quickly and use fallback if Ollama is not running
            with urlopen(request, timeout=5.0) as response:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("response", "").strip()
        except Exception as e:
            print(f"[Copilot] Ollama connection failed: {e}. Falling back to deterministic analysis.")
            return None

    def _generate_deterministic_fallback(self, question: str, docs: list[dict[str, Any]]) -> dict[str, Any]:
        # 1. Find the highest-confidence prediction in predictions.csv
        predictions = load_predictions()
        incidents = load_incidents()
        runbooks = load_runbooks()

        if not predictions:
            # Absolute fallback if data files are missing
            return {
                "predicted_issue": "Unknown Network Anomaly",
                "current_state": "Telemetry data unavailable.",
                "why_risky": "Unable to evaluate network signals.",
                "affected_scope": "Global",
                "time_to_impact": "Unknown",
                "recommended_actions": ["Verify data directory path", "Check local database health"],
                "evidence": ["SYS-001"],
                "generated_by": "Local Analysis"
            }

        # Highest confidence prediction
        best_pred = predictions[0]  # sorted by confidence desc in data_loader
        predicted_fault_type = best_pred.get("predicted_fault_type", "congestion_buildup")
        confidence = float(best_pred.get("confidence", 0.8))
        eta = best_pred.get("prophet_breach_eta_minutes", "Unknown")
        site = best_pred.get("predicted_at_site", "Unknown")
        reasoning = best_pred.get("reasoning", "")
        rec_action = best_pred.get("recommended_action_1", "")
        inc_ref = best_pred.get("incident_reference", "")
        
        # 2. Find matching incident in incidents.csv
        matching_inc = None
        for inc in incidents:
            if inc.get("incident_id") == inc_ref:
                matching_inc = inc
                break
        
        # 3. Find matching runbook in runbooks.json
        matching_rb = None
        related_rb_str = best_pred.get("related_runbooks", "")
        rb_ids = [r.strip() for r in related_rb_str.split(",") if r.strip()]
        
        for rb in runbooks:
            if rb.get("runbook_id") in rb_ids:
                matching_rb = rb
                break
        if not matching_rb and runbooks:
            matching_rb = runbooks[0]

        # Gather actions from runbook
        recommended_actions = []
        if matching_rb:
            for step_key in [f"step_{i}" for i in range(1, 9)]:
                step_val = matching_rb.get(step_key)
                if step_val:
                    recommended_actions.append(step_val)
        else:
            recommended_actions = [rec_action] if rec_action else ["Verify network interface configuration."]

        # Gather evidence items
        evidence = []
        if matching_rb:
            rb_id = matching_rb.get("runbook_id")
            rb_name = matching_rb.get("name", "Standard Operating Procedure")
            evidence.append({"source": rb_id, "title": f"Runbook: {rb_name}"})
        if matching_inc:
            inc_id = matching_inc.get("incident_id")
            inc_desc = matching_inc.get("description", "Incident details")
            evidence.append({"source": inc_id, "title": f"Incident: {inc_desc[:50]}..."})
        
        # Add retrieved documents from ChromaDB to evidence
        for doc in docs:
            doc_id = doc["id"]
            doc_type = doc["metadata"].get("type", "Document")
            if not any(ev["source"] == doc_id for ev in evidence):
                doc_text = doc["document"]
                evidence.append({"source": doc_id, "title": f"{doc_type}: {doc_text[:50]}..."})

        # Build response
        current_state = f"Active monitoring of {site} shows elevated signals: {reasoning}"
        why_risky = f"Signals match known precursor patterns for {predicted_fault_type} failures, threatening SLA targets."

        try:
            time_val_min = float(eta) if eta != "Unknown" else 0.0
        except ValueError:
            time_val_min = 0.0

        return {
            "predicted_issue": predicted_fault_type.upper().replace("_", " "),
            "current_state": current_state,
            "why_risky": why_risky,
            "affected_scope": best_pred.get("affected_scope", site),
            "time_to_impact": f"{eta} minutes" if eta != "Unknown" else "Immediate",
            "time_to_impact_minutes": time_val_min,
            "recommended_actions": recommended_actions,
            "evidence": evidence,
            "generated_by": "Local Analysis"
        }
