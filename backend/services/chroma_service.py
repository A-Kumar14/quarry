"""
chroma_service.py — Chroma vector storage for semantic search across conversations.

Uses a PersistentClient stored at backend/data/chroma/.
Collection: quarry_conversations
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CHROMA_DIR = str(Path(__file__).parent.parent / "data" / "chroma")

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = _client.get_or_create_collection(
            name="quarry_conversations",
            metadata={"hnsw:space": "cosine"},
        )
    except Exception as exc:
        logger.error("chroma_service.init_failed: %s", exc)
        _collection = None
    return _collection


def store_message(
    message_id: str,
    content: str,
    metadata: dict,
) -> None:
    """Embed and store a message. Silently no-ops if Chroma is unavailable."""
    if not content.strip():
        return
    try:
        col = _get_collection()
        if col is None:
            return
        col.upsert(
            ids=[message_id],
            documents=[content[:2000]],  # cap at 2000 chars
            metadatas=[metadata],
        )
    except Exception as exc:
        logger.warning("chroma_service.store_failed id=%s: %s", message_id, exc)


def semantic_search(query: str, n_results: int = 5) -> list[dict]:
    """Search for messages semantically similar to query.

    Returns list of {session_id, branch_id, session_title, excerpt, score}.
    Returns [] on any error.
    """
    try:
        col = _get_collection()
        if col is None:
            return []
        count = col.count()
        if count == 0:
            return []
        actual_n = min(n_results, count)
        results = col.query(
            query_texts=[query],
            n_results=actual_n,
            include=["documents", "metadatas", "distances"],
        )
        output = []
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        dists = results.get("distances", [[]])[0]
        for doc, meta, dist in zip(docs, metas, dists):
            output.append({
                "excerpt": doc[:200],
                "session_id": meta.get("session_id", ""),
                "branch_id": meta.get("branch_id", ""),
                "session_title": meta.get("session_title", ""),
                "score": round(1 - dist, 3),  # cosine: distance → similarity
            })
        return output
    except Exception as exc:
        logger.error("chroma_service.search_failed: %s", exc)
        return []
