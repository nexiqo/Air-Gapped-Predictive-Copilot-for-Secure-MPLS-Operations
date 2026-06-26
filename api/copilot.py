from __future__ import annotations

import json
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from api.predictive_engine import Assessment
from rag.knowledge_base import LocalKnowledgeBase


OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "llama3"


class CopilotService:
    def __init__(self) -> None:
        self.knowledge_base = LocalKnowledgeBase()

    def build_response(self, question: str, assessment: Assessment, snapshot: dict[str, Any]) -> dict[str, Any]:
        docs = self.knowledge_base.search(
            " ".join([question, assessment.predicted_issue, snapshot.get("link", ""), snapshot.get("site", "")])
        )
        response = self._local_template(assessment, snapshot, docs)
        llm_response = self._try_local_ollama(question, assessment, snapshot, docs)
        if llm_response:
            response["narrative"] = llm_response
            response["generated_by"] = "local_ollama"
        return response

    def _local_template(self, assessment: Assessment, snapshot: dict[str, Any], docs: list[Any]) -> dict[str, Any]:
        affected_scope = f'{snapshot.get("site", "unknown-site")} via {snapshot.get("link", "unknown-link")}'
        actions = [
            "Inspect the highest-matching runbook and confirm whether the same precursor pattern is repeating.",
            "Validate recent routing or policy changes on the affected path before the predicted breach window.",
            "Protect critical traffic or fail over to a healthier path if severity continues rising.",
        ]
        return {
            "predicted_issue": assessment.predicted_issue,
            "confidence": assessment.confidence,
            "severity": assessment.severity,
            "time_to_impact_minutes": assessment.time_to_impact_minutes,
            "affected_scope": affected_scope,
            "root_cause_hypothesis": "; ".join(assessment.contributors),
            "recommended_actions": actions,
            "evidence": [
                {"source": doc.source, "title": doc.title}
                for doc in docs
            ],
            "narrative": (
                f"Risk is elevated for {affected_scope}. The strongest signals are "
                f"{', '.join(assessment.contributors)}. Estimated time to impact is "
                f"{assessment.time_to_impact_minutes} minutes with {assessment.severity} severity."
            ),
            "generated_by": "template",
        }

    def _try_local_ollama(
        self,
        question: str,
        assessment: Assessment,
        snapshot: dict[str, Any],
        docs: list[Any],
    ) -> str | None:
        prompt = {
            "question": question,
            "assessment": assessment.to_dict(),
            "snapshot": snapshot,
            "evidence": [{"source": doc.source, "title": doc.title, "body": doc.body} for doc in docs],
            "instruction": "Summarize the operator risk in plain English using only the provided evidence.",
        }
        payload = json.dumps(
            {
                "model": OLLAMA_MODEL,
                "prompt": json.dumps(prompt),
                "stream": False,
            }
        ).encode("utf-8")

        request = Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=2.5) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (URLError, TimeoutError, json.JSONDecodeError):
            return None
        return data.get("response")
