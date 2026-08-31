import { ChildProcess } from 'node:child_process';
import {
  StartupCancelledError,
  pollServerHealth,
  type HealthStartupAttempt,
} from './process-manager-health';
import { spawnServerProcess } from './process-manager-spawn';
import {
  classifySchemaReject,
  SchemaBaselineStartupError,
} from './process-manager-schema';
import {
  driveRestartLoop,
  showRepeatedCrashAndExit,
  stopChildProcess,
} from './process-manager-lifecycle';

export interface ProcessManagerOptions {
  command: string;            // "python"
  args: string[];             // ["-m", "server"]
  cwd: string;               // Path to project root (where server/ lives)
  env: Record<string, string>; // Environment variables (includes IM_FRONTEND_DIST)
  healthUrl: string;          // "http://127.0.0.1:18820/api/v1/health" (localhost ≡ loopback)
  healthTimeout: number;      // Max wait in ms (default: 30000)
  healthInterval: number;     // Poll interval in ms (default: 1000)
  killTimeout: number;        // Grace period before force kill in ms (default: 5000)
}

type StartupAttempt = HealthStartupAttempt & {
  generation: number;
};
export class ProcessManager {
  private options: ProcessManagerOptions;
  private process: ChildProcess | null = null;
  private running = false;
  private stopping = false;
  private generation = 0;
  private activeStartup: StartupAttempt | null = null;
  private startFlight: Promise<void> | null = null;
  private stopFlight: Promise<void> | null = null;
  private restartFlight: Promise<void> | null = null;
  private restartRequestedGeneration: number | null = null;
  private restartCount = 0;
  private maxRestarts = 3;
  private restartResetTimer: NodeJS.Timeout | null = null;
  private readonly restartStabilityMs = 60_000;
  private exitCallbacks: Array<(code: number | null) => void> = [];
  /** Recent stderr from the current spawn (for schema hard-reject detection). */
  private recentStderr = '';

  constructor(options: ProcessManagerOptions) {
    this.options = options;
  }

  private appendStderr(chunk: string): void {
    this.recentStderr = `${this.recentStderr}${chunk}`.slice(-8_192);
  }

  /** Spawn the server subprocess and wait for health check to pass. */
  start(): Promise<void> {
    // A start requested during shutdown is queued behind that single stop flight.
    if (this.stopFlight) {
      if (this.startFlight) return this.startFlight;
      const stopFlight = this.stopFlight;
      return this.trackStartFlight(
        stopFlight.then(async () => {
          // A restart that was already in flight may have been cancelled by
          // stop(). Await its cleanup, then verify actual process state rather
          // than treating the stale restart promise as a successful start.
          const restartFlight = this.restartFlight;
          if (restartFlight) await restartFlight;
          if (this.running && this.process) return;
          await this.runStartup();
        })
      );
    }

    if (this.startFlight) return this.startFlight;
    if (this.restartFlight) {
      // Do not return the auto-restart promise itself: driveRestartLoop
      // swallows StartupCancelledError and can resolve with no process.
      const restartFlight = this.restartFlight;
      const flight = (async () => {
        try {
          await restartFlight;
        } catch {
          // Restart failed; start a fresh sidecar below if needed.
        }
        // stop() nulls startFlight so a queued start owns the next spawn.
        if (this.startFlight !== flight) return;
        if (this.running && this.process) return;
        if (this.stopFlight || this.stopping) return;
        await this.runStartup();
      })();
      return this.trackStartFlight(flight);
    }
    if (this.running && this.process) return Promise.resolve();

    return this.trackStartFlight(this.runStartup());
  }

  /**
   * Gracefully stop the server (taskkill → wait → force kill).
   * Startup polling is cancelled before termination begins.
   */
  stop(): Promise<void> {
    if (this.stopFlight) return this.stopFlight;

    this.stopping = true;
    this.restartRequestedGeneration = null;
    this.clearRestartResetTimer();

    // Invalidate all callbacks owned by the current process before cancelling them.
    this.generation++;
    this.cancelActiveStartup();

    // Let a subsequent start queue behind this stop instead of joining the cancelled start.
    this.startFlight = null;
    const child = this.process;
    const flight = this.stopChild(child);
    this.stopFlight = flight;
    void flight.then(
      () => {
        if (this.stopFlight === flight) this.stopFlight = null;
      },
      () => {
        if (this.stopFlight === flight) this.stopFlight = null;
      }
    );
    return flight;
  }

  /** Whether the server process is currently running */
  isRunning(): boolean {
    return this.running;
  }

  /** Register a callback for unexpected process exit events */
  onUnexpectedExit(callback: (code: number | null) => void): void {
    this.exitCallbacks.push(callback);
  }

  /** Get the underlying child process (used internally and for testing) */
  getProcess(): ChildProcess | null {
    return this.process;
  }

  private trackStartFlight(flight: Promise<void>): Promise<void> {
    this.startFlight = flight;
    void flight.then(
      () => {
        if (this.startFlight === flight) this.startFlight = null;
      },
      () => {
        if (this.startFlight === flight) this.startFlight = null;
      }
    );
    return flight;
  }

