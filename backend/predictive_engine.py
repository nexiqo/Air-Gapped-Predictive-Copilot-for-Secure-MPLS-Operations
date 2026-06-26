from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "artifacts" / "risk_classifier.pkl"


@dataclass
class Assessment:
    predicted_issue: str
    confidence: float
    severity: str
    risk_score: float
    time_to_impact_minutes: int
    contributors: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "predicted_issue": self.predicted_issue,
            "confidence": round(self.confidence, 3),
            "severity": self.severity,
            "risk_score": round(self.risk_score, 3),
            "time_to_impact_minutes": self.time_to_impact_minutes,
            "contributors": self.contributors,
        }


class PredictiveEngine:
    def __init__(self) -> None:
        self.artifact = None
        if MODEL_PATH.exists():
            with MODEL_PATH.open("rb") as handle:
                self.artifact = pickle.load(handle)

    def assess(self, snapshot: dict[str, Any]) -> Assessment:
        if self.artifact:
            return self._assess_with_model(snapshot)
        return self._assess_with_rules(snapshot)

    def _assess_with_model(self, snapshot: dict[str, Any]) -> Assessment:
        model = self.artifact["model"]
        feature_names = self.artifact["features"]
        row = [[float(snapshot.get(name, 0.0)) for name in feature_names]]
        probability = float(model.predict_proba(row)[0][1])

        predicted_issue, contributors = self._infer_issue_type(snapshot)
        return Assessment(
            predicted_issue=predicted_issue,
            confidence=max(probability, 0.55),
            severity=self._severity(probability),
            risk_score=probability,
            time_to_impact_minutes=self._time_to_impact(probability),
            contributors=contributors,
        )

    def _assess_with_rules(self, snapshot: dict[str, Any]) -> Assessment:
        util = float(snapshot.get("interface_util_pct", 0))
        latency = float(snapshot.get("latency_ms", 0))
        jitter = float(snapshot.get("jitter_ms", 0))
        loss = float(snapshot.get("packet_loss_pct", 0))
        flaps = float(snapshot.get("bgp_flaps_5m", 0))
        ospf_events = float(snapshot.get("ospf_events_5m", 0))
        rekeys = float(snapshot.get("tunnel_rekeys_15m", 0))
        queue_depth = float(snapshot.get("queue_depth_pct", 0))

        score = (
            util / 100 * 0.28
            + latency / 100 * 0.16
            + jitter / 50 * 0.10
            + loss / 20 * 0.18
            + min(flaps, 3) / 3 * 0.14
            + min(ospf_events, 3) / 3 * 0.07
            + min(rekeys, 3) / 3 * 0.07
            + queue_depth / 100 * 0.12
        )
        score = max(0.0, min(score, 0.99))

        predicted_issue, contributors = self._infer_issue_type(snapshot)
        return Assessment(
            predicted_issue=predicted_issue,
            confidence=max(score, 0.2),
            severity=self._severity(score),
            risk_score=score,
            time_to_impact_minutes=self._time_to_impact(score),
            contributors=contributors,
        )

    def _infer_issue_type(self, snapshot: dict[str, Any]) -> tuple[str, list[str]]:
        util = float(snapshot.get("interface_util_pct", 0))
        loss = float(snapshot.get("packet_loss_pct", 0))
        flaps = float(snapshot.get("bgp_flaps_5m", 0))
        ospf_events = float(snapshot.get("ospf_events_5m", 0))
        rekeys = float(snapshot.get("tunnel_rekeys_15m", 0))
        queue_depth = float(snapshot.get("queue_depth_pct", 0))

        contributors: list[str] = []
        if util > 75 or queue_depth > 70:
            contributors.append("sustained utilization and queue depth growth")
        if loss > 3:
            contributors.append("rising packet loss trend")
        if flaps >= 1:
            contributors.append("BGP instability precursors")
        if ospf_events >= 1:
            contributors.append("routing control-plane churn")
        if rekeys >= 1:
            contributors.append("tunnel rekey anomalies")

        if flaps >= 1:
            return "routing_instability", contributors or ["routing flaps observed"]
        if rekeys >= 1 or loss > 5:
            return "tunnel_health_drop", contributors or ["tunnel quality decline"]
        if ospf_events >= 1:
            return "policy_drift", contributors or ["control-plane drift signals"]
        return "congestion_buildup", contributors or ["elevated performance stress"]

    @staticmethod
    def _severity(score: float) -> str:
        if score >= 0.8:
            return "critical"
        if score >= 0.6:
            return "high"
        if score >= 0.35:
            return "medium"
        return "low"

    @staticmethod
    def _time_to_impact(score: float) -> int:
        if score >= 0.8:
            return 5
        if score >= 0.6:
            return 10
        if score >= 0.35:
            return 20
        return 30
