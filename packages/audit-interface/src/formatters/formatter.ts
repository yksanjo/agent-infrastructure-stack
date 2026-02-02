import type { AuditEntry } from '@agent-infra/shared';
import type { AuditDetails, Change } from '../types';

export class AuditFormatter {
  /**
   * Format audit entry details for human consumption
   */
  formatDetails(entry: AuditEntry, context: AuditEntry[]): AuditDetails {
    return {
      before: entry.beforeState,
      after: entry.afterState,
      changes: this.detectChanges(entry.beforeState, entry.afterState),
      context: this.buildContext(entry, context),
      relatedEntries: this.findRelatedEntries(entry, context),
    };
  }

  /**
   * Detect changes between before and after states
   */
  private detectChanges(before: unknown, after: unknown): Change[] {
    const changes: Change[] = [];

    if (!before || !after) {
      return changes;
    }

    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;

    // Find modified and added fields
    for (const key of Object.keys(afterObj)) {
      if (!(key in beforeObj)) {
        changes.push({
          field: key,
          oldValue: undefined,
          newValue: afterObj[key],
          type: 'added',
        });
      } else if (JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key])) {
        changes.push({
          field: key,
          oldValue: beforeObj[key],
          newValue: afterObj[key],
          type: 'modified',
        });
      }
    }

    // Find removed fields
    for (const key of Object.keys(beforeObj)) {
      if (!(key in afterObj)) {
        changes.push({
          field: key,
          oldValue: beforeObj[key],
          newValue: undefined,
          type: 'removed',
        });
      }
    }

    return changes;
  }

  /**
   * Build context for the audit entry
   */
  private buildContext(
    entry: AuditEntry,
    context: AuditEntry[]
  ): Record<string, unknown> {
    return {
      traceId: entry.traceId,
      requestId: entry.requestId,
      eventType: entry.eventType,
      severity: entry.severity,
      timestamp: entry.timestamp,
      actor: entry.actor,
      relatedEvents: context.length,
      hasHumanReview: !!entry.humanReview,
    };
  }

  /**
   * Find related audit entries
   */
  private findRelatedEntries(entry: AuditEntry, context: AuditEntry[]): string[] {
    return context
      .filter(e => 
        e.id !== entry.id && 
        (e.traceId === entry.traceId || e.requestId === entry.requestId)
      )
      .map(e => e.id);
  }

  /**
   * Format a value for display
   */
  formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date) return value.toISOString();
    
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  /**
   * Format a diff for display
   */
  formatDiff(change: Change): string {
    switch (change.type) {
      case 'added':
        return `+ ${change.field}: ${this.formatValue(change.newValue)}`;
      case 'removed':
        return `- ${change.field}: ${this.formatValue(change.oldValue)}`;
      case 'modified':
        return `~ ${change.field}: ${this.formatValue(change.oldValue)} → ${this.formatValue(change.newValue)}`;
      default:
        return `${change.field}: ${this.formatValue(change.newValue)}`;
    }
  }
}
