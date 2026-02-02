import type { Protocol, AgentRequest, NormalizedIntent } from '@agent-infra/shared';

export interface Adapter {
  readonly protocol: Protocol;
  parse(rawPayload: unknown): ParseResult;
  normalize(parsed: ParseResult): NormalizeResult;
}

export interface ParseResult {
  success: boolean;
  data?: unknown;
  error?: ParseError;
  metadata: {
    protocol: Protocol;
    timestamp: number;
    rawSize: number;
  };
}

export interface ParseError {
  code: string;
  message: string;
  path?: string[];
  suggestion?: string;
}

export interface NormalizeResult {
  success: boolean;
  intent?: NormalizedIntent;
  error?: NormalizeError;
  performance: {
    parsingTimeMs: number;
    normalizationTimeMs: number;
    totalOverheadMs: number;
  };
}

export interface NormalizeError {
  code: string;
  message: string;
  originalError?: unknown;
}

export interface AdapterConfig {
  strictValidation: boolean;
  maxPayloadSize: number;
  timeoutMs: number;
  preserveUnknownFields: boolean;
}
