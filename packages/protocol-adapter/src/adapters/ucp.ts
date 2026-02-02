import type { Protocol, NormalizedIntent } from '@agent-infra/shared';
import { generateId, now } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from '../types';

// UCP (Universal Context Protocol) types
interface UCPRequest {
  context_id: string;
  operation: string;
  data: unknown;
  metadata?: {
    source?: string;
    timestamp?: string;
    version?: string;
  };
}

export class UCPAdapter implements Adapter {
  readonly protocol: Protocol = 'ucp';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parse(rawPayload: unknown): ParseResult {
    const startTime = now();
    
    try {
      const payload = rawPayload as UCPRequest;
      
      if (!payload.context_id) {
        return {
          success: false,
          error: {
            code: 'MISSING_CONTEXT_ID',
            message: 'Missing context_id field',
          },
          metadata: {
            protocol: this.protocol,
            timestamp: startTime,
            rawSize: JSON.stringify(rawPayload).length,
          },
        };
      }

      if (!payload.operation) {
        return {
          success: false,
          error: {
            code: 'MISSING_OPERATION',
            message: 'Missing operation field',
          },
          metadata: {
            protocol: this.protocol,
            timestamp: startTime,
            rawSize: JSON.stringify(rawPayload).length,
          },
        };
      }

      return {
        success: true,
        data: payload,
        metadata: {
          protocol: this.protocol,
          timestamp: startTime,
          rawSize: JSON.stringify(rawPayload).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown parse error',
        },
        metadata: {
          protocol: this.protocol,
          timestamp: startTime,
          rawSize: JSON.stringify(rawPayload).length,
        },
      };
    }
  }

  normalize(parsed: ParseResult): NormalizeResult {
    const startTime = now();
    const parsingTime = startTime - parsed.metadata.timestamp;

    if (!parsed.success || !parsed.data) {
      return {
        success: false,
        error: {
          code: 'NORMALIZE_ERROR',
          message: 'Cannot normalize failed parse',
        },
        performance: {
          parsingTimeMs: parsingTime,
          normalizationTimeMs: 0,
          totalOverheadMs: parsingTime,
        },
      };
    }

    const payload = parsed.data as UCPRequest;
    const normalizeStart = now();

    const intent: NormalizedIntent = {
      id: generateId(),
      category: this.mapOperationToCategory(payload.operation),
      action: payload.operation,
      target: payload.context_id,
      parameters: {
        data: payload.data,
        metadata: payload.metadata,
      },
      confidence: 0.9,
      alternatives: [],
    };

    const normalizationTime = now() - normalizeStart;

    return {
      success: true,
      intent,
      performance: {
        parsingTimeMs: parsingTime,
        normalizationTimeMs: normalizationTime,
        totalOverheadMs: parsingTime + normalizationTime,
      },
    };
  }

  private mapOperationToCategory(operation: string): NormalizedIntent['category'] {
    const operationMap: Record<string, NormalizedIntent['category']> = {
      'read': 'data_retrieval',
      'write': 'action_execution',
      'update': 'action_execution',
      'delete': 'action_execution',
      'query': 'information_request',
      'search': 'information_request',
      'analyze': 'analysis',
      'generate': 'code_generation',
    };

    return operationMap[operation.toLowerCase()] || 'conversation';
  }
}
