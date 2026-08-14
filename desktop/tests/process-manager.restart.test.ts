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

describe('ProcessManager restart and lifecycle', () => {
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

  describe('auto-restart', () => {
    it('restarts process on unexpected exit, incrementing restart count', async () => {
      const mockChild1 = createMockChild();
      const mockChild2 = createMockChild();
      mockChild2.pid = 12346;

      let spawnCount = 0;
      spawnHandler = () => {
        spawnCount++;
        return spawnCount === 1 ? mockChild1 : mockChild2;
      };

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

      const exitCb = vi.fn();
      const pm = new ProcessManager(getDefaultOptions({ healthInterval: 100 }));
      pm.onUnexpectedExit(exitCb);

      const startPromise = pm.start();
      mockChild1.emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      // Simulate unexpected exit
      mockChild1.emit('exit', 1, null);

      // The auto-restart logic should spawn a new process
      await vi.advanceTimersByTimeAsync(10);
      // New child spawns
      mockChild2.emit('spawn');
      await vi.advanceTimersByTimeAsync(110);

      expect(spawnCount).toBe(2);
      expect(exitCb).toHaveBeenCalledWith(1);
    });

    it('shows error dialog and calls app.exit(1) after 3 restart failures', async () => {
      const children: any[] = [];
      let spawnCount = 0;

      spawnHandler = () => {
        spawnCount++;
        const child = createMockChild();
        child.pid = 12345 + spawnCount;
        children.push(child);
        return child;
      };

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

      const pm = new ProcessManager(getDefaultOptions({ healthInterval: 50 }));
      const startPromise = pm.start();
      children[0].emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      // Simulate 3 unexpected exits (exhausts max restarts)
      // Exit 1
      children[0].emit('exit', 1, null);
      await vi.advanceTimersByTimeAsync(10);
      children[1].emit('spawn');
      await vi.advanceTimersByTimeAsync(60);

      // Exit 2
      children[1].emit('exit', 1, null);
      await vi.advanceTimersByTimeAsync(10);
      children[2].emit('spawn');
      await vi.advanceTimersByTimeAsync(60);

      // Exit 3
      children[2].emit('exit', 1, null);
      await vi.advanceTimersByTimeAsync(10);
      children[3].emit('spawn');
      await vi.advanceTimersByTimeAsync(60);

      // Exit 4 — max restarts exhausted (3 restarts already done)
      children[3].emit('exit', 1, null);
      await vi.advanceTimersByTimeAsync(10);

      expect(dialog.showErrorBox).toHaveBeenCalledWith(
        'Server Crash',
        expect.stringContaining('crashed repeatedly')
      );
      expect(app.exit).toHaveBeenCalledWith(1);
    });

    it('does not restart during intentional stop', async () => {
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

      let spawnCount = 0;
      const origHandler = spawnHandler;
      spawnHandler = (...args: any[]) => {
        spawnCount++;
        return (origHandler as any)(...args);
      };

      const pm = new ProcessManager(getDefaultOptions({ killTimeout: 2000 }));
      const exitCb = vi.fn();
      pm.onUnexpectedExit(exitCb);
      const startPromise = pm.start();
      mockChild.emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      // Mock exec for stop
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        if (!cmd.includes('/F')) {
          setTimeout(() => mockChild.emit('exit', 0, null), 50);
        }
        cb(null);
      });

      const stopPromise = pm.stop();
      await vi.advanceTimersByTimeAsync(100);
      await stopPromise;

      // Should NOT have spawned a second time
      expect(spawnCount).toBe(1);
      expect(exitCb).not.toHaveBeenCalled();
      expect(app.exit).not.toHaveBeenCalled();
    });
  });

  describe('Property 2: Process Lifecycle Coupling', () => {
    /**
     *
     * For any exit scenario, if stop() is called then the Python subprocess
     * receives a termination signal (taskkill /PID) within killTimeout ms.
     */
    it.each([
      { killTimeout: 100, pid: 1000, label: 'min killTimeout, min pid' },
      { killTimeout: 5000, pid: 12345, label: 'mid killTimeout, mid pid' },
      { killTimeout: 10000, pid: 65535, label: 'max killTimeout, max pid' },
    ])('stop() sends termination signal ($label)', async ({ killTimeout, pid }) => {
      vi.clearAllMocks();

      const mockChild = createMockChild();
      mockChild.pid = pid;
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

      let terminateSignalSent = false;
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        if (cmd.includes('taskkill') && cmd.includes(`${pid}`)) {
          terminateSignalSent = true;
          setTimeout(() => mockChild.emit('exit', 0, null), 10);
        }
        cb(null);
      });

      const pm = new ProcessManager(getDefaultOptions({ killTimeout }));
      const startPromise = pm.start();
      mockChild.emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      const stopPromise = pm.stop();
      await vi.advanceTimersByTimeAsync(killTimeout + 1000);
      await stopPromise;

      expect(terminateSignalSent).toBe(true);
      expect(pm.isRunning()).toBe(false);
    });
  });

  describe('Property 3: Health Gate', () => {
    /**
     *
     * For any startup sequence, start() does not resolve (server not considered ready)
     * until the health endpoint returns HTTP 200 with {"status":"ok"}.
     */
    it.each([
      { failCount: 1, healthInterval: 50, label: 'single failure, min interval' },
      { failCount: 3, healthInterval: 250, label: 'multiple failures, mid interval' },
      { failCount: 5, healthInterval: 500, label: 'max failures, max interval' },
    ])('start() only resolves after health ok ($label)', async ({ failCount, healthInterval }) => {
      vi.clearAllMocks();

      const mockChild = createMockChild();
      spawnHandler = () => mockChild;

      let pollAttempts = 0;
      let resolvedBeforeHealthy = false;

      httpGetHandler = (_url, cb) => {
        pollAttempts++;
        const req = new EventEmitter();

        if (pollAttempts <= failCount) {
          Promise.resolve().then(() => {
            const err = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
            err.code = 'ECONNREFUSED';
            req.emit('error', err);
          });
        } else {
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

      const pm = new ProcessManager(getDefaultOptions({ healthInterval, healthTimeout: 60000 }));

      let startResolved = false;
      const startPromise = pm.start().then(() => { startResolved = true; });

      mockChild.emit('spawn');

      for (let i = 0; i < failCount; i++) {
        await vi.advanceTimersByTimeAsync(healthInterval + 10);
        if (startResolved && pollAttempts <= failCount) {
          resolvedBeforeHealthy = true;
        }
      }

      await vi.advanceTimersByTimeAsync(healthInterval + 10);
      await startPromise;

      expect(resolvedBeforeHealthy).toBe(false);
      expect(startResolved).toBe(true);
      expect(pollAttempts).toBeGreaterThan(failCount);
    });
  });

  describe('Property 5: Graceful Shutdown Ordering', () => {
    /**
     *
     * For any quit sequence, the Python process first receives taskkill /PID (graceful),
     * and force kill (taskkill /F /PID) is only issued if the process has not exited
     * within killTimeout ms.
     */
    it.each([
      { killTimeout: 100, exitsGracefully: true, label: 'min timeout, graceful exit' },
      { killTimeout: 2500, exitsGracefully: false, label: 'mid timeout, no graceful exit' },
      { killTimeout: 5000, exitsGracefully: true, label: 'max timeout, graceful exit' },
      { killTimeout: 5000, exitsGracefully: false, label: 'max timeout, force kill required' },
    ])('graceful signal precedes force kill ($label)', async ({ killTimeout, exitsGracefully }) => {
      vi.clearAllMocks();

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

      const signals: string[] = [];
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        if (cmd.includes('/F')) {
          signals.push('force');
          setTimeout(() => mockChild.emit('exit', 1, null), 10);
        } else if (cmd.includes('taskkill')) {
          signals.push('graceful');
          if (exitsGracefully) {
            setTimeout(() => mockChild.emit('exit', 0, null), 50);
          }
        }
        cb(null);
      });

      const pm = new ProcessManager(getDefaultOptions({ killTimeout }));
      const startPromise = pm.start();
      mockChild.emit('spawn');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      const stopPromise = pm.stop();
      await vi.advanceTimersByTimeAsync(killTimeout + 1000);
      await stopPromise;

      expect(signals[0]).toBe('graceful');

      if (exitsGracefully) {
        expect(signals).not.toContain('force');
      } else {
        expect(signals.indexOf('force')).toBeGreaterThan(signals.indexOf('graceful'));
      }
    });
  });
});

