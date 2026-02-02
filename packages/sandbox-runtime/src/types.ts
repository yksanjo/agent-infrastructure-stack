import type { SandboxConfig } from '@agent-infra/shared';

export interface Sandbox {
  id: string;
  config: SandboxConfig;
  status: 'creating' | 'ready' | 'running' | 'destroyed';
  createdAt: number;
  lastUsedAt: number;
  executionCount: number;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: ExecutionError;
  metrics: ExecutionMetrics;
}

export interface ExecutionError {
  code: string;
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface ExecutionMetrics {
  coldStartMs: number;
  executionMs: number;
  totalMs: number;
  memoryPeakMb: number;
  cpuPercent: number;
}

export interface SandboxMetrics {
  totalSandboxes: number;
  activeSandboxes: number;
  averageColdStartMs: number;
  poolHitRate: number;
  resourceUtilization: number;
}

export interface SandboxPoolConfig {
  minInstances: number;
  maxInstances: number;
  idleTimeoutMs: number;
  warmupIntervalMs: number;
}
