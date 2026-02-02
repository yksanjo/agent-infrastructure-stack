import type { Protocol, AgentRequest } from '@agent-infra/shared';
import { generateId, now, PERFORMANCE_TARGETS } from '@agent-infra/shared';
import type { Adapter, AdapterConfig, ParseResult, NormalizeResult } from './types';
import { MCPAdapter } from './adapters/mcp';
import { A2AAdapter } from './adapters/a2a';
import { UCPAdapter } from './adapters/ucp';
import { ACPAdapter } from './adapters/acp';
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';

export class ProtocolAdapter {
  private adapters: Map<Protocol, Adapter> = new Map();
  private config: AdapterConfig;

  constructor(config: Partial<AdapterConfig> = {}) {
    this.config = {
      strictValidation: true,
      maxPayloadSize: 10 * 1024 * 1024, // 10MB
      timeoutMs: 5000,
      preserveUnknownFields: false,
      ...config,
    };

    this.registerAdapters();
  }

  private registerAdapters(): void {
    const adapters: Adapter[] = [
      new MCPAdapter(this.config),
      new A2AAdapter(this.config),
      new UCPAdapter(this.config),
      new ACPAdapter(this.config),
      new OpenAIAdapter(this.config),
      new AnthropicAdapter(this.config),
    ];

    for (const adapter of adapters) {
      this.adapters.set(adapter.protocol, adapter);
    }
  }

  async convert(
    rawPayload: unknown,
    sourceProtocol: Protocol,
    traceId?: string
  ): Promise<AgentRequest> {
    const startTime = now();
    const adapter = this.adapters.get(sourceProtocol);

    if (!adapter) {
      throw new Error(`Unsupported protocol: ${sourceProtocol}`);
    }

    // Parse the raw payload
    const parseResult = adapter.parse(rawPayload);
    
    if (!parseResult.success) {
      throw new Error(
        `Parse error: ${parseResult.error?.message || 'Unknown error'}`
      );
    }

    // Normalize to internal format
    const normalizeResult = adapter.normalize(parseResult);

    if (!normalizeResult.success) {
      throw new Error(
        `Normalize error: ${normalizeResult.error?.message || 'Unknown error'}`
      );
    }

    const totalOverhead = now() - startTime;

    // Check performance target
    if (totalOverhead > PERFORMANCE_TARGETS.protocolTranslationOverheadMs) {
      console.warn(
        `Protocol translation overhead (${totalOverhead}ms) exceeds target (${PERFORMANCE_TARGETS.protocolTranslationOverheadMs}ms)`
      );
    }

    return {
      id: generateId(),
      timestamp: now(),
      sourceProtocol,
      rawPayload,
      normalizedIntent: normalizeResult.intent!,
      context: {
        sessionId: generateId(),
        userId: 'anonymous', // To be populated by auth middleware
        conversationHistory: [],
        availableTools: [],
        constraints: [],
        preferences: [],
      },
      metadata: {
        priority: 1,
        maxLatencyMs: 30000,
        maxBudgetCents: 1000,
        requireHumanApproval: false,
        auditLevel: 'standard',
        traceId: traceId || generateId(),
      },
    };
  }

  detectProtocol(rawPayload: unknown): Protocol | null {
    // Try each adapter to see which can parse the payload
    for (const [protocol, adapter] of this.adapters) {
      const result = adapter.parse(rawPayload);
      if (result.success) {
        return protocol;
      }
    }
    return null;
  }

  getSupportedProtocols(): Protocol[] {
    return Array.from(this.adapters.keys());
  }

  getAdapter(protocol: Protocol): Adapter | undefined {
    return this.adapters.get(protocol);
  }
}
