import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// --- Mock Setup ---

// Mock electron
vi.mock('electron', () => ({
  app: { exit: vi.fn() },
  dialog: { showErrorBox: vi.fn() },
}));

// We'll store references to mock functions for child_process
const mockExec = vi.fn();
let spawnHandler: ((cmd: string, args: string[], opts: any) => any) | null = null;

vi.mock('node:child_process', () => ({
  spawn: vi.fn((...args: any[]) => {
    if (spawnHandler) return spawnHandler(args[0], args[1], args[2]);
    return createMockChild();
  }),
  exec: (...args: any[]) => mockExec(...args),
}));

// Mock http module
let httpGetHandler: ((url: string, cb: (res: any) => void) => any) | null = null;

vi.mock('node:http', () => ({
  default: {
    get: vi.fn((url: string, cb: (res: any) => void) => {
      if (httpGetHandler) return httpGetHandler(url, cb);
      const req = new EventEmitter();
      return req;
    }),
  },
}));

import { ProcessManager, ProcessManagerOptions } from '../process-manager';
import { app, dialog } from 'electron';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { setShellLocale, resetShellLocaleForTests } from '../shell-i18n';
import { SchemaBaselineStartupError } from '../process-manager-schema';

// --- Helpers ---

function createMockChild(): EventEmitter & { pid: number; stdout: EventEmitter; stderr: EventEmitter; killed: boolean; kill: () => void } {
  const child = new EventEmitter() as any;
  child.pid = 12345;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => { child.killed = true; });
  return child;
}

function getDefaultOptions(overrides?: Partial<ProcessManagerOptions>): ProcessManagerOptions {
  return {
    command: 'python',
    args: ['-m', 'server'],
    cwd: '/project/server',
    env: { IM_FRONTEND_DIST: '/project/web/dist' },
    healthUrl: 'http://localhost:18820/api/v1/health',
    healthTimeout: 30000,
    healthInterval: 1000,
    killTimeout: 5000,
    ...overrides,
  };
}

// --- Tests ---

