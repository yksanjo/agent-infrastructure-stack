// Performance targets from success metrics

export const PERFORMANCE_TARGETS = {
  protocolTranslationOverheadMs: 5,
  semanticRoutingAccuracy: 0.95,
  intentResolutionLatencyMs: 50,
  auditInterfaceComprehensionSec: 5,
  sandboxColdStartMs: 500,
  toolIntegrationTimeMin: 10,
} as const;

// Protocol identifiers
export const PROTOCOLS = {
  MCP: 'mcp' as const,
  A2A: 'a2a' as const,
  UCP: 'ucp' as const,
  ACP: 'acp' as const,
  OPENAI: 'openai' as const,
  ANTHROPIC: 'anthropic' as const,
};

// Intent categories
export const INTENT_CATEGORIES = [
  'tool_call',
  'information_request',
  'action_execution',
  'data_retrieval',
  'code_generation',
  'analysis',
  'conversation',
  'escalation',
] as const;

// Audit event types
export const AUDIT_EVENT_TYPES = [
  'request_received',
  'intent_classified',
  'tool_selected',
  'human_approval_requested',
  'human_approved',
  'human_rejected',
  'tool_executed',
  'tool_failed',
  'response_sent',
  'error_occurred',
  'security_alert',
] as const;

// Default timeouts
export const DEFAULT_TIMEOUTS = {
  protocolTranslation: 100,
  intentResolution: 100,
  toolExecution: 30000,
  humanApproval: 300000, // 5 minutes
  sandboxColdStart: 500,
} as const;

// Rate limits
export const RATE_LIMITS = {
  requestsPerSecond: 1000,
  concurrentSandboxes: 100,
  maxRequestSize: 10 * 1024 * 1024, // 10MB
} as const;

// Security
export const SECURITY = {
  maxCredentialAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes
  maxSandboxAge: 60 * 60 * 1000, // 1 hour
} as const;

// Semantic routing
export const SEMANTIC_ROUTING = {
  embeddingDimensions: 384,
  minConfidence: 0.7,
  similarityThreshold: 0.85,
  maxAlternatives: 3,
} as const;
