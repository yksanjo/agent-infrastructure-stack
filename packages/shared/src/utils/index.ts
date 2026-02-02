import { PERFORMANCE_TARGETS } from '../constants';
import type { PerformanceMetrics } from '../types';

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateTraceId(): string {
  return `trace-${generateId()}`;
}

export function now(): number {
  return Date.now();
}

export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export function checkPerformanceTarget(
  metric: keyof PerformanceMetrics,
  value: number
): { met: boolean; target: number; delta: number } {
  const target = PERFORMANCE_TARGETS[metric];
  const delta = value - target;
  
  // For accuracy, higher is better
  if (metric === 'semanticRoutingAccuracy') {
    return {
      met: value >= target,
      target,
      delta: target - value,
    };
  }
  
  // For latency/time metrics, lower is better
  return {
    met: value <= target,
    target,
    delta,
  };
}

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function calculateStats(values: number[]) {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isValidProtocol(protocol: string): boolean {
  return ['mcp', 'a2a', 'ucp', 'acp', 'openai', 'anthropic'].includes(protocol);
}

export function maskSensitiveData(data: string, visibleChars = 4): string {
  if (data.length <= visibleChars * 2) return '*'.repeat(data.length);
  return data.slice(0, visibleChars) + '*'.repeat(data.length - visibleChars * 2) + data.slice(-visibleChars);
}
