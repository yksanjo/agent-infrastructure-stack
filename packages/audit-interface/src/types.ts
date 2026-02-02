import type { AuditEntry, ToolCall } from '@agent-infra/shared';

export interface AuditView {
  id: string;
  title: string;
  summary: AuditSummary;
  details: AuditDetails;
  actions: AuditAction[];
  metadata: ViewMetadata;
}

export interface AuditSummary {
  what: string;          // One-line description
  who: string;           // Actor
  when: string;          // Human-readable time
  impact: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'modified';
}

export interface AuditDetails {
  before?: unknown;
  after?: unknown;
  changes: Change[];
  context: Record<string, unknown>;
  relatedEntries: string[];
}

export interface Change {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'removed' | 'modified';
}

export interface AuditAction {
  id: string;
  label: string;
  type: 'approve' | 'reject' | 'modify' | 'view';
  primary: boolean;
  enabled: boolean;
}

export interface ViewMetadata {
  createdAt: number;
  comprehensionTargetSec: number;
  estimatedReadTimeSec: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ComprehensionMetrics {
  timeToUnderstand: number;
  accuracy: number;
  userConfidence: number;
  improvementSuggestions: string[];
}

export interface AuditStreamConfig {
  bufferSize: number;
  flushIntervalMs: number;
  retentionDays: number;
  compressionEnabled: boolean;
}

export type AuditFilter = {
  startTime?: number;
  endTime?: number;
  eventTypes?: string[];
  severity?: string[];
  actor?: string;
  traceId?: string;
};
