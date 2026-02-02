# ADR 005: Credential Management

## Status
Accepted

## Context
Each tool requires credentials. Manual credential management is error-prone and time-consuming.

## Decision
Pre-built integration templates with guided setup for <10min new tool integration.

## Consequences

### Positive
- Faster onboarding
- Consistent credential handling
- Automatic health monitoring

### Negative
- Must maintain templates
- Security responsibility for stored credentials

## Alternatives Considered
- **Manual setup**: Rejected - too slow
- **Vault-only**: Rejected - too complex for users

## Compliance
Target: <10min integration time
Measurement: Tracked in integration wizard
