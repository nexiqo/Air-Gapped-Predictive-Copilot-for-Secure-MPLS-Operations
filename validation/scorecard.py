from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from backend.predictive_engine import PredictiveEngine

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "telemetry" / "features.csv"
SCENARIOS_PATH = ROOT / "validation" / "scenarios.json"
RESULTS_PATH = ROOT / "validation" / "validation_results.json"

def main() -> None:
    if not FEATURES_CSV.exists():
        print("features.csv not found. Run scripts/generate_demo_data.py and ml/preprocess.py first.")
        return

    # Load scenarios
    scenarios = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
    
    # Load features
    with FEATURES_CSV.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)

    # Initialize engine
    engine = PredictiveEngine()
    results = []

    print("Evaluating Scenarios against Predictive Engine...")
    print("------------------------------------------------")

    for scenario in scenarios:
        name = scenario["name"]
        link = scenario["target_link"]
        expected_issue = scenario["issue_type"]

        # Filter rows for target link
        link_rows = [r for r in rows if r["link"] == link]
        if not link_rows:
            print(f"No telemetry found for link {link} (Scenario: {name})")
            continue

        # Find when the scenario starts (the first occurrence of the scenario label)
        anomaly_index = -1
        for idx, row in enumerate(link_rows):
            if row["scenario"] == name:
                anomaly_index = idx
                break

        if anomaly_index == -1:
            print(f"Anomaly label {name} not found in telemetry for link {link}")
            continue

        anomaly_ts = datetime.fromisoformat(link_rows[anomaly_index]["timestamp"])

        # Walk backwards up to 12 steps (60 minutes) to check if we predict it early
        lead_time = 0
        predicted_early = False
        pred_confidence = 0.0

        # We inspect rows before the anomaly
        for search_idx in range(max(0, anomaly_index - 12), anomaly_index):
            row = link_rows[search_idx]
            
            # Format row data for engine
            snapshot = {}
            for k, v in row.items():
                try:
                    if "." in v:
                        snapshot[k] = float(v)
                    else:
                        snapshot[k] = int(v)
                except ValueError:
                    snapshot[k] = v

            assessment = engine.assess(snapshot)
            
            # If model predicts a risk above warning threshold (0.35)
            if assessment.risk_score >= 0.35 and assessment.predicted_issue == expected_issue:
                pred_ts = datetime.fromisoformat(row["timestamp"])
                lead_time = int((anomaly_ts - pred_ts).total_seconds() / 60)
                predicted_early = True
                pred_confidence = assessment.confidence
                break

        passed = predicted_early and lead_time >= 5
        
        status = "PASSED" if passed else "FAILED"
        print(f"Scenario: {name:<25} | Link: {link:<18} | Status: {status:<6} | Lead Time: {lead_time:<2} min | Conf: {pred_confidence:.2f}")

        results.append({
            "scenario": name,
            "link": link,
            "expected_issue": expected_issue,
            "status": status,
            "lead_time_minutes": lead_time,
            "confidence": pred_confidence,
            "passed": passed
        })

    # Save validation results
    RESULTS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("------------------------------------------------")
    print(f"Saved validation scorecard results to {RESULTS_PATH}")

    # Summary metrics
    passed_count = sum(1 for r in results if r["passed"])
    avg_lead = sum(r["lead_time_minutes"] for r in results) / len(results) if results else 0
    avg_conf = sum(r["confidence"] for r in results) / len(results) if results else 0

    print(f"Total Scenarios Evaluated: {len(results)}")
    print(f"Passed Criteria: {passed_count} / {len(results)}")
    print(f"Average Lead Time: {avg_lead:.1f} minutes")
    print(f"Average Prediction Confidence: {avg_conf:.2f}")

if __name__ == "__main__":
    main()
