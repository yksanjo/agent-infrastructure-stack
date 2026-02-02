import type { AgentRequest, ToolDefinition, RoutingDecision } from '@agent-infra/shared';
import { generateId, now, PERFORMANCE_TARGETS, SEMANTIC_ROUTING, clamp } from '@agent-infra/shared';
import type { RouteRequest, RouteResult, RouterConfig, ToolMatch } from './types';
import { EmbeddingService } from './embeddings/service';

export class IntentRouter {
  private config: RouterConfig;
  private embeddingService: EmbeddingService;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = {
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: SEMANTIC_ROUTING.embeddingDimensions,
      similarityThreshold: SEMANTIC_ROUTING.similarityThreshold,
      minConfidence: SEMANTIC_ROUTING.minConfidence,
      maxAlternatives: SEMANTIC_ROUTING.maxAlternatives,
      cacheEmbeddings: true,
      cacheTtlMs: 300000,
      enableCostOptimization: true,
      enableLatencyOptimization: true,
      ...config,
    };

    this.embeddingService = new EmbeddingService({
      model: this.config.embeddingModel,
      dimensions: this.config.embeddingDimensions,
      cacheTtlMs: this.config.cacheTtlMs,
    });
  }

  async route(request: RouteRequest): Promise<RouteResult> {
    const startTime = now();
    const { request: agentRequest, availableTools, options = {} } = request;

    try {
      // Generate embedding for the intent
      const embeddingStart = now();
      const intentEmbedding = await this.embeddingService.embedIntent(
        agentRequest.normalizedIntent
      );
      const embeddingTime = now() - embeddingStart;

      // Match against available tools
      const matchingStart = now();
      const matches = await this.matchTools(
        intentEmbedding.embedding,
        availableTools
      );
      const matchingTime = now() - matchingStart;

      // Filter by confidence threshold
      const validMatches = matches.filter(
        m => m.confidence >= (options.minConfidence || this.config.minConfidence)
      );

      if (validMatches.length === 0) {
        const totalLatency = now() - startTime;
        
        return {
          success: false,
          error: {
            code: 'NO_MATCH',
            message: 'No tools matched the intent with sufficient confidence',
            suggestion: 'Try rephrasing the request or adding more tools',
          },
          performance: {
            embeddingTimeMs: embeddingTime,
            matchingTimeMs: matchingTime,
            totalLatencyMs: totalLatency,
          },
          alternatives: matches.slice(0, 3),
        };
      }

      // Sort by score and select best match
      validMatches.sort((a, b) => b.score - a.score);
      const bestMatch = validMatches[0];

      // Generate fallback options
      const fallbackTools = validMatches
        .slice(1, (options.maxAlternatives || this.config.maxAlternatives) + 1)
        .map(m => m.tool);

      const decision: RoutingDecision = {
        requestId: agentRequest.id,
        selectedTool: bestMatch.tool,
        confidence: bestMatch.confidence,
        reasoning: bestMatch.reasoning,
        fallbackTools,
        estimatedLatency: bestMatch.tool.latencyEstimate || 100,
        estimatedCost: bestMatch.tool.costEstimate?.min || 0,
        requiresApproval: bestMatch.confidence < 0.8,
        approvalReason: bestMatch.confidence < 0.8 
          ? `Low confidence (${(bestMatch.confidence * 100).toFixed(1)}%)` 
          : undefined,
      };

      const totalLatency = now() - startTime;

      // Check performance target
      if (totalLatency > PERFORMANCE_TARGETS.intentResolutionLatencyMs) {
        console.warn(
          `Intent resolution latency (${totalLatency}ms) exceeds target (${PERFORMANCE_TARGETS.intentResolutionLatencyMs}ms)`
        );
      }

      return {
        success: true,
        decision,
        performance: {
          embeddingTimeMs: embeddingTime,
          matchingTimeMs: matchingTime,
          totalLatencyMs: totalLatency,
        },
        alternatives: validMatches.slice(1),
      };
    } catch (error) {
      const totalLatency = now() - startTime;
      
      return {
        success: false,
        error: {
          code: 'ROUTING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown routing error',
        },
        performance: {
          embeddingTimeMs: 0,
          matchingTimeMs: 0,
          totalLatencyMs: totalLatency,
        },
        alternatives: [],
      };
    }
  }

  private async matchTools(
    intentEmbedding: number[],
    tools: ToolDefinition[]
  ): Promise<ToolMatch[]> {
    const matches: ToolMatch[] = [];

    for (const tool of tools) {
      // Generate embedding for tool description
      const toolEmbedding = await this.embeddingService.embedToolDescription(
        tool.name,
        tool.description
      );

      // Calculate similarity
      const similarity = this.embeddingService.calculateSimilarity(
        intentEmbedding,
        toolEmbedding.embedding
      );

      // Calculate confidence based on similarity and other factors
      const confidence = this.calculateConfidence(similarity, tool);

      // Only include if above threshold
      if (similarity >= this.config.similarityThreshold) {
        matches.push({
          tool,
          score: similarity,
          confidence,
          reasoning: this.generateReasoning(tool, similarity, confidence),
          embedding: toolEmbedding.embedding,
        });
      }
    }

    return matches;
  }

  private calculateConfidence(similarity: number, tool: ToolDefinition): number {
    let confidence = similarity;

    // Adjust for cost optimization
    if (this.config.enableCostOptimization && tool.costEstimate) {
      const costFactor = 1 / (1 + tool.costEstimate.min / 100);
      confidence = confidence * (0.9 + 0.1 * costFactor);
    }

    // Adjust for latency optimization
    if (this.config.enableLatencyOptimization && tool.latencyEstimate) {
      const latencyFactor = 1 / (1 + tool.latencyEstimate / 1000);
      confidence = confidence * (0.9 + 0.1 * latencyFactor);
    }

    return clamp(confidence, 0, 1);
  }

  private generateReasoning(
    tool: ToolDefinition, 
    similarity: number, 
    confidence: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Semantic similarity: ${(similarity * 100).toFixed(1)}%`);

    if (tool.costEstimate) {
      reasons.push(`Cost: $${(tool.costEstimate.min / 100).toFixed(2)}`);
    }

    if (tool.latencyEstimate) {
      reasons.push(`Latency: ~${tool.latencyEstimate}ms`);
    }

    if (confidence < similarity) {
      reasons.push('Adjusted for cost/latency optimization');
    }

    return reasons.join('; ');
  }

  getConfig(): RouterConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
