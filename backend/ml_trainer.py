"""
ML Trainer — Offline Random Forest Classifier for NOC Risk Prediction
Generates synthetic ISRO MPLS telemetry dataset, trains a scikit-learn
Random Forest, runs 5-fold cross-validation, saves model + metrics.

Run with:  python -m backend.ml_trainer
"""
from __future__ import annotations

import json
import pickle
import random
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)
MODEL_PATH = ARTIFACTS_DIR / "risk_classifier.pkl"
METRICS_PATH = ARTIFACTS_DIR / "ml_metrics.json"

FEATURE_NAMES = [
    "interface_util_pct",
    "latency_ms",
    "jitter_ms",
    "packet_loss_pct",
    "bgp_flaps_5m",
    "ospf_events_5m",
    "tunnel_rekeys_15m",
    "queue_depth_pct",
]

LABEL_NAMES = [
    "nominal",
    "congestion_buildup",
    "routing_instability",
    "tunnel_health_drop",
    "policy_drift",
]


def _synthetic_row(label: str, rng: random.Random) -> list[float]:
    """Generate one synthetic telemetry row for a given fault label."""
    if label == "nominal":
        return [
            rng.uniform(5, 55),    # util
            rng.uniform(2, 22),    # latency
            rng.uniform(0, 3),     # jitter
            rng.uniform(0, 1.0),   # loss
            0.0,                   # bgp_flaps
            0.0,                   # ospf_events
            0.0,                   # tunnel_rekeys
            rng.uniform(0, 30),    # queue_depth
        ]
    elif label == "congestion_buildup":
        return [
            rng.uniform(72, 100),
            rng.uniform(40, 180),
            rng.uniform(8, 30),
            rng.uniform(1.5, 8.0),
            0.0,
            rng.uniform(0, 1),
            0.0,
            rng.uniform(60, 100),
        ]
    elif label == "routing_instability":
        return [
            rng.uniform(20, 70),
            rng.uniform(15, 90),
            rng.uniform(5, 25),
            rng.uniform(2.0, 12.0),
            rng.uniform(1, 5),
            rng.uniform(1, 4),
            0.0,
            rng.uniform(20, 65),
        ]
    elif label == "tunnel_health_drop":
        return [
            rng.uniform(10, 60),
            rng.uniform(20, 120),
            rng.uniform(10, 40),
            rng.uniform(4.0, 15.0),
            rng.uniform(0, 2),
            0.0,
            rng.uniform(1, 6),
            rng.uniform(15, 55),
        ]
    else:  # policy_drift
        return [
            rng.uniform(30, 75),
            rng.uniform(10, 50),
            rng.uniform(2, 12),
            rng.uniform(0.5, 4.0),
            0.0,
            rng.uniform(1, 5),
            rng.uniform(0, 2),
            rng.uniform(25, 70),
        ]


def generate_dataset(n_per_class: int = 200, seed: int = 42):
    rng = random.Random(seed)
    X, y = [], []
    for label_idx, label in enumerate(LABEL_NAMES):
        for _ in range(n_per_class):
            X.append(_synthetic_row(label, rng))
            y.append(label_idx)
    # Shuffle
    combined = list(zip(X, y))
    rng.shuffle(combined)
    X, y = zip(*combined)
    return list(X), list(y)


def _manual_cross_val(X, y, n_folds: int = 5, seed: int = 42):
    """Pure-Python stratified-ish k-fold cross-validation using sklearn."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score

    rng = random.Random(seed)
    n = len(X)
    indices = list(range(n))
    rng.shuffle(indices)
    fold_size = n // n_folds

    all_acc, all_prec, all_rec, all_f1 = [], [], [], []

    for fold in range(n_folds):
        val_idx = indices[fold * fold_size: (fold + 1) * fold_size]
        train_idx = indices[:fold * fold_size] + indices[(fold + 1) * fold_size:]

        X_train = [X[i] for i in train_idx]
        y_train = [y[i] for i in train_idx]
        X_val   = [X[i] for i in val_idx]
        y_val   = [y[i] for i in val_idx]

        clf = RandomForestClassifier(n_estimators=60, max_depth=12, random_state=seed + fold)
        clf.fit(X_train, y_train)
        preds = clf.predict(X_val)

        all_acc.append(accuracy_score(y_val, preds))
        all_prec.append(precision_score(y_val, preds, average="weighted", zero_division=0))
        all_rec.append(recall_score(y_val, preds, average="weighted", zero_division=0))
        all_f1.append(f1_score(y_val, preds, average="weighted", zero_division=0))
        print(f"  Fold {fold+1}/{n_folds} — Acc: {all_acc[-1]:.3f}  F1: {all_f1[-1]:.3f}")

    return {
        "accuracy":  round(sum(all_acc)  / n_folds, 4),
        "precision": round(sum(all_prec) / n_folds, 4),
        "recall":    round(sum(all_rec)  / n_folds, 4),
        "f1_score":  round(sum(all_f1)   / n_folds, 4),
        "n_folds":   n_folds,
    }


def train_and_save():
    from sklearn.ensemble import RandomForestClassifier

    print("[ML Trainer] Generating synthetic ISRO MPLS telemetry dataset...")
    X, y = generate_dataset(n_per_class=200)
    print(f"[ML Trainer] Dataset: {len(X)} rows × {len(FEATURE_NAMES)} features, {len(LABEL_NAMES)} classes")

    print("[ML Trainer] Running 5-fold cross-validation...")
    t0 = time.time()
    cv_metrics = _manual_cross_val(X, y, n_folds=5)
    elapsed = round(time.time() - t0, 2)

    print(f"\n[ML Trainer] Cross-Validation Results ({elapsed}s):")
    print(f"  Accuracy : {cv_metrics['accuracy']:.4f} ({cv_metrics['accuracy']*100:.1f}%)")
    print(f"  Precision: {cv_metrics['precision']:.4f}")
    print(f"  Recall   : {cv_metrics['recall']:.4f}")
    print(f"  F1 Score : {cv_metrics['f1_score']:.4f}")

    # Train final model on full dataset
    print("[ML Trainer] Training final model on full dataset...")
    final_clf = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42)
    final_clf.fit(X, y)

    # Save model
    artifact = {"model": final_clf, "features": FEATURE_NAMES, "labels": LABEL_NAMES}
    with MODEL_PATH.open("wb") as f:
        pickle.dump(artifact, f)
    print(f"[ML Trainer] Model saved -> {MODEL_PATH}")

    # Save metrics
    metrics_doc = {
        **cv_metrics,
        "algorithm": "Random Forest (100 estimators, depth=15)",
        "training_samples": len(X),
        "feature_count": len(FEATURE_NAMES),
        "class_count": len(LABEL_NAMES),
        "label_names": LABEL_NAMES,
        "feature_names": FEATURE_NAMES,
        "dataset": "Synthetic ISRO MPLS telemetry (offline, air-gapped)",
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "training_time_seconds": elapsed,
    }
    with METRICS_PATH.open("w", encoding="utf-8") as f:
        json.dump(metrics_doc, f, indent=2)
    print(f"[ML Trainer] Metrics saved -> {METRICS_PATH}")

    return metrics_doc


if __name__ == "__main__":
    train_and_save()
