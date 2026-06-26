from __future__ import annotations

import csv
import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "telemetry"
CSV_PATH = DATA_DIR / "demo_metrics.csv"
FAULTS_PATH = DATA_DIR / "fault_ground_truth.json"

NODES = {
    "mumbai-hub": {"name": "Mumbai Hub - NOC", "type": "HUB", "location": "Mumbai, Maharashtra", "coordinates": [19.0760, 72.8777]},
    "dc-core": {"name": "Data Center - Core Banking", "type": "DATACENTER", "location": "Mumbai Data Center", "coordinates": [19.0176, 72.8562]},
    "bangalore-branch": {"name": "Bangalore Branch - Tech Hub", "type": "BRANCH", "location": "Bangalore, Karnataka", "coordinates": [12.9716, 77.5946]},
    "chennai-branch": {"name": "Chennai Branch - South Ops", "type": "BRANCH", "location": "Chennai, Tamil Nadu", "coordinates": [13.0827, 80.2707]},
    "hyderabad-branch": {"name": "Hyderabad Branch - AP Ops", "type": "BRANCH", "location": "Hyderabad, Telangana", "coordinates": [17.3850, 78.4867]},
    "ahmedabad-branch": {"name": "Ahmedabad Branch - West Ops", "type": "BRANCH", "location": "Ahmedabad, Gujarat", "coordinates": [23.0225, 72.5714]},
    "delhi-branch": {"name": "Delhi Branch - North Ops", "type": "BRANCH", "location": "Delhi", "coordinates": [28.6139, 77.2090]},
    "kochi-branch": {"name": "Kochi Branch - Kerala Ops", "type": "BRANCH", "location": "Kochi, Kerala", "coordinates": [9.9312, 76.2673]},
    "kolkata-branch": {"name": "Kolkata Branch - East Ops", "type": "BRANCH", "location": "Kolkata, West Bengal", "coordinates": [22.5726, 88.3639]}
}

