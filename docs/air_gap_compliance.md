# Air-Gap Compliance Checklist

## Runtime assumptions

- No cloud APIs are required by this repository.
- Optional LLM usage targets a local Ollama server only.
- Retrieval uses files under `data/knowledge/` only.

## Before disabling internet

1. Install all Python dependencies from `requirements.txt`.
2. Pull required Docker images for Prometheus, Grafana, and Telegraf.
3. Pull any Containerlab and FRRouting images you intend to use.
4. If you plan to use Ollama, cache the chosen model locally.

## During the offline demo

1. Verify that the machine has no outbound connectivity.
2. Show that API responses still work from local telemetry or demo CSV data.
3. If using Ollama, verify the model is loaded from local disk and the host is `127.0.0.1`.
4. Keep copies of the runbooks and topology notes on disk for judge review.

## Code-level controls

- `api/copilot.py` only attempts local loopback LLM access.
- `rag/knowledge_base.py` reads local files directly and does not crawl external sources.
- The fallback copilot path is fully template-based and works with zero network access.

## Recommended proof points

- A screenshot of the API health endpoint while offline.
- A terminal screenshot showing failed internet reachability.
- A dashboard screenshot showing a predicted issue and a grounded runbook recommendation.
- The generated `validation/validation_results.sample.json` or your final measured results file.
