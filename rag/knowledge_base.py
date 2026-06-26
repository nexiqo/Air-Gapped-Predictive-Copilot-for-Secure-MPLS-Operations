from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


TOKEN_RE = re.compile(r"[a-z0-9\-]+")
ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = ROOT / "data" / "knowledge"


@dataclass
class KnowledgeDocument:
    source: str
    title: str
    body: str


class LocalKnowledgeBase:
    def __init__(self, knowledge_dir: Path | None = None) -> None:
        self.knowledge_dir = knowledge_dir or KNOWLEDGE_DIR
        self.documents = self._load_documents()

    def _load_documents(self) -> list[KnowledgeDocument]:
        docs: list[KnowledgeDocument] = []

        runbooks = json.loads((self.knowledge_dir / "runbooks.json").read_text(encoding="utf-8"))
        for item in runbooks:
            docs.append(
                KnowledgeDocument(
                    source=item["id"],
                    title=item["title"],
                    body=f'{item["body"]} Keywords: {" ".join(item["keywords"])}',
                )
            )

        incidents = json.loads((self.knowledge_dir / "incidents.json").read_text(encoding="utf-8"))
        for item in incidents:
            docs.append(
                KnowledgeDocument(
                    source=item["id"],
                    title=item["summary"],
                    body=f'{item["summary"]} Tags: {" ".join(item["tags"])}',
                )
            )

        topology = (self.knowledge_dir / "topology.md").read_text(encoding="utf-8")
        docs.append(KnowledgeDocument(source="TOPOLOGY", title="Topology Notes", body=topology))
        return docs

    def search(self, query: str, limit: int = 3) -> list[KnowledgeDocument]:
        query_tokens = set(TOKEN_RE.findall(query.lower()))
        scored: list[tuple[int, KnowledgeDocument]] = []
        for doc in self.documents:
            doc_tokens = TOKEN_RE.findall(f"{doc.title} {doc.body}".lower())
            score = sum(token in query_tokens for token in doc_tokens)
            if score > 0:
                scored.append((score, doc))

        scored.sort(key=lambda item: item[0], reverse=True)
        if scored:
            return [doc for _, doc in scored[:limit]]
        return self.documents[:limit]