describe('ProcessManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    spawnHandler = null;
    httpGetHandler = null;
    resetShellLocaleForTests();
    setShellLocale('en');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('spawn', () => {
    it('resolves when spawn event fires and isRunning() returns true', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      // Also mock http for the health polling that follows spawn
      httpGetHandler = (_url, cb) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        setTimeout(() => {
          cb(res);
          res.emit('data', Buffer.from('{"status":"ok"}'));
          res.emit('end');
        }, 0);
        const req = new EventEmitter();
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions());

      const startPromise = pm.start();

      // Emit spawn event to indicate process started
      mockChild.emit('spawn');

      // Advance timers to trigger health poll
      await vi.advanceTimersByTimeAsync(10);

      await startPromise;
      expect(pm.isRunning()).toBe(true);
    });

    it('reports the actual server executable path when spawn raises ENOENT', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;
      const serverExecutable =
        'C:\\Program Files\\Intelligence Monitor\\resources\\server-runtime\\intelligence-monitor-server.exe';

      const pm = new ProcessManager(getDefaultOptions({ command: serverExecutable }));
      const startPromise = pm.start();

      // Emit error event with ENOENT code
      const err = new Error(`spawn ${serverExecutable} ENOENT`) as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockChild.emit('error', err);

      await expect(startPromise).rejects.toThrow(
        `Server executable not found: ${serverExecutable}`
      );
      expect(dialog.showErrorBox).toHaveBeenCalledWith(
        'Server Executable Not Found',
        expect.stringContaining(serverExecutable)
      );
      expect(dialog.showErrorBox).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Python not found')
      );
      expect(pm.isRunning()).toBe(false);
    });

    it('fails startup with SchemaBaselineStartupError on exit code 3 and does not auto-restart', async () => {
      const children = [createMockChild(), createMockChild()];
      let spawnCount = 0;
      spawnHandler = () => children[spawnCount++]!;

      httpGetHandler = (_url, _cb) => {
        const req = new EventEmitter();
        Promise.resolve().then(() => {
          const err = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
          err.code = 'ECONNREFUSED';
          req.emit('error', err);
        });
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ healthTimeout: 30000, healthInterval: 500 }));
      const exitCb = vi.fn();
      pm.onUnexpectedExit(exitCb);
      let caughtError: Error | null = null;
      const startPromise = pm.start().catch((e) => { caughtError = e as Error; });
      children[0]!.emit('spawn');
      children[0]!.stderr.emit(
        'data',
        Buffer.from(
          'Traceback (most recent call last):\nSchemaBaselineError: Unsupported database schema version 2; floor 6\n',
        ),
      );
      children[0]!.emit('exit', 3, null);
      await vi.advanceTimersByTimeAsync(50);
      await startPromise;

      expect(caughtError).toBeInstanceOf(SchemaBaselineStartupError);
      if (!(caughtError instanceof SchemaBaselineStartupError)) {
        throw new Error('expected SchemaBaselineStartupError');
      }
      expect(caughtError.message).toBe('Incompatible database schema');
      expect(caughtError.technicalDetail).toContain(
        'Unsupported database schema version 2',
      );
      expect(spawnCount).toBe(1);
      expect(exitCb).not.toHaveBeenCalled();
      expect(dialog.showErrorBox).not.toHaveBeenCalled();
    });
  });

  describe('health polling', () => {
    it('resolves when HTTP 200 with {"status":"ok"} received', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      let pollCount = 0;
      httpGetHandler = (_url, cb) => {
        pollCount++;
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        // Simulate async response
        Promise.resolve().then(() => {
          cb(res);
          res.emit('data', Buffer.from('{"status":"ok"}'));
          res.emit('end');
        });
        const req = new EventEmitter();
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ healthInterval: 100 }));
      const startPromise = pm.start();

      // Fire spawn event
      mockChild.emit('spawn');

      // Let the immediate health check fire
      await vi.advanceTimersByTimeAsync(10);

      await startPromise;
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects after healthTimeout ms and shows error dialog', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      // Health always returns connection refused
      httpGetHandler = (_url, _cb) => {
        const req = new EventEmitter();
        // Simulate ECONNREFUSED after a tick
        Promise.resolve().then(() => {
          const err = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
          err.code = 'ECONNREFUSED';
          req.emit('error', err);
        });
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ healthTimeout: 5000, healthInterval: 500 }));

      // Attach rejection handler BEFORE spawning to avoid unhandled rejection
      let caughtError: Error | null = null;
      const startPromise = pm.start().catch((e) => { caughtError = e as Error; });

      mockChild.emit('spawn');

      // Advance past the health timeout
      await vi.advanceTimersByTimeAsync(5100);
      await startPromise;

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Health check timed out');
      expect(dialog.showErrorBox).toHaveBeenCalledWith(
        'Server Startup Timeout',
        expect.stringContaining('Server failed to start within 5 seconds')
      );
    });

    it('rejects with SchemaBaselineStartupError when stderr is a floor reject, without a traceback dialog', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;
      httpGetHandler = (_url, _cb) => {
        const req = new EventEmitter();
        Promise.resolve().then(() => {
          const err = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
          err.code = 'ECONNREFUSED';
          req.emit('error', err);
        });
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ healthTimeout: 5000, healthInterval: 500 }));
      let caughtError: Error | null = null;
      const startPromise = pm.start().catch((e) => { caughtError = e as Error; });
      mockChild.emit('spawn');
      mockChild.stderr.emit(
        'data',
        Buffer.from('SchemaBaselineError: Unsupported database schema version 2; floor 6\n'),
      );

      await vi.advanceTimersByTimeAsync(5100);
      await startPromise;

      expect(caughtError).toBeInstanceOf(SchemaBaselineStartupError);
      expect(caughtError!.message).toBe('Incompatible database schema');
      expect(dialog.showErrorBox).not.toHaveBeenCalled();
    });

    it('keeps retrying on ECONNREFUSED (does not reject immediately)', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      let pollCount = 0;
      httpGetHandler = (_url, cb) => {
        pollCount++;
        const req = new EventEmitter();

        if (pollCount < 4) {
          // First 3 attempts: ECONNREFUSED
          Promise.resolve().then(() => {
            const err = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
            err.code = 'ECONNREFUSED';
            req.emit('error', err);
          });
        } else {
          // 4th attempt: success
          Promise.resolve().then(() => {
            const res = new EventEmitter() as any;
            res.statusCode = 200;
            cb(res);
            res.emit('data', Buffer.from('{"status":"ok"}'));
            res.emit('end');
          });
        }
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ healthInterval: 100, healthTimeout: 30000 }));
      const startPromise = pm.start();

      mockChild.emit('spawn');

      // Advance through the retries
      await vi.advanceTimersByTimeAsync(10); // first immediate poll
      await vi.advanceTimersByTimeAsync(100); // second poll
      await vi.advanceTimersByTimeAsync(100); // third poll
      await vi.advanceTimersByTimeAsync(100); // fourth poll (success)

      await startPromise;
      expect(pollCount).toBe(4);
    });
  });

  describe('graceful shutdown', () => {
    it('sends taskkill /PID /T and resolves when exit event fires', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      httpGetHandler = (_url, cb) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        Promise.resolve().then(() => {
          cb(res);
          res.emit('data', Buffer.from('{"status":"ok"}'));
          res.emit('end');
        });
        const req = new EventEmitter();
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ killTimeout: 5000 }));
      const startPromise = pm.start();
      mockChild.emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      // Now stop
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        // Simulate graceful taskkill success - process exits
        if (!cmd.includes('/F')) {
          // After graceful signal, emit exit
          setTimeout(() => mockChild.emit('exit', 0, null), 50);
        }
        cb(null);
      });

      const stopPromise = pm.stop();
      await vi.advanceTimersByTimeAsync(100);
      await stopPromise;

      // /T is required so PyInstaller/uvicorn children are not orphaned.
      expect(mockExec).toHaveBeenCalledWith(
        'taskkill /PID 12345 /T',
        expect.any(Function)
      );
      expect(pm.isRunning()).toBe(false);
    });

    it('sends taskkill /F /PID /T after killTimeout ms if process has not exited', async () => {
      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      httpGetHandler = (_url, cb) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        Promise.resolve().then(() => {
          cb(res);
          res.emit('data', Buffer.from('{"status":"ok"}'));
          res.emit('end');
        });
        const req = new EventEmitter();
        return req;
      };

      const pm = new ProcessManager(getDefaultOptions({ killTimeout: 2000 }));
      const startPromise = pm.start();
      mockChild.emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      // Mock exec: graceful kill does not cause exit; force kill does
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        if (cmd.includes('/F')) {
          // Force kill causes exit
          setTimeout(() => mockChild.emit('exit', 1, 'SIGKILL'), 50);
        }
        cb(null);
      });

      const stopPromise = pm.stop();

      // Advance past killTimeout so force kill fires
      await vi.advanceTimersByTimeAsync(2100);
      // Advance past the exit event delay
      await vi.advanceTimersByTimeAsync(600);

      await stopPromise;

      // Should have been called twice: graceful then force, both tree-wide.
      expect(mockExec).toHaveBeenCalledWith(
        'taskkill /PID 12345 /T',
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        'taskkill /F /PID 12345 /T',
        expect.any(Function)
      );
      expect(pm.isRunning()).toBe(false);
    });
  });
});
