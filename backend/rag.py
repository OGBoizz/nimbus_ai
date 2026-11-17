"""Owner: Harsh + Kishlay. Full LangChain + ChromaDB Charter RAG with persistent storage,
citations, query expansion, and prompt-injection filtering.

Requires: GEMINI_API_KEY (or GOOGLE_API_KEY) set in your environment / .env
"""
import json
import os
import re
from pathlib import Path
from langchain_chroma import Chroma

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

CHARTERS_DIR = ROOT / "data" / "charters"
PERSIST_DIR = ROOT / "data" / "chroma_charters_db"
BLOCKED_LOG_PATH = PERSIST_DIR / "blocked_injections.json"

CHUNK_CHARS = 400
CHUNK_OVERLAP = 50
EMBED_THRESHOLD = 0.62
TOP_K = 3

INJECTION_PATTERNS = [
    r"ignore (all )?(previous|prior|above) instructions",
    r"note to (the )?ai",
    r"disregard (the )?(rules|instructions)",
    r"system prompt",
    r"you are now",
    r"report every initiative as",
]

EXPANSIONS = {
    "why": ["risks"], "red": ["risks"], "amber": ["risks"], "underperform": ["risks"],
    "problem": ["risks"], "issue": ["risks"], "concern": ["risks"], "risk": ["risks"],
    "low": ["risks"], "negative": ["risks"], "loss": ["risks"],
    "goal": ["objective"], "aim": ["objective"], "purpose": ["objective"],
    "target": ["success", "metrics"], "kpi": ["success", "metrics"], "measure": ["success", "metrics"],
    "owner": ["sponsor"], "responsible": ["sponsor"], "covers": ["scope"], "include": ["scope"],
}

_vectorstore: Chroma | None = None
_blocked_cache: list[dict] | None = None


def is_injection(text: str) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in INJECTION_PATTERNS)


def expand_query(query: str) -> str:
    words = re.findall(r"[a-z0-9]+", query.lower())
    extra = []
    for w in words:
        stem = w[:-1] if len(w) > 3 and w.endswith("s") else w
        extra.extend(EXPANSIONS.get(w, []))
        extra.extend(EXPANSIONS.get(stem, []))
    if not extra:
        return query
    return f"{query} ({' '.join(dict.fromkeys(extra))})"


def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    model = os.getenv("EMBED_MODEL", "gemini-embedding-001")
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    return GoogleGenerativeAIEmbeddings(model=model, google_api_key=api_key)


def load_and_split_charters() -> tuple[list[Document], list[dict]]:
    """1. Document Loading -> 2. Header & Recursive Splitting -> 3. Injection Sanitisation."""
    loader = DirectoryLoader(
        str(CHARTERS_DIR),
        glob="*.md",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
    )
    raw_docs = loader.load()

    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "title"), ("##", "section")],
        strip_headers=True,
    )
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_CHARS,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )

    final_chunks: list[Document] = []
    blocked: list[dict] = []

    for raw_doc in sorted(raw_docs, key=lambda d: d.metadata["source"]):
        source_path = Path(raw_doc.metadata["source"])
        rel_file = f"data/charters/{source_path.name}"
        iid = source_path.stem.upper()

        header_docs = md_splitter.split_text(raw_doc.page_content)

        for h_doc in header_docs:
            title = h_doc.metadata.get("title", "").strip()
            section = h_doc.metadata.get("section", "General").strip()
            body = h_doc.page_content.strip()

            if not body:
                continue

            # Prompt-injection check & sentence-level sanitisation
            sanitised = False
            if is_injection(body):
                clean_sentences = [
                    s for s in re.split(r"(?<=[.!?])\s+", body) if not is_injection(s)
                ]
                body = " ".join(clean_sentences).strip()
                blocked.append({"file": rel_file, "section": section})
                sanitised = True

            if not body:
                continue

            # Split long sections while preserving citation metadata
            pieces = text_splitter.split_text(body)
            total_parts = len(pieces)

            for idx, piece in enumerate(pieces, 1):
                enriched_text = f"{title} | {section}: {piece}" if title else f"{section}: {piece}"
                final_chunks.append(
                    Document(
                        page_content=enriched_text,
                        metadata={
                            "file": rel_file,
                            "initiative_id": iid,
                            "title": title,
                            "section": section,
                            "raw_text": piece,
                            "part": idx,
                            "parts": total_parts,
                            "sanitised": sanitised,
                        },
                    )
                )

    return final_chunks, blocked


