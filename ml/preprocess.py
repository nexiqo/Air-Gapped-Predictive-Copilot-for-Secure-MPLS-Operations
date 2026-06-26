from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "data" / "telemetry" / "demo_metrics.csv"
OUTPUT_PATH = ROOT / "data" / "telemetry" / "features.csv"


def add_future_risk_label(frame: pd.DataFrame) -> pd.Series:
    future_window = frame["scenario_code"].shift(-1).fillna(0)
    return future_window[::-1].rolling(window=10, min_periods=1).max()[::-1].astype(int)


def main() -> None:
    df = pd.read_csv(INPUT_PATH, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    df["latency_delta"] = df["latency_ms"].diff().fillna(0)
    df["jitter_delta"] = df["jitter_ms"].diff().fillna(0)
    df["loss_delta"] = df["packet_loss_pct"].diff().fillna(0)
    df["util_rolling_mean"] = df["interface_util_pct"].rolling(5, min_periods=1).mean()
    df["latency_rolling_mean"] = df["latency_ms"].rolling(5, min_periods=1).mean()
    df["loss_rolling_mean"] = df["packet_loss_pct"].rolling(5, min_periods=1).mean()

    df["scenario_code"] = (df["scenario"] != "steady_state").astype(int)
    df["risk_label"] = add_future_risk_label(df)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved engineered features to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
