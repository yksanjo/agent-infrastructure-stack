# ADR 001: Protocol Abstraction Layer

## Status
Accepted

## Context
Agents in February 2026 must communicate across multiple protocols: MCP, A2A, UCP, ACP, and proprietary APIs. Each protocol has different message formats, authentication mechanisms, and semantics.

## Decision
Implement a universal protocol adapter that normalizes all incoming requests to a common internal format.

## Consequences

### Positive
- Single integration point for new protocols
- Consistent request handling regardless of source
- Easier testing and mocking

### Negative
- Translation overhead (target: <5ms)
- Must maintain adapter for each protocol

## Alternatives Considered
- **Direct protocol handling**: Rejected - too complex
- **Protocol-specific services**: Rejected - operational overhead

## Compliance
Target: <5ms translation overhead
Measurement: See benchmarks/protocol-translation/