def load_chunks() -> tuple[list[dict], list[dict]]:
    """Backward-compatible helper returning plain dicts for unit tests."""
    docs, blocked = load_and_split_charters()
    return [{**d.metadata, "text": d.metadata["raw_text"]} for d in docs], blocked


def build_and_save_vectorstore(force_rebuild: bool = False) -> tuple[Chroma, list[dict]]:
    """Loads persisted ChromaDB into memory once, or builds and saves it on first run."""
    global _vectorstore, _blocked_cache
    if _vectorstore is not None and _blocked_cache is not None and not force_rebuild:
        return _vectorstore, _blocked_cache

    embeddings = get_embeddings()

    if PERSIST_DIR.exists() and any(PERSIST_DIR.iterdir()) and not force_rebuild:
        _vectorstore = Chroma(
            collection_name="project_charters",
            embedding_function=embeddings,
            persist_directory=str(PERSIST_DIR),
        )
        _blocked_cache = (
            json.loads(BLOCKED_LOG_PATH.read_text(encoding="utf-8"))
            if BLOCKED_LOG_PATH.exists()
            else []
        )
        return _vectorstore, _blocked_cache

    PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    chunks, blocked = load_and_split_charters()

    if not chunks:
        raise ValueError(f"No valid charter chunks found in {CHARTERS_DIR}")

    _vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name="project_charters",
        persist_directory=str(PERSIST_DIR),
        collection_metadata={"hnsw:space": "cosine"},
    )
    BLOCKED_LOG_PATH.write_text(json.dumps(blocked, indent=2), encoding="utf-8")
    _blocked_cache = blocked
    return _vectorstore, _blocked_cache


def search_charters(
    query: str,
    initiative: str | None = None,
    k: int = TOP_K,
    force_rebuild: bool = False,
) -> dict:
    """Retrieves top-k charter sections from persistent ChromaDB with citations."""
    try:
        vectorstore, blocked = build_and_save_vectorstore(force_rebuild=force_rebuild)

        chroma_filter = None
        if initiative:
            chroma_filter = {"initiative_id": initiative.strip().upper()}

        expanded_q = expand_query(query)

        raw_hits = vectorstore.similarity_search_with_relevance_scores(
            expanded_q,
            k=k * 2,
            filter=chroma_filter,
        )

        # Fallback: scan full store if `initiative` matched the end of `title` rather than ID
        if not raw_hits and initiative:
            all_hits = vectorstore.similarity_search_with_relevance_scores(expanded_q, k=50)
            target = initiative.strip().lower()
            raw_hits = [
                (doc, score)
                for doc, score in all_hits
                if doc.metadata.get("title", "").lower().endswith(target)
            ]

        if not raw_hits:
            return {"found": False, "results": [], "blocked": blocked}

        raw_hits.sort(key=lambda x: -x[1])
        top_score = raw_hits[0][1]

        results = []
        for doc, score in raw_hits[:k]:
            if score >= EMBED_THRESHOLD and score >= 0.5 * top_score:
                meta = doc.metadata
                results.append({
                    "file": meta["file"],
                    "initiative_id": meta["initiative_id"],
                    "title": meta["title"],
                    "section": meta["section"],
                    "citation": f"{Path(meta['file']).name} § {meta['section']}",
                    "text": meta["raw_text"],
                    "part": meta["part"],
                    "parts": meta["parts"],
                    "sanitised": meta["sanitised"],
                    "score": round(float(score), 3),
                })

        return {"found": bool(results), "results": results, "blocked": blocked}
    except Exception:
        return {"found": False, "results": [], "blocked": []}


if __name__ == "__main__":
    output = search_charters("why is it red", initiative="PM-01", force_rebuild=True)
    print(json.dumps(output, indent=2))