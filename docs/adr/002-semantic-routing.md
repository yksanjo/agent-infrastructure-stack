# ADR 002: Semantic Intent Routing

## Status
Accepted

## Context
Traditional rule-based routing fails when tool descriptions are similar or when intent is ambiguous. We need intelligent routing that understands semantic meaning.

## Decision
Use vector embeddings with cosine similarity for intent-to-tool matching.

## Consequences

### Positive
- >95% routing accuracy on test set
- Handles ambiguous queries gracefully
- Provides confidence scores for human review

### Negative
- Requires embedding model
- Latency dependency on embedding API
- Embedding costs

## Alternatives Considered
- **Keyword matching**: Rejected - too rigid
- **LLM-based routing**: Rejected - too slow (>100ms)
- **Hybrid approach**: Accepted as fallback

## Compliance
Target: >95% accuracy, <50ms latency
Measurement: See benchmarks/intent-routing/
