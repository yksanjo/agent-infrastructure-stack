import type { Protocol, NormalizedIntent } from '@agent-infra/shared';
import { generateId, now } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from '../types';

// MCP (Model Context Protocol) types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export class MCPAdapter implements Adapter {
  readonly protocol: Protocol = 'mcp';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parse(rawPayload: unknown): ParseResult {
    const startTime = now();
    
    try {
      // Check if it's a valid JSON-RPC 2.0 request
      const payload = rawPayload as MCPRequest;
      
      if (payload.jsonrpc !== '2.0') {
        return {
          success: false,
          error: {
            code: 'INVALID_JSONRPC',
            message: 'Missing or invalid jsonrpc version',
            suggestion: 'Ensure payload follows JSON-RPC 2.0 spec',
          },
          metadata: {
            protocol: this.protocol,
            timestamp: startTime,
            rawSize: JSON.stringify(rawPayload).length,
          },
        };
      }

      if (!payload.method) {
        return {
          success: false,
          error: {
            code: 'MISSING_METHOD',
            message: 'Missing method field',
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

    const payload = parsed.data as MCPRequest;
    const normalizeStart = now();

    // Map MCP methods to intent categories
    let intent: NormalizedIntent;

    switch (payload.method) {
      case 'tools/call':
        intent = this.normalizeToolCall(payload);
        break;
      case 'resources/read':
        intent = this.normalizeResourceRead(payload);
        break;
      case 'prompts/get':
        intent = this.normalizePromptGet(payload);
        break;
      default:
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

  private normalizeToolCall(payload: MCPRequest): NormalizedIntent {
    const params = payload.params as { name?: string; arguments?: Record<string, unknown> } || {};
    const toolCall = params as MCPToolCall;

    return {
      id: generateId(),
      category: 'tool_call',
      action: toolCall.name || 'unknown_tool',
      target: 'tool',
      parameters: toolCall.arguments || {},
      confidence: 1.0,
      alternatives: [],
    };
  }

  private normalizeResourceRead(payload: MCPRequest): NormalizedIntent {
    const params = payload.params as { uri?: string } || {};

    return {
      id: generateId(),
      category: 'data_retrieval',
      action: 'read_resource',
      target: params.uri || 'unknown',
      parameters: params,
      confidence: 1.0,
      alternatives: [],
    };
  }

  private normalizePromptGet(payload: MCPRequest): NormalizedIntent {
    const params = payload.params as { name?: string; arguments?: Record<string, unknown> } || {};

    return {
      id: generateId(),
      category: 'information_request',
      action: 'get_prompt',
      target: params.name || 'unknown',
      parameters: params.arguments || {},
      confidence: 1.0,
      alternatives: [],
    };
  }

  private normalizeGeneric(payload: MCPRequest): NormalizedIntent {
    return {
      id: generateId(),
      category: 'conversation',
      action: payload.method,
      target: 'system',
      parameters: payload.params || {},
      confidence: 0.8,
      alternatives: [
        {
          action: 'help',
          confidence: 0.2,
          reason: 'Unknown method, may need assistance',
        },
      ],
    };
  }
}
