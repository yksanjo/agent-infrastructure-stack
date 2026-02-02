// Core protocol types supporting MCP, A2A, UCP, ACP

export type Protocol = 'mcp' | 'a2a' | 'ucp' | 'acp' | 'openai' | 'anthropic';

export type IntentCategory = 
  | 'tool_call'
  | 'information_request'
  | 'action_execution'
  | 'data_retrieval'
  | 'code_generation'
  | 'analysis'
  | 'conversation'
  | 'escalation';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'uncertain';

export type ExecutionStatus = 
  | 'pending'
  | 'routing'
  | 'awaiting_human'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface AgentRequest {
  id: string;
  timestamp: number;
  sourceProtocol: Protocol;
  rawPayload: unknown;
  normalizedIntent: NormalizedIntent;
  context: RequestContext;
  metadata: RequestMetadata;
}

export interface NormalizedIntent {
  id: string;
  category: IntentCategory;
  action: string;
  target: string;
  parameters: Record<string, unknown>;
  confidence: number;
  alternatives: IntentAlternative[];
  semanticEmbedding?: number[];
}

export interface IntentAlternative {
  action: string;
  confidence: number;
  reason: string;
}

export interface RequestContext {
  sessionId: string;
  userId: string;
  conversationHistory: ConversationTurn[];
  availableTools: ToolDefinition[];
  constraints: Constraint[];
  preferences: UserPreference[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  protocol: Protocol;
  parameters: ParameterSchema;
  returns: ReturnSchema;
  costEstimate?: CostEstimate;
  latencyEstimate?: number;
  requiredCredentials?: string[];
}

export interface ParameterSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

export interface SchemaProperty {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ReturnSchema {
  type: string;
  description: string;
}

export interface CostEstimate {
  min: number;
  max: number;
  currency: string;
  unit: 'request' | 'token' | 'minute';
}

export interface Constraint {
  type: 'budget' | 'latency' | 'privacy' | 'compliance';
  value: unknown;
  strict: boolean;
}

export interface UserPreference {
  key: string;
  value: unknown;
  priority: number;
}

export interface RequestMetadata {
  priority: number;
  maxLatencyMs: number;
  maxBudgetCents: number;
  requireHumanApproval: boolean;
  auditLevel: 'minimal' | 'standard' | 'comprehensive';
  traceId: string;
}

export interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: ToolError;
  executionTimeMs?: number;
  costCents?: number;
}

export interface ToolError {
  code: string;
  message: string;
  retryable: boolean;
  suggestedAction?: string;
}

export interface RoutingDecision {
  requestId: string;
  selectedTool: ToolDefinition;
  confidence: number;
  reasoning: string;
  fallbackTools: ToolDefinition[];
  estimatedLatency: number;
  estimatedCost: number;
  requiresApproval: boolean;
  approvalReason?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  traceId: string;
  requestId: string;
  eventType: AuditEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  beforeState?: unknown;
  afterState?: unknown;
  humanReview?: HumanReview;
}

export type AuditEventType = 
  | 'request_received'
  | 'intent_classified'
  | 'tool_selected'
  | 'human_approval_requested'
  | 'human_approved'
  | 'human_rejected'
  | 'tool_executed'
  | 'tool_failed'
  | 'response_sent'
  | 'error_occurred'
  | 'security_alert';

export interface HumanReview {
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'modified';
  timestamp: number;
  comments?: string;
  modifications?: Record<string, unknown>;
}

export interface SandboxConfig {
  id: string;
  image: string;
  resources: ResourceLimits;
  networkPolicy: NetworkPolicy;
  allowedTools: string[];
  timeoutMs: number;
  envVars: Record<string, string>;
}

export interface ResourceLimits {
  cpu: string;
  memory: string;
  disk: string;
  network: boolean;
}

export interface NetworkPolicy {
  egress: boolean;
  allowedHosts: string[];
  allowedPorts: number[];
}

export interface Credential {
  id: string;
  provider: string;
  type: 'oauth2' | 'api_key' | 'basic_auth' | 'bearer_token';
  scopes: string[];
  encryptedData: string;
  expiresAt?: number;
  refreshToken?: string;
  metadata: CredentialMetadata;
}

export interface CredentialMetadata {
  name: string;
  description: string;
  createdAt: number;
  lastUsedAt?: number;
  usageCount: number;
  rotationRequired: boolean;
}

// Performance metrics types
export interface PerformanceMetrics {
  protocolTranslationOverheadMs: number;
  semanticRoutingAccuracy: number;
  intentResolutionLatencyMs: number;
  auditInterfaceComprehensionSec: number;
  sandboxColdStartMs: number;
  toolIntegrationTimeMin: number;
}

export interface BenchmarkResult {
  name: string;
  timestamp: number;
  metrics: PerformanceMetrics;
  comparisons: ComparisonResult[];
}

export interface ComparisonResult {
  competitor: string;
  metric: keyof PerformanceMetrics;
  ourValue: number;
  theirValue: number;
  improvement: number;
}
