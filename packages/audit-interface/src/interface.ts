import type { AuditEntry, HumanReview } from '@agent-infra/shared';
import { generateId, now, PERFORMANCE_TARGETS } from '@agent-infra/shared';
import type { AuditView, AuditSummary, ComprehensionMetrics, AuditFilter } from './types';
import { AuditFormatter } from './formatters/formatter';

export class AuditInterface {
  private formatter: AuditFormatter;
  private comprehensionMetrics: Map<string, ComprehensionMetrics> = new Map();

  constructor() {
    this.formatter = new AuditFormatter();
  }

  /**
   * Generate an audit view optimized for 5-second comprehension
   */
  generateView(entry: AuditEntry, context: AuditEntry[] = []): AuditView {
    const startTime = now();
    
    const summary = this.generateSummary(entry);
    const details = this.formatter.formatDetails(entry, context);
    const actions = this.determineActions(entry);
    
    // Calculate estimated read time
    const estimatedReadTime = this.estimateReadTime(summary, details);
    const complexity = this.assessComplexity(entry, details);

    const view: AuditView = {
      id: entry.id,
      title: this.generateTitle(entry),
      summary,
      details,
      actions,
      metadata: {
        createdAt: now(),
        comprehensionTargetSec: PERFORMANCE_TARGETS.auditInterfaceComprehensionSec,
        estimatedReadTimeSec: estimatedReadTime,
        complexity,
      },
    };

    // Record generation time as baseline comprehension metric
    const generationTime = (now() - startTime) / 1000;
    this.comprehensionMetrics.set(entry.id, {
      timeToUnderstand: generationTime,
      accuracy: 1.0,
      userConfidence: 1.0,
      improvementSuggestions: [],
    });

    return view;
  }

  /**
   * Generate a human-friendly summary of the audit entry
   */
  private generateSummary(entry: AuditEntry): AuditSummary {
    return {
      what: this.summarizeEvent(entry),
      who: entry.actor,
      when: this.formatTime(entry.timestamp),
      impact: this.assessImpact(entry),
      status: entry.humanReview?.decision || 'pending',
    };
  }

  /**
   * Create a one-line summary of the event
   */
  private summarizeEvent(entry: AuditEntry): string {
    const eventSummaries: Record<string, string> = {
      'request_received': 'New request received',
      'intent_classified': `Intent identified: ${entry.details.intent || 'unknown'}`,
      'tool_selected': `Tool selected: ${entry.details.toolName || 'unknown'}`,
      'human_approval_requested': 'Human approval required',
      'human_approved': 'Action approved by human',
      'human_rejected': 'Action rejected by human',
      'tool_executed': `Tool executed: ${entry.details.toolName || 'unknown'}`,
      'tool_failed': `Tool failed: ${entry.details.error || 'unknown error'}`,
      'response_sent': 'Response delivered',
      'error_occurred': `Error: ${entry.details.error || 'unknown'}`,
      'security_alert': '⚠️ Security alert triggered',
    };

    return eventSummaries[entry.eventType] || `Event: ${entry.eventType}`;
  }

