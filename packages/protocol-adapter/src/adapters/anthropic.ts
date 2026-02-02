import type { Protocol, NormalizedIntent } from '@agent-infra/shared';
import { generateId, now } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from '../types';

// Anthropic API types
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  tools?: AnthropicTool[];
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
  temperature?: number;
  system?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class AnthropicAdapter implements Adapter {
  readonly protocol: Protocol = 'anthropic';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parse(rawPayload: unknown): ParseResult {
    const startTime = now();
    
    try {
      const payload = rawPayload as AnthropicRequest;
      
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

      if (!payload.max_tokens) {
        return {
          success: false,
          error: {
            code: 'MISSING_MAX_TOKENS',
            message: 'Missing max_tokens field',
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

    const payload = parsed.data as AnthropicRequest;
    const normalizeStart = now();

    // Check for tool use in messages
    const hasToolUse = payload.messages.some(m => {
      if (typeof m.content === 'string') return false;
      return m.content.some(c => c.type === 'tool_use');
    });

    const lastUserMessage = [...payload.messages]
      .reverse()
      .find(m => m.role === 'user');

    const userContent = typeof lastUserMessage?.content === 'string' 
      ? lastUserMessage.content 
      : lastUserMessage?.content.find(c => c.type === 'text')?.text || '';

    const intent: NormalizedIntent = {
      id: generateId(),
      category: hasToolUse ? 'tool_call' : 'conversation',
      action: hasToolUse ? 'execute_tools' : 'chat_completion',
      target: payload.model,
      parameters: {
        messages: payload.messages,
        tools: payload.tools,
        tool_choice: payload.tool_choice,
        temperature: payload.temperature,
        max_tokens: payload.max_tokens,
        system: payload.system,
        lastUserMessage: userContent,
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

  private generateAlternatives(payload: AnthropicRequest): NormalizedIntent['alternatives'] {
    const alternatives: NormalizedIntent['alternatives'] = [];

    if (payload.tools && payload.tools.length > 0) {
      alternatives.push({
        action: 'tool_selection',
        confidence: 0.7,
        reason: 'Multiple tools available for task execution',
      });
    }

    if (payload.system) {
      alternatives.push({
        action: 'system_instruction',
        confidence: 0.5,
        reason: 'System prompt may guide behavior',
      });
    }

    return alternatives;
  }
}
