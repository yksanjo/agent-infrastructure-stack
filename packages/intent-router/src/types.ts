import type { AgentRequest, ToolDefinition, RoutingDecision } from '@agent-infra/shared';

export interface RouteRequest {
  request: AgentRequest;
  availableTools: ToolDefinition[];
  options?: RouteOptions;
}

export interface RouteOptions {
  maxAlternatives?: number;
  minConfidence?: number;
  timeoutMs?: number;
  useEmbeddings?: boolean;
  considerCost?: boolean;
  considerLatency?: boolean;
}

export interface RouteResult {
  success: boolean;
  decision?: RoutingDecision;
  error?: RouteError;
  performance: {
    embeddingTimeMs: number;
    matchingTimeMs: number;
    totalLatencyMs: number;
  };
  alternatives: ToolMatch[];
}

export interface RouteError {
  code: string;
  message: string;
  suggestion?: string;
}

export interface ToolMatch {
  tool: ToolDefinition;
  score: number;
  confidence: number;
  reasoning: string;
  embedding?: number[];
}

export interface IntentEmbedding {
  intent: string;
  embedding: number[];
  dimensions: number;
  model: string;
}

export interface RouterConfig {
  embeddingModel: string;
  embeddingDimensions: number;
  similarityThreshold: number;
  minConfidence: number;
  maxAlternatives: number;
  cacheEmbeddings: boolean;
  cacheTtlMs: number;
  enableCostOptimization: boolean;
  enableLatencyOptimization: boolean;
}

export interface EmbeddingCache {
  get(key: string): number[] | undefined;
  set(key: string, embedding: number[]): void;
  clear(): void;
}
