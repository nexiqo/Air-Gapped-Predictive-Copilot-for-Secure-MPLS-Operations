from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "validation" / "validation_results.sample.json"


def main() -> None:
    results = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    if not results:
        print("No validation records found.")
        return

    average_lead = sum(item["lead_time_minutes"] for item in results) / len(results)
    average_confidence = sum(item["confidence"] for item in results) / len(results)

    print("Validation Scorecard")
    print("--------------------")
    print(f"Scenarios: {len(results)}")
    print(f"Average lead time: {average_lead:.2f} minutes")
    print(f"Average confidence: {average_confidence:.2f}")


if __name__ == "__main__":
    main()