  private async runStartup(): Promise<void> {
    const attempt: StartupAttempt = {
      generation: ++this.generation,
      child: null,
      cancelled: false,
      cancel: null,
      rejectReason: null,
    };
    this.activeStartup = attempt;

    try {
      await this.spawnProcess(attempt);
      this.assertCurrent(attempt);
      await this.pollHealth(attempt);
      this.assertCurrent(attempt);
      this.scheduleRestartReset(attempt.generation);
    } finally {
      if (this.activeStartup === attempt) {
        attempt.cancel = null;
        this.activeStartup = null;
      }
    }
  }

  private pollHealth(attempt: StartupAttempt): Promise<void> {
    return pollServerHealth({
      healthUrl: this.options.healthUrl,
      healthInterval: this.options.healthInterval,
      healthTimeout: this.options.healthTimeout,
      attempt,
      isCurrent: (a) => this.isCurrent(a as StartupAttempt),
      recentStderr: () => this.recentStderr,
      getManagedProcess: () => this.process,
    });
  }

  private spawnProcess(attempt: StartupAttempt): Promise<void> {
    return spawnServerProcess({
      command: this.options.command,
      args: this.options.args,
      cwd: this.options.cwd,
      env: this.options.env,
      attempt,
      isCurrent: (a) => this.isCurrent(a as StartupAttempt),
      getProcess: () => this.process,
      setProcess: (child) => {
        this.process = child;
      },
      setRunning: (running) => {
        this.running = running;
      },
      clearStderr: () => {
        this.recentStderr = '';
      },
      appendStderr: (chunk) => this.appendStderr(chunk),
      onManagedExit: (child, code, signal) => {
        if (attempt.generation !== this.generation || this.process !== child) return;

        console.log(`[server] Process exited with code ${code}, signal ${signal}`);
        this.running = false;
        this.process = null;
        this.clearRestartResetTimer();

        const stderr = this.recentStderr.trim().slice(-2_000);
        const schemaKind = classifySchemaReject(stderr);
        if (this.activeStartup === attempt) {
          this.failActiveStartup(
            schemaKind
              ? new SchemaBaselineStartupError(schemaKind, stderr, code)
              : new Error(
                  stderr
                    ? `Server process exited during startup (code ${code}).\n\n${stderr}`
                    : `Server process exited during startup (code ${code})`,
                ),
          );
        }
        // Invalidate timeout/request callbacks after failActiveStartup so a
        // concurrent health poll rejects with the schema error, not "cancelled".
        this.generation++;
        if (schemaKind) return;
        if (this.stopping) return;

        for (const callback of this.exitCallbacks) callback(code);
        this.requestRestart(this.generation);
      },
    });
  }

  private requestRestart(generation: number): void {
    this.restartRequestedGeneration = generation;
    if (this.restartFlight) return;

    const flight = this.driveRestarts();
    this.restartFlight = flight;
    void flight.then(
      () => {
        if (this.restartFlight === flight) this.restartFlight = null;
      },
      () => {
        if (this.restartFlight === flight) this.restartFlight = null;
      }
    );
  }

  private driveRestarts(): Promise<void> {
    return driveRestartLoop({
      getRestartRequestedGeneration: () => this.restartRequestedGeneration,
      clearRestartRequestedGeneration: () => {
        this.restartRequestedGeneration = null;
      },
      getStopping: () => this.stopping,
      getGeneration: () => this.generation,
      getRestartCount: () => this.restartCount,
      getMaxRestarts: () => this.maxRestarts,
      incrementRestartCount: () => ++this.restartCount,
      getStartFlight: () => this.startFlight,
      runStartup: () => this.runStartup(),
      onRepeatedCrash: () => showRepeatedCrashAndExit(),
    });
  }

  private stopChild(child: ChildProcess | null): Promise<void> {
    return stopChildProcess({
      child,
      killTimeout: this.options.killTimeout,
      getProcess: () => this.process,
      setProcess: (next) => {
        this.process = next;
      },
      setRunning: (running) => {
        this.running = running;
      },
      setStopping: (stopping) => {
        this.stopping = stopping;
      },
    });
  }

  private isCurrent(attempt: StartupAttempt): boolean {
    return !attempt.cancelled && attempt.generation === this.generation;
  }

  private assertCurrent(attempt: StartupAttempt): void {
    if (!this.isCurrent(attempt)) {
      throw attempt.rejectReason ?? new StartupCancelledError();
    }
  }

  private cancelActiveStartup(): void {
    const attempt = this.activeStartup;
    if (!attempt || attempt.cancelled) return;
    attempt.cancelled = true;
    const cancel = attempt.cancel;
    attempt.cancel = null;
    cancel?.();
  }

  private failActiveStartup(error: Error): void {
    const attempt = this.activeStartup;
    if (!attempt || attempt.cancelled) return;
    attempt.rejectReason = error;
    attempt.cancelled = true;
    const cancel = attempt.cancel;
    attempt.cancel = null;
    cancel?.();
  }

  private clearRestartResetTimer(): void {
    if (this.restartResetTimer) {
      clearTimeout(this.restartResetTimer);
      this.restartResetTimer = null;
    }
  }

  private scheduleRestartReset(generation: number): void {
    this.clearRestartResetTimer();
    this.restartResetTimer = setTimeout(() => {
      if (this.generation === generation) this.restartCount = 0;
      this.restartResetTimer = null;
    }, this.restartStabilityMs);
  }
}
