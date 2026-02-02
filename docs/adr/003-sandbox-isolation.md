# ADR 003: Sandboxed Tool Execution

## Status
Accepted

## Context
Tools may execute arbitrary code. Security requires isolation from host system and other tools.

## Decision
Use container-based sandboxes with resource limits and network policies.

## Consequences

### Positive
- Strong security isolation
- Resource control (CPU, memory, network)
- Easy cleanup and reset

### Negative
- Cold start overhead (target: <500ms)
- Resource overhead of containers
- Complexity of orchestration

## Alternatives Considered
- **Process isolation**: Rejected - insufficient security
- **VMs**: Rejected - too slow (>2s cold start)
- **WebAssembly**: Considered for future

## Compliance
Target: <500ms cold start
Measurement: See benchmarks/sandbox-coldstart/