describe('ProcessManager single-flight races', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    spawnHandler = null;
    httpGetHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a fresh child when start is queued behind a stop that cancels restart', async () => {
    const children = [createMockChild(), createMockChild(), createMockChild()];
    children[1]!.pid = 12346;
    children[2]!.pid = 12347;
    let spawnCount = 0;
    spawnHandler = () => children[spawnCount++]!;
    httpGetHandler = (_url, cb) => {
      const response = new EventEmitter() as any;
      response.statusCode = 200;
      Promise.resolve().then(() => {
        cb(response);
        response.emit('data', Buffer.from('{"status":"ok"}'));
        response.emit('end');
      });
      return new EventEmitter();
    };
    mockExec.mockImplementation((_command: string, callback: Function) => callback(null));

    const manager = new ProcessManager(getDefaultOptions());
    const initialStart = manager.start();
    children[0]!.emit('spawn');
    await vi.advanceTimersByTimeAsync(0);
    await initialStart;

    children[0]!.emit('exit', 1, null);
    await vi.advanceTimersByTimeAsync(0);
    expect(spawnCount).toBe(2);

    const stopFlight = manager.stop();
    const queuedStart = manager.start();
    expect(manager.start()).toBe(queuedStart);

    children[1]!.emit('exit', 0, null);
    await stopFlight;
    await vi.advanceTimersByTimeAsync(0);
    expect(spawnCount).toBe(3);

    children[2]!.emit('spawn');
    await vi.advanceTimersByTimeAsync(0);
    await queuedStart;

    expect(manager.isRunning()).toBe(true);
    expect(manager.getProcess()).toBe(children[2]);
  });
});