from __future__ import annotations

import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "telemetry"
CSV_PATH = DATA_DIR / "demo_metrics.csv"
FAULTS_PATH = DATA_DIR / "fault_ground_truth.json"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def scenario_for_index(index: int) -> str:
    if 70 <= index < 110:
        return "progressive_congestion"
    if 140 <= index < 170:
        return "bgp_route_flap"
    if 220 <= index < 255:
        return "mpls_tunnel_degradation"
    if 290 <= index < 320:
        return "controller_policy_drift"
    return "steady_state"


def build_row(ts: datetime, index: int) -> dict[str, object]:
    scenario = scenario_for_index(index)

    base_util = 42 + 6 * random.random()
    base_latency = 18 + 4 * random.random()
    base_jitter = 2 + 1.5 * random.random()
    base_loss = 0.2 + 0.3 * random.random()
    base_flaps = 0
    base_ospf = 0
    base_rekeys = 0
    base_errors = 0.05 + 0.08 * random.random()
    base_queue = 18 + 6 * random.random()

    if scenario == "progressive_congestion":
        ramp = (index - 70) / 40
        base_util += 25 * ramp
        base_latency += 16 * ramp
        base_jitter += 6 * ramp
        base_loss += 2.5 * ramp
        base_queue += 40 * ramp
    elif scenario == "bgp_route_flap":
        burst = 1 + ((index - 140) % 6 == 0)
        base_flaps = burst
        base_latency += 8 + 8 * random.random()
        base_jitter += 4 + 2 * random.random()
        base_queue += 18
    elif scenario == "mpls_tunnel_degradation":
        ramp = (index - 220) / 35
        base_loss += 7 * ramp
        base_jitter += 9 * ramp
        base_latency += 12 * ramp
        base_rekeys = 1 if index % 4 == 0 else 0
        base_queue += 12 * ramp
    elif scenario == "controller_policy_drift":
        base_ospf = 1 if index % 5 == 0 else 0
        base_latency += 10 + 5 * random.random()
        base_jitter += 3 + 1.5 * random.random()
        base_util += 10
        base_queue += 14

    site = "branch-a" if index % 2 == 0 else "dc-core"
    link = "hub1-branch-a" if site == "branch-a" else "hub1-dc-core"
    if scenario == "controller_policy_drift":
        site = "branch-b"
        link = "branch-b-dc-core"

    return {
        "timestamp": ts.isoformat(),
        "site": site,
        "link": link,
        "scenario": scenario,
        "interface_util_pct": round(clamp(base_util, 0, 99), 2),
        "latency_ms": round(clamp(base_latency, 0, 500), 2),
        "jitter_ms": round(clamp(base_jitter, 0, 200), 2),
        "packet_loss_pct": round(clamp(base_loss, 0, 100), 2),
        "bgp_flaps_5m": base_flaps,
        "ospf_events_5m": base_ospf,
        "tunnel_rekeys_15m": base_rekeys,
        "error_rate_pct": round(clamp(base_errors, 0, 100), 3),
        "queue_depth_pct": round(clamp(base_queue, 0, 100), 2),
    }


def build_fault_log(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    faults = []
    seen = set()
    for row in rows:
        scenario = str(row["scenario"])
        if scenario == "steady_state" or scenario in seen:
            continue
        seen.add(scenario)
        faults.append(
            {
                "ts": row["timestamp"],
                "scenario": scenario,
                "link": row["link"],
                "label": 1,
            }
        )
    return faults


def main() -> None:
    random.seed(42)
    ensure_dirs()

    start = datetime.now(timezone.utc) - timedelta(hours=3)
    rows = [build_row(start + timedelta(seconds=30 * i), i) for i in range(360)]

    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    FAULTS_PATH.write_text(json.dumps(build_fault_log(rows), indent=2), encoding="utf-8")

    print(f"Wrote {len(rows)} telemetry rows to {CSV_PATH}")
    print(f"Wrote fault labels to {FAULTS_PATH}")


if __name__ == "__main__":
    main()
