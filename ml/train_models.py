from __future__ import annotations

import pickle
from pathlib import Path

import pandas as pd

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report
    from sklearn.model_selection import train_test_split
except ImportError as exc:
    raise SystemExit(
        "scikit-learn is required to train the baseline model. Install requirements.txt first."
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "data" / "telemetry" / "features.csv"
MODEL_DIR = ROOT / "artifacts"
MODEL_PATH = MODEL_DIR / "risk_classifier.pkl"

FEATURE_COLUMNS = [
    "interface_util_pct",
    "latency_ms",
    "jitter_ms",
    "packet_loss_pct",
    "bgp_flaps_5m",
    "ospf_events_5m",
    "tunnel_rekeys_15m",
    "error_rate_pct",
    "queue_depth_pct",
]


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(INPUT_PATH)
    X = df[FEATURE_COLUMNS]
    y = df["risk_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    print(classification_report(y_test, predictions, digits=3))

    artifact = {"model": model, "features": FEATURE_COLUMNS}
    with MODEL_PATH.open("wb") as handle:
        pickle.dump(artifact, handle)
    print(f"Saved model artifact to {MODEL_PATH}")


if __name__ == "__main__":
    main()
