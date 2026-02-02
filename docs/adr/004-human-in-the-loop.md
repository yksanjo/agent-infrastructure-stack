# ADR 004: Human-in-the-Loop Audit Interface

## Status
Accepted

## Context
Production agents require human oversight. Traditional log diving takes too long and misses context.

## Decision
Design audit interfaces for 5-second comprehension with clear summaries and contextual actions.

## Consequences

### Positive
- Faster human review cycles
- Higher confidence in agent actions
- Reduced error rates

### Negative
- Requires UI/UX investment
- May introduce latency for approval workflows

## Alternatives Considered
- **Raw logs**: Rejected - too slow to parse
- **Dashboard-only**: Rejected - not actionable

## Compliance
Target: <5 second comprehension time
Measurement: See benchmarks/audit-comprehension/
