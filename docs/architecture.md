# Architecture Overview

## Goal

Predict likely MPLS and SD-WAN service degradation before user-visible impact, explain why the risk is rising, and suggest offline-safe corrective actions.

## Core layers

### 1. Network simulation

- `topology.yml` defines a hub, two branches, and a datacenter edge.
- FRRouting configs model BGP and OSPF behavior in a way that is easy to extend into a fuller MPLS lab.
- Fault scenarios can be injected to simulate congestion, route instability, and tunnel degradation.

### 2. Telemetry and storage

- Telegraf collects interface and reachability signals.
- Prometheus stores time-series telemetry.
- The repo also supports a synthetic CSV path for early development and demos.

### 3. Predictive analytics

- `ml/preprocess.py` engineers trend and stress features from telemetry.
- `ml/train_models.py` trains a baseline classifier to estimate whether an incident is likely in the near future.
- `api/predictive_engine.py` uses trained artifacts when available, then falls back to a deterministic explainable scorer so the product still works without model files.

### 4. Copilot and grounding

- `rag/knowledge_base.py` retrieves local-only context from runbooks, topology notes, and prior incidents.
- `api/copilot.py` converts the risk assessment into operator-ready guidance.
- If a local Ollama server is present, the same evidence can be passed through a local LLM while keeping the deployment air-gapped.

### 5. Operator experience

- `api/main.py` exposes the backend over HTTP.
- `ui/dashboard.py` shows current alerts, confidence levels, and a natural-language query box.

## Primary signals

- interface utilization
- latency and jitter drift
- packet loss progression
- routing flap counts
- tunnel rekey instability
- queue depth and error rate

## Main decision loop

1. Ingest a new telemetry snapshot.
2. Derive risk features and anomaly indicators.
3. Estimate issue type, confidence, severity, and time-to-impact.
4. Retrieve relevant runbooks and topology context.
5. Return a structured copilot response with recommended actions.

## Designed tradeoffs

- The initial baseline favors explainability and hackathon readiness over model complexity.
- The API contract is stable so stronger models can replace the baseline without changing the UI or retrieval flow.
- Synthetic data is included so the team can demo end-to-end behavior before the full network environment is fully instrumented.
