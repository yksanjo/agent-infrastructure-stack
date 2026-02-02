import type { Protocol, NormalizedIntent } from '@agent-infra/shared';
import { generateId, now } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from '../types';

// A2A (Agent-to-Agent) Protocol types
interface A2ARequest {
  id: string;
  sender: A2AAgent;
  recipient: A2AAgent;
  task?: A2ATask;
  message?: A2AMessage;
  timestamp: string;
}

interface A2AAgent {
  id: string;
  name: string;
  capabilities?: string[];
}

interface A2ATask {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
}

interface A2AMessage {
  type: 'request' | 'response' | 'notification' | 'error';
  content: string;
  context?: Record<string, unknown>;
}

export class A2AAdapter implements Adapter {
  readonly protocol: Protocol = 'a2a';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parse(rawPayload: unknown): ParseResult {
    const startTime = now();
    
    try {
      const payload = rawPayload as A2ARequest;
      
      if (!payload.id) {
        return {
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Missing request ID',
          },
          metadata: {
            protocol: this.protocol,
            timestamp: startTime,
            rawSize: JSON.stringify(rawPayload).length,
          },
        };
      }

      if (!payload.sender || !payload.recipient) {
        return {
          success: false,
          error: {
            code: 'MISSING_AGENTS',
            message: 'Missing sender or recipient',
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

    const payload = parsed.data as A2ARequest;
    const normalizeStart = now();

    let intent: NormalizedIntent;

    if (payload.task) {
      intent = this.normalizeTask(payload);
    } else if (payload.message) {
      intent = this.normalizeMessage(payload);
    } else {
      intent = this.normalizeGeneric(payload);
    }

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

  private normalizeTask(payload: A2ARequest): NormalizedIntent {
    const task = payload.task!;
    
    return {
      id: generateId(),
      category: 'action_execution',
      action: task.type,
      target: payload.recipient.id,
      parameters: {
        taskId: task.id,
        parameters: task.parameters,
        priority: task.priority,
        deadline: task.deadline,
        sender: payload.sender,
      },
      confidence: 0.95,
      alternatives: [],
    };
  }

  private normalizeMessage(payload: A2ARequest): NormalizedIntent {
    const message = payload.message!;
    
    return {
      id: generateId(),
      category: message.type === 'request' ? 'information_request' : 'conversation',
      action: `a2a_${message.type}`,
      target: payload.recipient.id,
      parameters: {
        content: message.content,
        context: message.context,
        sender: payload.sender,
      },
      confidence: 0.9,
      alternatives: [],
    };
  }

  private normalizeGeneric(payload: A2ARequest): NormalizedIntent {
    return {
      id: generateId(),
      category: 'conversation',
      action: 'a2a_handshake',
      target: payload.recipient.id,
      parameters: {
        sender: payload.sender,
        originalId: payload.id,
      },
      confidence: 0.7,
      alternatives: [
        {
          action: 'a2a_discovery',
          confidence: 0.3,
          reason: 'May be agent capability discovery',
        },
      ],
    };
  }
}
