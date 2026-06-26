from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from backend.data_loader import (
    load_topology,
    load_incidents,
    load_syslog_events,
    load_runbooks,
    DATA_DIR
)

# Suppress Hugging Face download warning logs in console if offline
os.environ["TOKENIZERS_PARALLELISM"] = "false"

TOKEN_RE = re.compile(r"[a-z0-9\-]+")

class FallbackVectorSearch:
    """A pure-Python TF-IDF / Token Overlap search system used as a fallback if ChromaDB/Torch fails."""
    def __init__(self):
        self.documents: list[dict[str, Any]] = []

    def add_documents(self, documents: list[str], metadatas: list[dict[str, Any]], ids: list[str]):
        for doc, meta, doc_id in zip(documents, metadatas, ids):
            self.documents.append({
                "id": doc_id,
                "document": doc,
                "metadata": meta
            })

    def search(self, query: str, limit: int = 4) -> list[dict[str, Any]]:
        query_tokens = set(TOKEN_RE.findall(query.lower()))
        scored = []
        for doc in self.documents:
            doc_tokens = TOKEN_RE.findall(doc["document"].lower())
            # Calculate simple jaccard or token overlap score
            score = sum(token in query_tokens for token in doc_tokens)
            scored.append((score, doc))
        
        # Sort by score descending
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:limit]]


class RAGService:
    def __init__(self) -> None:
        self.use_fallback = False
        self.fallback_db = FallbackVectorSearch()
        self.collection = None
        
        # We try to initialize ChromaDB and Sentence-Transformers
        try:
            import chromadb
            from chromadb.utils import embedding_functions
            
            # Setup persistent database path
            chroma_path = str(DATA_DIR / "chroma_db")
            self.client = chromadb.PersistentClient(path=chroma_path)
            
            # Use local sentence-transformers model
            self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name="noc_knowledge",
                embedding_function=self.embedding_function
            )
            
            # If collection is empty, index documents
            if self.collection.count() == 0:
                self._populate_database()
                
        except Exception as e:
            print(f"[RAG] ChromaDB initialization failed: {e}. Falling back to pure Python index.")
            self.use_fallback = True
            self._populate_database()

    def _populate_database(self) -> None:
        # Load runbooks (6)
        runbooks = load_runbooks()
        rb_docs, rb_metas, rb_ids = [], [], []
        for rb in runbooks:
            doc_text = f"Runbook {rb.get('runbook_id')}: {rb.get('title')}. " \
                       f"Trigger conditions: {rb.get('trigger_conditions')}. " \
                       f"Steps: {rb.get('step_1')}; {rb.get('step_2')}; {rb.get('step_3')}; {rb.get('step_4')}; " \
                       f"{rb.get('step_5')}; {rb.get('step_6')}; {rb.get('step_7')}; {rb.get('step_8')}. " \
                       f"Expected recovery time: {rb.get('expected_recovery_time_minutes')} minutes."
            rb_docs.append(doc_text)
            rb_metas.append({"type": "runbook", "id": rb.get("runbook_id"), "title": rb.get("title")})
            rb_ids.append(rb.get("runbook_id"))

        # Load incidents (22)
        incidents = load_incidents()
        inc_docs, inc_metas, inc_ids = [], [], []
        for inc in incidents:
            doc_text = f"Incident {inc.get('incident_id')}: {inc.get('title')}. " \
                       f"Description: {inc.get('description')}. " \
                       f"Root cause: {inc.get('root_cause')}. " \
                       f"Resolution: {inc.get('resolution_action')}."
            inc_docs.append(doc_text)
            inc_metas.append({"type": "incident", "id": inc.get("incident_id"), "title": inc.get("title")})
            inc_ids.append(inc.get("incident_id"))

        # Load syslog events (sample of 50)
        syslogs = load_syslog_events(limit=50)
        slog_docs, slog_metas, slog_ids = [], [], []
        for i, slog in enumerate(syslogs):
            slog_id = slog.get("event_id", f"SLOG-{i}")
            doc_text = f"Syslog at {slog.get('timestamp')} for site {slog.get('site_id')} ({slog.get('severity')}): {slog.get('message')} [Fault Type: {slog.get('fault_type')}]"
            slog_docs.append(doc_text)
            slog_metas.append({"type": "syslog", "id": slog_id, "site": slog.get("site_id")})
            slog_ids.append(slog_id)

        # Load topology node descriptions (16)
        topology = load_topology()
        node_docs, node_metas, node_ids = [], [], []
        for node in topology.get("nodes", []):
            node_id = node.get("id")
            services_str = ", ".join(node.get("services", []))
            pred = node.get("prediction", {})
            pred_str = f"Prediction: {pred.get('issue')} (confidence: {pred.get('confidence')}, eta: {pred.get('eta_minutes')} min)" if pred else "No active predictions."
            doc_text = f"Node {node.get('label')} ({node_id}) is a {node.get('type')} router in {node.get('city')}, {node.get('state')} (Region: {node.get('region')}, ASN: {node.get('asn')}). " \
                       f"It runs services: {services_str}. Status: {node.get('status')}. {pred_str}"
            node_docs.append(doc_text)
            node_metas.append({"type": "topology", "id": node_id, "title": node.get("label")})
            node_ids.append(node_id)

        # Index them
        all_docs = rb_docs + inc_docs + slog_docs + node_docs
        all_metas = rb_metas + inc_metas + slog_metas + node_metas
        all_ids = rb_ids + inc_ids + slog_ids + node_ids

        if self.use_fallback:
            self.fallback_db.add_documents(all_docs, all_metas, all_ids)
        else:
            self.collection.add(
                documents=all_docs,
                metadatas=all_metas,
                ids=all_ids
            )

    def query(self, query_text: str, limit: int = 4) -> list[dict[str, Any]]:
        if self.use_fallback:
            return self.fallback_db.search(query_text, limit=limit)
        
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=limit
            )
            # Format output to match standard dictionary list
            docs = []
            if results and results["documents"]:
                for doc, meta, doc_id in zip(results["documents"][0], results["metadatas"][0], results["ids"][0]):
                    docs.append({
                        "id": doc_id,
                        "document": doc,
                        "metadata": meta
                    })
            return docs
        except Exception as e:
            print(f"[RAG] Query failed: {e}. Running fallback search.")
            return self.fallback_db.search(query_text, limit=limit)
