"""
Load Test — Scalability benchmark for the NOC Copilot backend.
Fires 50 concurrent requests across all major endpoints.

Run with:  python -m backend.load_test
"""
from __future__ import annotations

import statistics
import threading
import time
import urllib.request
import urllib.error
from typing import NamedTuple

BASE_URL = "http://127.0.0.1:8000"

ENDPOINTS = [
    "/summary",
    "/topology",
    "/branches",
    "/alerts",
    "/predictions",
    "/loop/state",
    "/health",
    "/ml/metrics",
]


class Result(NamedTuple):
    endpoint: str
    latency_ms: float
    status: int
    error: str | None


def _hit(endpoint: str, results: list[Result], lock: threading.Lock) -> None:
    url = BASE_URL + endpoint
    t0 = time.perf_counter()
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            resp.read()
            status = resp.status
            error = None
    except urllib.error.HTTPError as e:
        status = e.code
        error = str(e)
    except Exception as e:
        status = 0
        error = str(e)
    latency_ms = (time.perf_counter() - t0) * 1000
    with lock:
        results.append(Result(endpoint, round(latency_ms, 2), status, error))


def run_load_test(concurrent_users: int = 50) -> None:
    print(f"\n{'='*60}")
    print(f"  NOC Copilot — Scalability Load Test")
    print(f"  Concurrent users : {concurrent_users}")
    print(f"  Endpoints tested : {len(ENDPOINTS)}")
    print(f"  Total requests   : {concurrent_users * len(ENDPOINTS)}")
    print(f"{'='*60}\n")

    results: list[Result] = []
    lock = threading.Lock()
    threads: list[threading.Thread] = []

    # Each "user" hits all endpoints once
    for _ in range(concurrent_users):
        for ep in ENDPOINTS:
            t = threading.Thread(target=_hit, args=(ep, results, lock), daemon=True)
            threads.append(t)

    t_start = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15.0)
    total_elapsed = (time.perf_counter() - t_start) * 1000

    # Aggregate
    ok = [r for r in results if r.status == 200]
    err = [r for r in results if r.status != 200]
    latencies = [r.latency_ms for r in ok]

    print(f"{'Endpoint':<35} {'Reqs':>5} {'OK':>5} {'ERR':>5} {'Avg ms':>8} {'P95 ms':>8}")
    print("-" * 68)

    for ep in ENDPOINTS:
        ep_results = [r for r in results if r.endpoint == ep]
        ep_ok = [r for r in ep_results if r.status == 200]
        ep_lat = [r.latency_ms for r in ep_ok]
        avg = round(statistics.mean(ep_lat), 1) if ep_lat else 0
        p95 = round(sorted(ep_lat)[int(len(ep_lat) * 0.95)] if ep_lat else 0, 1)
        print(f"{ep:<35} {len(ep_results):>5} {len(ep_ok):>5} {len(ep_results)-len(ep_ok):>5} {avg:>8} {p95:>8}")

    print("-" * 68)
    print(f"\n  Total requests  : {len(results)}")
    print(f"  Successful (2xx): {len(ok)} ({100*len(ok)//max(len(results),1)}%)")
    print(f"  Errors          : {len(err)}")
    if latencies:
        print(f"  Avg latency     : {round(statistics.mean(latencies), 1)} ms")
        print(f"  Median latency  : {round(statistics.median(latencies), 1)} ms")
        print(f"  P95 latency     : {round(sorted(latencies)[int(len(latencies)*0.95)], 1)} ms")
        print(f"  Max latency     : {round(max(latencies), 1)} ms")
    print(f"  Total wall time : {round(total_elapsed, 0)} ms")
    print(f"  Requests/sec    : {round(len(results) / (total_elapsed/1000), 1)}")

    passed = len(ok) == len(results) and (statistics.mean(latencies) < 2000 if latencies else False)
    print(f"\n  Result: {'PASSED (Green)' if passed else 'DEGRADED - check server logs'}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    run_load_test(concurrent_users=50)
