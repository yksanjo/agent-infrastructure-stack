import type { Protocol, NormalizedIntent } from '@agent-infra/shared';
import { generateId, now } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from '../types';

// OpenAI API types
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?: string | { type: string; function?: { name: string } };
  temperature?: number;
  max_tokens?: number;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export class OpenAIAdapter implements Adapter {
  readonly protocol: Protocol = 'openai';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parse(rawPayload: unknown): ParseResult {
    const startTime = now();
    
    try {
      const payload = rawPayload as OpenAIRequest;
      
      if (!payload.model) {
        return {
          success: false,
          error: {
            code: 'MISSING_MODEL',
            message: 'Missing model field',
          },
          metadata: {
            protocol: this.protocol,
            timestamp: startTime,
            rawSize: JSON.stringify(rawPayload).length,
          },
        };
      }

      if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
        return {
          success: false,
          error: {
            code: 'MISSING_MESSAGES',
            message: 'Missing or invalid messages array',
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

    const payload = parsed.data as OpenAIRequest;
    const normalizeStart = now();

    // Extract the last user message as the primary intent
    const lastUserMessage = [...payload.messages]
      .reverse()
      .find(m => m.role === 'user');

    const hasToolCalls = payload.messages.some(m => 
      m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0
    );

    const intent: NormalizedIntent = {
      id: generateId(),
      category: hasToolCalls ? 'tool_call' : 'conversation',
      action: hasToolCalls ? 'execute_tools' : 'chat_completion',
      target: payload.model,
      parameters: {
        messages: payload.messages,
        tools: payload.tools,
        tool_choice: payload.tool_choice,
        temperature: payload.temperature,
        max_tokens: payload.max_tokens,
        lastUserMessage: lastUserMessage?.content,
      },
      confidence: 0.95,
      alternatives: this.generateAlternatives(payload),
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

  private generateAlternatives(payload: OpenAIRequest): NormalizedIntent['alternatives'] {
    const alternatives: NormalizedIntent['alternatives'] = [];

    if (payload.tools && payload.tools.length > 0) {
      alternatives.push({
        action: 'tool_selection',
        confidence: 0.7,
        reason: 'Multiple tools available, selection may be needed',
      });
    }

    if (payload.temperature && payload.temperature < 0.5) {
      alternatives.push({
        action: 'deterministic_response',
        confidence: 0.6,
        reason: 'Low temperature suggests deterministic output preferred',
      });
    }

    return alternatives;
  }
}
