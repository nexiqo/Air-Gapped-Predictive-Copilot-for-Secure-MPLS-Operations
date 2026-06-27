from __future__ import annotations

import os
import re
import math
from collections import Counter
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
    """A pure-Python TF-IDF Vector Space semantic search engine with Cosine Similarity."""
    def __init__(self):
        self.documents: list[dict[str, Any]] = []
        self.vocab: set[str] = set()
        self.doc_tokens_list: list[list[str]] = []
        self.idf: dict[str, float] = {}

    def add_documents(self, documents: list[str], metadatas: list[dict[str, Any]], ids: list[str]):
        # Reset vocab and documents
        self.documents = []
        self.doc_tokens_list = []
        self.vocab = set()
        
        for doc, meta, doc_id in zip(documents, metadatas, ids):
            self.documents.append({
                "id": doc_id,
                "document": doc,
                "metadata": meta
            })
            tokens = TOKEN_RE.findall(doc.lower())
            self.doc_tokens_list.append(tokens)
            for t in tokens:
                self.vocab.add(t)
                
        # Calculate IDF for all words in vocabulary
        total_docs = len(self.documents)
        doc_frequencies = Counter()
        for tokens in self.doc_tokens_list:
            unique_tokens = set(tokens)
            for t in unique_tokens:
                doc_frequencies[t] += 1
                
        self.idf = {}
        for term in self.vocab:
            # Add-one smoothing to prevent division by zero
            self.idf[term] = math.log(1.0 + (total_docs / (1.0 + doc_frequencies[term])))

    def search(self, query: str, limit: int = 4) -> list[dict[str, Any]]:
        if not self.documents:
            return []
            
        query_tokens = TOKEN_RE.findall(query.lower())
        if not query_tokens:
            return self.documents[:limit]
            
        # Calculate Query TF-IDF vector
        query_tf = Counter(query_tokens)
        query_vector = {}
        query_norm = 0.0
        
        for term, freq in query_tf.items():
            if term in self.idf:
                tf = freq / len(query_tokens)
                tfidf = tf * self.idf[term]
                query_vector[term] = tfidf
                query_norm += tfidf * tfidf
        query_norm = math.sqrt(query_norm)
        
        if query_norm == 0.0:
            # Fall back to first document matches if query terms aren't in vocabulary
            return self.documents[:limit]
            
        scored = []
        for idx, doc in enumerate(self.documents):
            doc_tokens = self.doc_tokens_list[idx]
            if not doc_tokens:
                scored.append((0.0, doc))
                continue
                
            doc_tf = Counter(doc_tokens)
            doc_vector = {}
            doc_norm = 0.0
            
            for term, freq in doc_tf.items():
                if term in self.idf:
                    tf = freq / len(doc_tokens)
                    tfidf = tf * self.idf[term]
                    doc_vector[term] = tfidf
                    doc_norm += tfidf * tfidf
            doc_norm = math.sqrt(doc_norm)
            
            if doc_norm == 0.0:
                scored.append((0.0, doc))
                continue
                
            # Cosine similarity dot product
            dot_product = sum(query_vector[t] * doc_vector.get(t, 0.0) for t in query_vector if t in doc_vector)
            cosine_sim = dot_product / (query_norm * doc_norm)
            scored.append((cosine_sim, doc))
            
        # Sort by similarity score descending
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

        # Ultimate NOC Troubleshooting Guides (Deep technical RAG guides)
        guides = [
            {
                "id": "GUIDE-BGP",
                "doc": "Ultimate Guide to BGP Route Flapping and Peer Adjacency Issues: BGP flaps occur due to packet loss on link interfaces, MTU mismatches, or high CPU utilization. Symptoms include OSPF adjacency drops, log warnings containing 'BGP-5-ADJCHANGE', and prefix drops. Resolution actions: Ping peer IPs to verify connection; check MTU settings; set route dampening parameters; configure prefix limit thresholds to prevent table overflow.",
                "meta": {"type": "guide", "id": "GUIDE-BGP", "title": "BGP Troubleshooting SOP"}
            },
            {
                "id": "GUIDE-CONGESTION",
                "doc": "Ultimate Guide to WAN/MPLS Link Congestion: Congestion occurs when bandwidth utilization exceeds SLA thresholds (60% warning, 80% critical). Symptoms: ping delays, latency spikes, and buffer discards on outbound WAN queues. Resolution actions: check top-talker protocols (Netflow port mappings); implement high-priority queues for voice/video; configure traffic shaping policies; apply traffic-engineering tunnel reroutes.",
                "meta": {"type": "guide", "id": "GUIDE-CONGESTION", "title": "MPLS Congestion SOP"}
            },
            {
                "id": "GUIDE-OPTICAL",
                "doc": "Ultimate Guide to Fiber Optical Signal Degradation: High attenuation on single-mode fiber links is caused by bend radius violations, dirty connectors, or laser aging. Telemetry signs: packet loss rises incrementally, latency remains steady, SNMP shows high interface input error rates. Mitigation: dispatch local technician to clean optical patch cords; swap transceiver modules; check Rx/Tx power levels on routers.",
                "meta": {"type": "guide", "id": "GUIDE-OPTICAL", "title": "Optical Interface SOP"}
            },
            {
                "id": "GUIDE-TUNNEL",
                "doc": "Ultimate Guide to IPsec/GRE VPN Tunnel Failures: VPN tunnels drop due to IKE Phase 1/2 negotiation timeouts, expired pre-shared keys, or NAT-Traversal failures. Verification commands: 'show crypto ikev2 sa', 'show crypto ipsec sa'. Fix: clear crypto sessions; check certificate validity; restart crypto loop interfaces.",
                "meta": {"type": "guide", "id": "GUIDE-TUNNEL", "title": "VPN Tunnel SOP"}
            }
        ]
        
        guide_docs, guide_metas, guide_ids = [], [], []
        for g in guides:
            guide_docs.append(g["doc"])
            guide_metas.append(g["meta"])
            guide_ids.append(g["id"])

        # Index them
        all_docs = rb_docs + inc_docs + slog_docs + node_docs + guide_docs
        all_metas = rb_metas + inc_metas + slog_metas + node_metas + guide_metas
        all_ids = rb_ids + inc_ids + slog_ids + node_ids + guide_ids

        if self.use_fallback:
            self.fallback_db.add_documents(all_docs, all_metas, all_ids)
        else:
            self.collection.add(
                documents=all_docs,
                metadatas=all_metas,
                ids=all_ids
            )

    def doc_count(self) -> int:
        """Return total number of indexed documents."""
        try:
            if self.use_fallback:
                return len(self.fallback_db.documents)
            return self.collection.count()
        except Exception:
            return 0

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
