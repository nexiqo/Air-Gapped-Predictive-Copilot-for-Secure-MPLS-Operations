# Air-Gapped Predictive NOC Copilot

**Business Scenario: Multi-State Enterprise Network Management System**

This project addresses a critical problem faced by "TechCorp India" - a rapidly growing financial services company with operations across 8 states (Maharashtra, Karnataka, Tamil Nadu, Telangana, Gujarat, Delhi, Kerala, and West Bengal). The company's distributed infrastructure serves over 2 million customers and processes 50,000+ transactions daily.

## The Business Problem

TechCorp India is experiencing critical network reliability issues across their multi-state branch network:

- **Network Downtime**: Average 4-6 hours monthly downtime per branch, causing ₹2-3 crore daily revenue loss
- **Service Disruption**: ATM and banking services become unavailable during network outages
- **Manual Troubleshooting**: Network operations center (NOC) team spends 8+ hours diagnosing issues manually
- **Predictive Failure**: Inability to predict network failures before they impact customers
- **Security Concerns**: Cannot use cloud-based monitoring due to banking compliance requirements
- **Resource Constraint**: Limited network engineers managing 20+ branch locations

This repo transforms the network operations challenge into a practical MVP that is:

- offline-first by design (critical for banking compliance)
- explainable without cloud dependencies
- ready to demo with synthetic telemetry before the full network lab is online
- structured so you can swap in Containerlab, Prometheus, Ollama, and stronger ML models later

## What is included

- `topology.yml` and `configs/` for a 4-node FRRouting MPLS-style lab
- `docker-compose-telemetry.yml` and `telemetry/` for Prometheus, Grafana, and Telegraf
- `scripts/generate_demo_data.py` to create synthetic telemetry and ground truth labels
- `ml/` baseline preprocessing and training scripts
- `rag/knowledge_base.py` for local-only retrieval over runbooks, topology notes, and incident notes
- `api/` FastAPI backend for `/health`, `/analyze`, and `/query`
- `ui/dashboard.py` Streamlit demo UI
- `validation/` scenarios and scorecard helpers
- `docs/` architecture and air-gap compliance notes

## Architecture

The system models TechCorp India's actual network infrastructure:

1. `Network sim`: Containerlab + FRRouting create a reproducible hub/branch/datacenter topology representing:
   - **Mumbai Hub** (Main NOC): Central network operations center
   - **Regional Branches**: Bangalore, Chennai, Hyderabad representing key business locations
   - **Data Center Core**: Primary data center hosting core banking services

2. `Telemetry`: Telegraf and Prometheus collect metrics from the simulated environment monitoring:
   - Network latency and packet loss between branches
   - Server resource utilization (CPU, memory, disk)
   - Application performance metrics
   - Transaction processing rates

3. `Predictive engine`: A baseline risk engine works immediately; optional trained model artifacts can override it to:
   - Predict network failures 30-60 minutes before occurrence
   - Identify performance degradation patterns
   - Provide actionable recommendations to prevent outages

4. `Copilot`: Local retrieval grounds explanations in internal runbooks and topology documents. If Ollama is available locally, it can be added as a final generation layer without changing the API shape, enabling:
   - Automated incident diagnosis and root cause analysis
   - Step-by-step troubleshooting guidance for junior engineers
   - Historical incident pattern recognition

## Quick start

1. Create a virtual environment and install `requirements.txt`.
2. Generate demo data:

```powershell
python scripts/generate_demo_data.py
```

3. Train the baseline classifier:

```powershell
python ml/preprocess.py
python ml/train_models.py
```

4. Start the API:

```powershell
uvicorn api.main:app --reload --port 8000
```

5. Start the dashboard:

```powershell
streamlit run ui/dashboard.py
```

## Demo-first workflow

You do not need the full network lab up on day one. This repo supports a staged build that mirrors TechCorp India's actual deployment strategy:

- `Stage 1`: Use synthetic telemetry to validate the end-to-end copilot flow (Proof of Concept)
- `Stage 2`: Replace synthetic CSV inputs with Prometheus exports from the real lab (Pilot deployment in 3 branches)
- `Stage 3`: Add a local Ollama model for richer explanations (Full rollout across 8 states)
- `Stage 4`: Run the four validation scenarios in `validation/scenarios.json` (Production readiness testing)

## Air-gap stance

The code paths in this starter do not require external APIs. The optional local LLM integration targets `http://127.0.0.1:11434` only. See `docs/air_gap_compliance.md` for the operational checklist.

**Business Critical Requirement**: This air-gap compliance is essential for TechCorp India's banking operations under RBI regulations requiring all financial transaction monitoring systems to operate within secure, isolated environments.

## Suggested next build steps

1. Bring up the synthetic demo and verify `/analyze` (Simulate Mumbai-Bangalore network issues)
2. Populate Grafana with the same signals used by the API (Create dashboards for branch-level monitoring)
3. Replace the heuristic risk engine with your trained LSTM/XGBoost/forecast stack (Improve prediction accuracy for peak transaction hours)
4. Cache Ollama models and embeddings locally before the final offline demo (Ensure compliance with RBI air-gap requirements)

## Expected Business Impact

When fully deployed across TechCorp India's 8-state network:

- **Reduce network downtime**: From 4-6 hours/month to <30 minutes/month per branch
- **Faster incident resolution**: From 8+ hours to <30 minutes average resolution time
- **Cost savings**: Estimated ₹15-20 crore annually in reduced downtime and improved operational efficiency
- **Improved customer satisfaction**: 99.9% network availability during peak banking hours
- **Compliance**: Full RBI regulatory compliance for financial network monitoring