  /**
   * Format timestamp to human-readable relative time
   */
  private formatTime(timestamp: number): string {
    const diff = now() - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Assess the impact level of an event
   */
  private assessImpact(entry: AuditEntry): AuditSummary['impact'] {
    // Critical events
    if (entry.eventType === 'security_alert') return 'critical';
    if (entry.eventType === 'tool_failed' && entry.severity === 'error') return 'high';
    if (entry.eventType === 'human_approval_requested') return 'high';
    
    // High impact
    if (entry.severity === 'error') return 'high';
    if (entry.eventType === 'tool_executed') return 'medium';
    
    // Medium impact
    if (entry.eventType === 'intent_classified') return 'medium';
    
    return 'low';
  }

  /**
   * Generate appropriate actions based on the event type and status
   */
  private determineActions(entry: AuditEntry): AuditView['actions'] {
    const actions: AuditView['actions'] = [];

    // View details action (always available)
    actions.push({
      id: 'view-details',
      label: 'View Details',
      type: 'view',
      primary: false,
      enabled: true,
    });

    // Approval actions for pending human review
    if (entry.eventType === 'human_approval_requested' && !entry.humanReview) {
      actions.push(
        {
          id: 'approve',
          label: '✓ Approve',
          type: 'approve',
          primary: true,
          enabled: true,
        },
        {
          id: 'reject',
          label: '✗ Reject',
          type: 'reject',
          primary: false,
          enabled: true,
        },
        {
          id: 'modify',
          label: '✎ Modify',
          type: 'modify',
          primary: false,
          enabled: true,
        }
      );
    }

    return actions;
  }

  /**
   * Generate a title for the audit view
   */
  private generateTitle(entry: AuditEntry): string {
    if (entry.eventType === 'tool_executed') {
      return `Tool: ${entry.details.toolName || 'Unknown'}`;
    }
    if (entry.eventType === 'human_approval_requested') {
      return '⏸️ Approval Required';
    }
    if (entry.eventType === 'security_alert') {
      return '🔒 Security Alert';
    }
    
    return entry.eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Estimate how long it takes to read and understand the view
   */
  private estimateReadTime(summary: AuditSummary, details: unknown): number {
    // Base reading time (200 words per minute = ~3.3 words per second)
    const wordsPerSecond = 3.3;
    
    // Count words in summary
    const summaryWords = summary.what.split(' ').length + 
                        summary.who.split(' ').length;
    
    // Add time for processing changes
    const detailComplexity = JSON.stringify(details).length / 100;
    
    return Math.ceil((summaryWords / wordsPerSecond) + (detailComplexity * 0.5));
  }

  /**
   * Assess the complexity of the audit entry
   */
  private assessComplexity(
    entry: AuditEntry, 
    details: unknown
  ): 'simple' | 'moderate' | 'complex' {
    const detailSize = JSON.stringify(details).length;
    
    if (entry.eventType === 'request_received') return 'simple';
    if (entry.eventType === 'security_alert') return 'complex';
    if (detailSize > 5000) return 'complex';
    if (detailSize > 1000) return 'moderate';
    
    return 'simple';
  }

  /**
   * Record human comprehension metrics
   */
  recordComprehension(
    entryId: string, 
    metrics: Partial<ComprehensionMetrics>
  ): void {
    const existing = this.comprehensionMetrics.get(entryId) || {
      timeToUnderstand: 0,
      accuracy: 0,
      userConfidence: 0,
      improvementSuggestions: [],
    };

    this.comprehensionMetrics.set(entryId, {
      ...existing,
      ...metrics,
    });
  }

  /**
   * Get comprehension metrics for analysis
   */
  getComprehensionMetrics(entryId: string): ComprehensionMetrics | undefined {
    return this.comprehensionMetrics.get(entryId);
  }

  /**
   * Check if comprehension target is being met
   */
  isComprehensionTargetMet(entryId: string): boolean {
    const metrics = this.comprehensionMetrics.get(entryId);
    if (!metrics) return false;
    
    return metrics.timeToUnderstand <= PERFORMANCE_TARGETS.auditInterfaceComprehensionSec;
  }

  /**
   * Generate batch view for multiple related entries
   */
  generateBatchView(entries: AuditEntry[]): AuditView {
    if (entries.length === 0) {
      throw new Error('Cannot generate batch view for empty entries');
    }

    if (entries.length === 1) {
      return this.generateView(entries[0]);
    }

    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];

    return {
      id: `batch-${firstEntry.traceId}`,
      title: `Batch: ${entries.length} events`,
      summary: {
        what: `${entries.length} related events in workflow`,
        who: firstEntry.actor,
        when: this.formatTime(firstEntry.timestamp),
        impact: this.getBatchImpact(entries),
        status: this.getBatchStatus(entries),
      },
      details: {
        changes: [],
        context: { entries: entries.map(e => e.id) },
        relatedEntries: entries.map(e => e.id),
      },
      actions: [
        {
          id: 'view-all',
          label: `View All ${entries.length} Events`,
          type: 'view',
          primary: true,
          enabled: true,
        },
      ],
      metadata: {
        createdAt: now(),
        comprehensionTargetSec: PERFORMANCE_TARGETS.auditInterfaceComprehensionSec,
        estimatedReadTimeSec: Math.min(entries.length * 2, 30),
        complexity: entries.length > 10 ? 'complex' : 'moderate',
      },
    };
  }

  private getBatchImpact(entries: AuditEntry[]): AuditSummary['impact'] {
    const impacts = entries.map(e => this.assessImpact(e));
    if (impacts.includes('critical')) return 'critical';
    if (impacts.includes('high')) return 'high';
    if (impacts.includes('medium')) return 'medium';
    return 'low';
  }

  private getBatchStatus(entries: AuditEntry[]): AuditSummary['status'] {
    const hasPending = entries.some(e => 
      e.eventType === 'human_approval_requested' && !e.humanReview
    );
    if (hasPending) return 'pending';
    
    const hasRejected = entries.some(e => e.humanReview?.decision === 'rejected');
    if (hasRejected) return 'rejected';
    
    return 'approved';
  }
}
