from __future__ import annotations

from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "data" / "telemetry" / "demo_metrics.csv"
OUTPUT_PATH = ROOT / "data" / "telemetry" / "features.csv"

def add_future_risk_label(group: pd.DataFrame) -> pd.Series:
    # If a failure occurs in the next 12 intervals (60 minutes), mark as risk = 1
    scenario_code = (group["scenario"] != "steady_state").astype(int)
    future_window = scenario_code.shift(-1).fillna(0)
    return future_window[::-1].rolling(window=12, min_periods=1).max()[::-1].astype(int)

def main() -> None:
    df = pd.read_csv(INPUT_PATH, parse_dates=["timestamp"])
    df = df.sort_values(["link", "timestamp"]).reset_index(drop=True)

    # Compute deltas grouped by link
    df["latency_delta"] = df.groupby("link")["latency_ms"].diff().fillna(0)
    df["jitter_delta"] = df.groupby("link")["jitter_ms"].diff().fillna(0)
    df["loss_delta"] = df.groupby("link")["packet_loss_pct"].diff().fillna(0)
    
    # Compute rolling means grouped by link
    df["util_rolling_mean"] = df.groupby("link")["interface_util_pct"].transform(lambda x: x.rolling(5, min_periods=1).mean())
    df["latency_rolling_mean"] = df.groupby("link")["latency_ms"].transform(lambda x: x.rolling(5, min_periods=1).mean())
    df["loss_rolling_mean"] = df.groupby("link")["packet_loss_pct"].transform(lambda x: x.rolling(5, min_periods=1).mean())

    # Compute risk labels grouped by link
    df["risk_label"] = df.groupby("link", group_keys=False).apply(add_future_risk_label).astype(int)
    
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved engineered features to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
