import { exec, type ChildProcess } from 'node:child_process';
import { app, dialog } from 'electron';
import { StartupCancelledError } from './process-manager-health';

export interface StopChildOptions {
  child: ChildProcess | null;
  killTimeout: number;
  getProcess: () => ChildProcess | null;
  setProcess: (child: ChildProcess | null) => void;
  setRunning: (running: boolean) => void;
  setStopping: (stopping: boolean) => void;
}

/** Gracefully stop a child (taskkill → wait → force kill). */
export function stopChildProcess(options: StopChildOptions): Promise<void> {
  const { child, killTimeout } = options;
  if (!child) {
    options.setRunning(false);
    options.setStopping(false);
    return Promise.resolve();
  }

  const pid = child.pid;
  if (!pid) {
    if (options.getProcess() === child) options.setProcess(null);
    options.setRunning(false);
    options.setStopping(false);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;

    const cleanup = (): void => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      child.removeListener('exit', onExit);
      if (options.getProcess() === child) {
        options.setProcess(null);
        options.setRunning(false);
      }
      options.setStopping(false);
      resolve();
    };

    const onExit = (): void => {
      console.log(`[server] Process ${pid} exited gracefully during shutdown`);
      cleanup();
    };
    child.once('exit', onExit);

    // /T covers the whole tree: the PyInstaller sidecar re-spawns itself and
    // uvicorn workers, so killing only the parent PID orphans those children.
    console.log(`[server] Sending taskkill /PID ${pid} /T (graceful terminate)`);
    exec(`taskkill /PID ${pid} /T`, (err) => {
      if (err) console.warn(`[server] taskkill /PID ${pid} /T failed: ${err.message}`);
    });

    timeoutId = setTimeout(() => {
      if (resolved) return;
      console.log(`[server] Process ${pid} did not exit within ${killTimeout}ms, force killing`);
      exec(`taskkill /F /PID ${pid} /T`, (err) => {
        if (err) console.warn(`[server] taskkill /F /PID ${pid} /T failed: ${err.message}`);
        setTimeout(cleanup, 500);
      });
    }, killTimeout);
  });
}

export interface RestartLoopHost {
  getRestartRequestedGeneration: () => number | null;
  clearRestartRequestedGeneration: () => void;
  getStopping: () => boolean;
  getGeneration: () => number;
  getRestartCount: () => number;
  getMaxRestarts: () => number;
  incrementRestartCount: () => number;
  getStartFlight: () => Promise<void> | null;
  runStartup: () => Promise<void>;
  onRepeatedCrash: () => void;
}

/** Drive queued unexpected-exit restarts until drained or crash limit. */
export async function driveRestartLoop(host: RestartLoopHost): Promise<void> {
  const activeStart = host.getStartFlight();
  if (activeStart) {
    try {
      await activeStart;
    } catch {
      // An exited startup is expected to reject before its replacement starts.
    }
  }

  while (host.getRestartRequestedGeneration() !== null) {
    const requestedGeneration = host.getRestartRequestedGeneration();
    host.clearRestartRequestedGeneration();
    if (requestedGeneration === null) continue;
    if (host.getStopping() || host.getGeneration() !== requestedGeneration) continue;

    if (host.getRestartCount() >= host.getMaxRestarts()) {
      host.onRepeatedCrash();
      return;
    }

    const attempt = host.incrementRestartCount();
    console.warn(
      `[server] Unexpected exit. Attempting restart ${attempt}/${host.getMaxRestarts()}...`
    );

    try {
      await host.runStartup();
    } catch (err) {
      if (err instanceof StartupCancelledError) {
        // An unexpected exit queues another generation; stop() deliberately does not.
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[server] Restart failed: ${message}`);
      host.onRepeatedCrash();
      return;
    }
  }
}

/** Show the repeated-crash dialog and exit the app. */
export function showRepeatedCrashAndExit(): void {
  dialog.showErrorBox(
    'Server Crash',
    'Server crashed repeatedly. The application will now exit.'
  );
  app.exit(1);
}
