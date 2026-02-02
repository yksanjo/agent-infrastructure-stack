import type { Protocol, NormalizedIntent } from '@agent-infra/shared';
import { generateId, now } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from '../types';

// ACP (Agent Communication Protocol) types
interface ACPRequest {
  header: {
    message_id: string;
    sender_id: string;
    receiver_id: string;
    message_type: 'command' | 'query' | 'event' | 'response';
    timestamp: string;
    correlation_id?: string;
  };
  body: {
    action: string;
    payload: unknown;
    options?: Record<string, unknown>;
  };
}

export class ACPAdapter implements Adapter {
  readonly protocol: Protocol = 'acp';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parse(rawPayload: unknown): ParseResult {
    const startTime = now();
    
    try {
      const payload = rawPayload as ACPRequest;
      
      if (!payload.header) {
        return {
          success: false,
          error: {
            code: 'MISSING_HEADER',
            message: 'Missing header field',
          },
          metadata: {
            protocol: this.protocol,
            timestamp: startTime,
            rawSize: JSON.stringify(rawPayload).length,
          },
        };
      }

      if (!payload.body) {
        return {
          success: false,
          error: {
            code: 'MISSING_BODY',
            message: 'Missing body field',
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

    const payload = parsed.data as ACPRequest;
    const normalizeStart = now();

    const intent: NormalizedIntent = {
      id: generateId(),
      category: this.mapMessageTypeToCategory(payload.header.message_type),
      action: payload.body.action,
      target: payload.header.receiver_id,
      parameters: {
        payload: payload.body.payload,
        options: payload.body.options,
        sender: payload.header.sender_id,
        messageId: payload.header.message_id,
        correlationId: payload.header.correlation_id,
      },
      confidence: 0.95,
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

  private mapMessageTypeToCategory(messageType: string): NormalizedIntent['category'] {
    const typeMap: Record<string, NormalizedIntent['category']> = {
      'command': 'action_execution',
      'query': 'information_request',
      'event': 'conversation',
      'response': 'conversation',
    };

    return typeMap[messageType.toLowerCase()] || 'conversation';
  }
}
