import type { AgentRequest, NormalizedIntent } from '@agent-infra/shared';
import { SEMANTIC_ROUTING, cosineSimilarity } from '@agent-infra/shared';
import type { IntentEmbedding, EmbeddingCache } from '../types';

// Simple in-memory cache
class InMemoryEmbeddingCache implements EmbeddingCache {
  private cache = new Map<string, number[]>();
  private timestamps = new Map<string, number>();
  private ttlMs: number;

  constructor(ttlMs: number = 300000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): number[] | undefined {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return undefined;
    
    if (Date.now() - timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return undefined;
    }
    
    return this.cache.get(key);
  }

  set(key: string, embedding: number[]): void {
    this.cache.set(key, embedding);
    this.timestamps.set(key, Date.now());
  }

  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }
}

export class EmbeddingService {
  private cache: EmbeddingCache;
  private model: string;
  private dimensions: number;

  constructor(options: {
    model?: string;
    dimensions?: number;
    cache?: EmbeddingCache;
    cacheTtlMs?: number;
  } = {}) {
    this.model = options.model || 'text-embedding-3-small';
    this.dimensions = options.dimensions || SEMANTIC_ROUTING.embeddingDimensions;
    this.cache = options.cache || new InMemoryEmbeddingCache(options.cacheTtlMs);
  }

  async embedIntent(intent: NormalizedIntent): Promise<IntentEmbedding> {
    const cacheKey = this.generateCacheKey(intent);
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        intent: intent.action,
        embedding: cached,
        dimensions: this.dimensions,
        model: this.model,
      };
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(intent);
    
    // Cache result
    this.cache.set(cacheKey, embedding);

    return {
      intent: intent.action,
      embedding,
      dimensions: this.dimensions,
      model: this.model,
    };
  }

  async embedToolDescription(
    toolName: string, 
    description: string
  ): Promise<IntentEmbedding> {
    const cacheKey = `tool:${toolName}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        intent: toolName,
        embedding: cached,
        dimensions: this.dimensions,
        model: this.model,
      };
    }

    const text = `${toolName}: ${description}`;
    const embedding = await this.callEmbeddingAPI(text);
    
    this.cache.set(cacheKey, embedding);

    return {
      intent: toolName,
      embedding,
      dimensions: this.dimensions,
      model: this.model,
    };
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    return cosineSimilarity(embedding1, embedding2);
  }

  private generateCacheKey(intent: NormalizedIntent): string {
    return `intent:${intent.category}:${intent.action}:${JSON.stringify(intent.parameters)}`;
  }

  private async generateEmbedding(intent: NormalizedIntent): Promise<number[]> {
    // Create a rich text representation of the intent
    const text = this.intentToText(intent);
    return this.callEmbeddingAPI(text);
  }

  private intentToText(intent: NormalizedIntent): string {
    const parts: string[] = [
      `Action: ${intent.action}`,
      `Category: ${intent.category}`,
      `Target: ${intent.target}`,
    ];

    // Add parameter descriptions
    if (intent.parameters && Object.keys(intent.parameters).length > 0) {
      parts.push(`Parameters: ${JSON.stringify(intent.parameters)}`);
    }

    return parts.join('\n');
  }

  private async callEmbeddingAPI(text: string): Promise<number[]> {
    // In production, this would call an actual embedding API (OpenAI, Cohere, etc.)
    // For now, we'll generate a deterministic mock embedding based on the text
    
    // Hash the text to create a seed
    const seed = this.hashString(text);
    
    // Generate deterministic pseudo-random embedding
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      // Use a simple PRNG based on the seed
      const value = Math.sin(seed + i * 12.9898) * 43758.5453;
      embedding.push(value - Math.floor(value));
    }

    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
