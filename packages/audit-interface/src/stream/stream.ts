import type { AuditEntry } from '@agent-infra/shared';
import type { AuditStreamConfig, AuditFilter } from '../types';

export class AuditStream {
  private buffer: AuditEntry[] = [];
  private config: AuditStreamConfig;
  private flushTimer?: NodeJS.Timeout;
  private handlers: Set<(entries: AuditEntry[]) => void> = new Set();

  constructor(config: Partial<AuditStreamConfig> = {}) {
    this.config = {
      bufferSize: 100,
      flushIntervalMs: 5000,
      retentionDays: 30,
      compressionEnabled: true,
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Write an entry to the audit stream
   */
  write(entry: AuditEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  /**
   * Write multiple entries
   */
  writeBatch(entries: AuditEntry[]): void {
    this.buffer.push(...entries);

    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  /**
   * Subscribe to audit events
   */
  subscribe(handler: (entries: AuditEntry[]) => void): () => void {
    this.handlers.add(handler);
    
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Query audit entries
   */
  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    // In production, this would query the database
    // For now, return from buffer
    return this.buffer.filter(entry => this.matchesFilter(entry, filter));
  }

  /**
   * Flush buffered entries
   */
  private flush(): void {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Notify handlers
    for (const handler of this.handlers) {
      try {
        handler(entries);
      } catch (error) {
        console.error('Audit handler error:', error);
      }
    }

    // In production, persist to storage
    this.persist(entries);
  }

  /**
   * Persist entries to storage
   */
  private async persist(entries: AuditEntry[]): Promise<void> {
    // In production, write to:
    // - Database (PostgreSQL/MongoDB)
    // - Log aggregation (ELK, Datadog)
    // - Object storage (S3) for archives
    
    console.log(`Persisting ${entries.length} audit entries`);
  }

  /**
   * Check if entry matches filter
   */
  private matchesFilter(entry: AuditEntry, filter: AuditFilter): boolean {
    if (filter.startTime && entry.timestamp < filter.startTime) return false;
    if (filter.endTime && entry.timestamp > filter.endTime) return false;
    if (filter.eventTypes && !filter.eventTypes.includes(entry.eventType)) return false;
    if (filter.severity && !filter.severity.includes(entry.severity)) return false;
    if (filter.actor && entry.actor !== filter.actor) return false;
    if (filter.traceId && entry.traceId !== filter.traceId) return false;
    
    return true;
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop the stream
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}
