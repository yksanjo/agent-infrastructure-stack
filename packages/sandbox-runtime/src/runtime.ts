import type { SandboxConfig, ToolDefinition } from '@agent-infra/shared';
import { generateId, now, sleep, PERFORMANCE_TARGETS } from '@agent-infra/shared';
import type { Sandbox, ExecutionResult, SandboxMetrics, SandboxPoolConfig } from './types';

export class SandboxRuntime {
  private sandboxes: Map<string, Sandbox> = new Map();
  private pool: Sandbox[] = [];
  private config: SandboxPoolConfig;
  private metrics: SandboxMetrics = {
    totalSandboxes: 0,
    activeSandboxes: 0,
    averageColdStartMs: 0,
    poolHitRate: 0,
    resourceUtilization: 0,
  };

  constructor(config: Partial<SandboxPoolConfig> = {}) {
    this.config = {
      minInstances: 2,
      maxInstances: 100,
      idleTimeoutMs: 300000, // 5 minutes
      warmupIntervalMs: 60000, // 1 minute
      ...config,
    };

    this.startMaintenanceLoop();
  }

  /**
   * Execute a tool in a sandbox with <500ms cold start target
   */
  async execute(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = now();
    let sandbox: Sandbox | undefined;

    try {
      // Try to get a sandbox from the pool (hot start)
      sandbox = this.getFromPool();
      
      let coldStartMs = 0;
      
      if (!sandbox) {
        // Cold start - create new sandbox
        const coldStartBegin = now();
        sandbox = await this.createSandbox({
          id: generateId(),
          image: `tool-${tool.id}`,
          resources: {
            cpu: '0.5',
            memory: '256Mi',
            disk: '1Gi',
            network: true,
          },
          networkPolicy: {
            egress: true,
            allowedHosts: ['*'],
            allowedPorts: [80, 443],
          },
          allowedTools: [tool.id],
          timeoutMs,
          envVars: {},
        });
        coldStartMs = now() - coldStartBegin;

        // Check cold start target
        if (coldStartMs > PERFORMANCE_TARGETS.sandboxColdStartMs) {
          console.warn(
            `Sandbox cold start (${coldStartMs}ms) exceeds target (${PERFORMANCE_TARGETS.sandboxColdStartMs}ms)`
          );
        }
      } else {
        // Pool hit - update metrics
        this.metrics.poolHitRate = this.calculatePoolHitRate(true);
      }

      // Execute the tool
      const execStart = now();
      const result = await this.runInSandbox(sandbox, tool, args, timeoutMs);
      const executionMs = now() - execStart;

      // Update sandbox usage
      sandbox.lastUsedAt = now();
      sandbox.executionCount++;

      // Return to pool if healthy
      this.returnToPool(sandbox);

      return {
        ...result,
        metrics: {
          coldStartMs,
          executionMs,
          totalMs: now() - startTime,
          memoryPeakMb: 128, // Mock value
          cpuPercent: 25, // Mock value
        },
      };
    } catch (error) {
      // Cleanup on error
      if (sandbox) {
        await this.destroySandbox(sandbox);
      }

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: {
          coldStartMs: now() - startTime,
          executionMs: 0,
          totalMs: now() - startTime,
          memoryPeakMb: 0,
          cpuPercent: 0,
        },
      };
    }
  }

  /**
   * Get a sandbox from the pool
   */
  private getFromPool(): Sandbox | undefined {
    // Get the least recently used sandbox
    const available = this.pool
      .filter(s => s.status === 'ready')
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    if (available.length > 0) {
      const sandbox = available[0];
      this.pool = this.pool.filter(s => s.id !== sandbox.id);
      sandbox.status = 'running';
      return sandbox;
    }

    return undefined;
  }

  /**
   * Return a sandbox to the pool
   */
  private returnToPool(sandbox: Sandbox): void {
    if (this.pool.length >= this.config.maxInstances) {
      // Pool full, destroy oldest
      const oldest = this.pool.shift();
      if (oldest) {
        this.destroySandbox(oldest);
      }
    }

    sandbox.status = 'ready';
    this.pool.push(sandbox);
  }

  /**
   * Create a new sandbox
   */
  private async createSandbox(config: SandboxConfig): Promise<Sandbox> {
    const startTime = now();

    // In production, this would:
    // 1. Spin up a container (Docker, Firecracker, etc.)
    // 2. Initialize the runtime environment
    // 3. Load required dependencies
    
    // Simulate sandbox creation
    await sleep(100); // Mock cold start time

    const sandbox: Sandbox = {
      id: config.id,
      config,
      status: 'ready',
      createdAt: startTime,
      lastUsedAt: startTime,
      executionCount: 0,
    };

    this.sandboxes.set(sandbox.id, sandbox);
    this.metrics.totalSandboxes++;
    this.metrics.activeSandboxes++;

    return sandbox;
  }

  /**
   * Run tool execution in sandbox
   */
  private async runInSandbox(
    sandbox: Sandbox,
    tool: ToolDefinition,
    args: Record<string, unknown>,
    timeoutMs: number
  ): Promise<Omit<ExecutionResult, 'metrics'>> {
    // In production, this would:
    // 1. Invoke the tool in the sandboxed environment
    // 2. Capture stdout/stderr
    // 3. Enforce resource limits
    // 4. Handle timeouts

    // Mock execution
    await sleep(50);

    return {
      success: true,
      output: {
        tool: tool.name,
        args,
        result: 'success',
        timestamp: now(),
      },
    };
  }

  /**
   * Destroy a sandbox
   */
  private async destroySandbox(sandbox: Sandbox): Promise<void> {
    sandbox.status = 'destroyed';
    this.sandboxes.delete(sandbox.id);
    this.metrics.activeSandboxes--;
  }

  /**
   * Calculate pool hit rate
   */
  private calculatePoolHitRate(hit: boolean): number {
    // Simple moving average
    const current = this.metrics.poolHitRate;
    return current * 0.9 + (hit ? 1 : 0) * 0.1;
  }

  /**
   * Start maintenance loop for pool management
   */
  private startMaintenanceLoop(): void {
    setInterval(() => {
      this.maintainPool();
    }, this.config.warmupIntervalMs);
  }

  /**
   * Maintain pool size and cleanup idle sandboxes
   */
  private maintainPool(): void {
    const nowTime = now();

    // Remove idle sandboxes
    this.pool = this.pool.filter(sandbox => {
      const idleTime = nowTime - sandbox.lastUsedAt;
      if (idleTime > this.config.idleTimeoutMs) {
        this.destroySandbox(sandbox);
        return false;
      }
      return true;
    });

    // Warm up minimum instances
    const needed = this.config.minInstances - this.pool.length;
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        // Pre-warm generic sandbox
        this.createSandbox({
          id: generateId(),
          image: 'generic-runtime',
          resources: {
            cpu: '0.1',
            memory: '64Mi',
            disk: '100Mi',
            network: false,
          },
          networkPolicy: {
            egress: false,
            allowedHosts: [],
            allowedPorts: [],
          },
          allowedTools: [],
          timeoutMs: 30000,
          envVars: {},
        }).then(sandbox => {
          this.returnToPool(sandbox);
        });
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): SandboxMetrics {
    return { ...this.metrics };
  }
}