LINKS = [
    {"id": "mumbai-dc", "source": "mumbai-hub", "target": "dc-core", "type": "CORE_LINK", "bandwidth": "10 Gbps", "base_latency": 5.0},
    {"id": "mumbai-bangalore", "source": "mumbai-hub", "target": "bangalore-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 45.0},
    {"id": "mumbai-chennai", "source": "mumbai-hub", "target": "chennai-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 40.0},
    {"id": "mumbai-hyderabad", "source": "mumbai-hub", "target": "hyderabad-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 35.0},
    {"id": "mumbai-ahmedabad", "source": "mumbai-hub", "target": "ahmedabad-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 30.0},
    {"id": "mumbai-delhi", "source": "mumbai-hub", "target": "delhi-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 55.0},
    {"id": "mumbai-kochi", "source": "mumbai-hub", "target": "kochi-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 50.0},
    {"id": "mumbai-kolkata", "source": "mumbai-hub", "target": "kolkata-branch", "type": "MPLS_PRIMARY", "bandwidth": "1 Gbps", "base_latency": 65.0},
    {"id": "bangalore-chennai", "source": "bangalore-branch", "target": "chennai-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps", "base_latency": 15.0},
    {"id": "kochi-chennai", "source": "kochi-branch", "target": "chennai-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps", "base_latency": 25.0},
    {"id": "hyderabad-bangalore", "source": "hyderabad-branch", "target": "bangalore-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps", "base_latency": 20.0},
    {"id": "ahmedabad-delhi", "source": "ahmedabad-branch", "target": "delhi-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps", "base_latency": 35.0},
    {"id": "kolkata-delhi", "source": "kolkata-branch", "target": "delhi-branch", "type": "INTER_BRANCH", "bandwidth": "500 Mbps", "base_latency": 50.0}
]

def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))

def get_diurnal_factor(dt: datetime) -> float:
    h = dt.hour + dt.minute / 60.0
    if 9.5 <= h <= 17.5:
        return 0.75 + 0.25 * math.sin((h - 9.5) * math.pi / 8.0)
    elif 17.5 < h <= 23.5:
        return 0.2 + 0.55 * ((23.5 - h) / 6.0)
    elif 0 <= h < 6:
        return 0.1 + 0.08 * math.sin(h * math.pi / 6.0)
    else:
        return 0.18 + 0.57 * ((h - 6) / 3.5)

def get_scenario(index: int, link_id: str) -> str:
    if link_id == "mumbai-bangalore" and 408 <= index < 444:
        return "progressive_congestion"
    if link_id == "mumbai-delhi" and 984 <= index < 1008:
        return "bgp_route_flap"
    if link_id == "mumbai-kochi" and 1332 <= index < 1368:
        return "mpls_tunnel_degradation"
    if link_id == "mumbai-ahmedabad" and 1620 <= index < 1644:
        return "controller_policy_drift"
    return "steady_state"

def build_row(ts: datetime, index: int, link: dict) -> dict[str, object]:
    link_id = link["id"]
    scenario = get_scenario(index, link_id)
    diurnal_factor = get_diurnal_factor(ts)

    # Base values
    base_util = 25 + 20 * diurnal_factor + random.uniform(-4, 4)
    base_latency = link["base_latency"] + 3 * diurnal_factor + random.uniform(-0.8, 0.8)
    base_jitter = 1.0 + 0.8 * diurnal_factor + random.uniform(-0.15, 0.15)
    base_loss = 0.05 + 0.08 * diurnal_factor + random.uniform(-0.02, 0.02)
    base_flaps = 0
    base_ospf = 0
    base_rekeys = 0
    base_errors = 0.008 + 0.01 * diurnal_factor + random.uniform(-0.002, 0.002)
    base_queue = 8 + 12 * diurnal_factor + random.uniform(-1.5, 1.5)

    # Precursors
    is_congestion_precursor = (link_id == "mumbai-bangalore" and 390 <= index < 408)
    is_bgp_precursor = (link_id == "mumbai-delhi" and 966 <= index < 984)
    is_tunnel_precursor = (link_id == "mumbai-kochi" and 1314 <= index < 1332)
    is_drift_precursor = (link_id == "mumbai-ahmedabad" and 1602 <= index < 1620)

    # Physical correlations for high baseline utilization
    if base_util > 70:
        overload = (base_util - 70) / 30.0
        base_queue += 40 * overload
        base_latency += 18 * overload
        base_loss += 1.2 * overload

    # Inject precursor and scenario signals
    if scenario == "progressive_congestion" or is_congestion_precursor:
        if is_congestion_precursor:
            ramp = (index - 390) / 18.0
            base_util += 25 * ramp
            base_queue += 35 * ramp
            base_latency += 30 * ramp
            base_loss += 0.8 * ramp
        else:
            # Main failure phase
            ramp = (index - 408) / 36.0
            base_util += 25 + 20 * ramp
            base_queue += 35 + 30 * ramp
            base_latency += 30 + 50 * ramp
            base_jitter += 6 * ramp
            base_loss += 0.8 + 3.4 * ramp
            base_errors += 0.8 * ramp

    elif scenario == "bgp_route_flap" or is_bgp_precursor:
        if is_bgp_precursor:
            # Precursors: occasional single flaps and minor latency spikes
            if index % 4 == 0:
                base_flaps = 1
                base_latency += 25
                base_jitter += 3.0
        else:
            # Main failure phase: continuous flaps
            if index % 2 == 0:
                base_flaps = random.randint(1, 3)
                base_latency += 60 + 30 * random.random()
                base_loss += 3.5 + 2 * random.random()
                base_jitter += 8 + 4 * random.random()
            else:
                base_latency += 15
                base_loss += 0.5

    elif scenario == "mpls_tunnel_degradation" or is_tunnel_precursor:
        if is_tunnel_precursor:
            # Precursors: rising packet loss and jitter
            ramp = (index - 1314) / 18.0
            base_loss += 1.8 * ramp
            base_jitter += 3.0 * ramp
            base_latency += 10.0 * ramp
            if index % 6 == 0:
                base_rekeys = 1
        else:
            # Main failure phase
            ramp = (index - 1332) / 36.0
            base_loss += 1.8 + 6.2 * ramp
            base_jitter += 3.0 + 8.0 * ramp
            base_latency += 10.0 + 25.0 * ramp
            if index % 4 == 0:
                base_rekeys = random.randint(1, 2)
                base_errors += 0.5

    elif scenario == "controller_policy_drift" or is_drift_precursor:
        if is_drift_precursor:
            # Precursors: occasional config drift/OSPF event
            if index % 5 == 0:
                base_ospf = 1
            base_latency += 8.0
        else:
            # Main failure phase
            ramp = (index - 1620) / 24.0
            if index % 3 == 0:
                base_ospf = 1
            base_latency += 8.0 + 14.0 * ramp
            base_jitter += 3.5 * ramp
            base_util += 12 * ramp

    site = link["source"] if index % 2 == 0 else link["target"]

    return {
        "timestamp": ts.isoformat(),
        "site": site,
        "link": link_id,
        "scenario": scenario,
        "interface_util_pct": round(clamp(base_util, 0, 99.8), 2),
        "latency_ms": round(clamp(base_latency, 0.5, 600), 2),
        "jitter_ms": round(clamp(base_jitter, 0.1, 150), 2),
        "packet_loss_pct": round(clamp(base_loss, 0, 100), 2),
        "bgp_flaps_5m": base_flaps,
        "ospf_events_5m": base_ospf,
        "tunnel_rekeys_15m": base_rekeys,
        "error_rate_pct": round(clamp(base_errors, 0, 100), 4),
        "queue_depth_pct": round(clamp(base_queue, 0, 100), 2),
    }

def build_fault_log(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    faults = []
    seen = set()
    for row in rows:
        scenario = str(row["scenario"])
        if scenario == "steady_state":
            continue
        key = (scenario, row["link"])
        if key in seen:
            continue
        seen.add(key)
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

    start_time = datetime.now(timezone.utc) - timedelta(days=7)
    total_intervals = 12 * 24 * 7 # 2016 intervals
    
    print(f"Generating telemetry with precursor signals for 9 nodes and {len(LINKS)} links...")
    
    rows = []
    for i in range(total_intervals):
        ts = start_time + timedelta(minutes=5 * i)
        for link in LINKS:
            rows.append(build_row(ts, i, link))

    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    FAULTS_PATH.write_text(json.dumps(build_fault_log(rows), indent=2), encoding="utf-8")

    print(f"Wrote {len(rows)} telemetry rows to {CSV_PATH}")
    print(f"Wrote fault labels to {FAULTS_PATH}")

if __name__ == "__main__":
    main()
