---
name: rag
description: "Design and build retrieval-augmented generation systems — chunking, embeddings, vector stores, hybrid search, reranking, and retrieval evaluation. Use for semantic search, document retrieval, knowledge-grounded AI, or vector-database work."
domain: ai-ml
role: task
order: 1
load_when: retrieval/vector work is in scope
guidance: reuse the existing vector store | chunk with intent | evaluate retrieval quality

metadata:
  author: guava-os
  version: "0.1.0"
---

## Retrieval-Augmented Generation

Production RAG is an ingestion pipeline plus a retrieval pipeline. Design each
step, then validate it with metrics before wiring in the LLM.

## Workflow

1. **Requirements** — retrieval needs, latency budget, accuracy target, scale.
2. **Vector store** — pick DB, schema, index, sharding to match the query load.
3. **Chunking** — split strategy, overlap, semantic boundaries, metadata.
4. **Retrieval pipeline** — embedding model, query transform, hybrid search, rerank.
5. **Evaluate & iterate** — metric tracking, retrieval debugging, optimization.

## Chunking

- Tune `chunk_size` on real domain data — never ship a default blindly.
- Overlap small (~10–15%) to reduce split-boundary context loss.
- Split on semantic boundaries (paragraphs, then sentences, then words).
- Enrich every chunk with `source`, `section`, `timestamp` metadata.

## Embeddings & indexing

- Benchmark multiple embedding models on your corpus before committing.
- Store model name + dimension as version metadata; plan for migration.
- Deduplicate with deterministic IDs (hash of chunk content) so ingestion is idempotent.
- Never hardcode provider API keys in application code.

## Hybrid search

- Combine dense (vector) with sparse (BM25 / keyword); cosine alone fails on exact terms and multi-domain corpora.
- Merge with reciprocal rank fusion or a weighted score blend.
- Apply metadata filters (tenant, source, date) at query time.

## Reranking & evaluation

- Rerank top-k candidates with a cross-encoder before stuffing context.
- Track precision@k, recall@k, MRR, NDCG; also RAGAS `context_precision`, `context_recall`, `faithfulness`, `answer_relevancy`.
- Gate LLM integration on thresholds (e.g. context_precision ≥ 0.7, recall ≥ 0.6).

## Rules

DO:
- Hybrid search and metadata filters in production.
- Idempotent ingestion with dedup and deterministic IDs.
- Monitor retrieval latency and quality over time.

DON'T:
- Skip metadata enrichment.
- Judge retrieval by LLM output quality alone.
- Couple the embedding model tightly to application code.

## Uses

- Building a RAG pipeline, vector database, or knowledge-grounded app
- Selecting chunking/embedding/hybrid-search strategy for a corpus
- Debugging poor retrieval quality or setting evaluation baselines

## Source

Upstream: Jeffallan/claude-skills — `skills/rag-architect`