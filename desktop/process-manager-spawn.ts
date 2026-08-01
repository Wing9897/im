import { spawn, type ChildProcess } from 'node:child_process';
import { dialog } from 'electron';
import { StartupCancelledError, type HealthStartupAttempt } from './process-manager-health';

export type SpawnStartupAttempt = HealthStartupAttempt;

export interface SpawnProcessDeps {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  attempt: SpawnStartupAttempt;
  isCurrent: (attempt: SpawnStartupAttempt) => boolean;
  getProcess: () => ChildProcess | null;
  setProcess: (child: ChildProcess | null) => void;
  setRunning: (running: boolean) => void;
  clearStderr: () => void;
  appendStderr: (chunk: string) => void;
  /** Called when the managed child exits unexpectedly (not during stop). */
  onManagedExit: (child: ChildProcess, code: number | null, signal: NodeJS.Signals | null) => void;
}

/** Spawn the server subprocess and resolve once the OS reports spawn success. */
export function spawnServerProcess(deps: SpawnProcessDeps): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const { command, args, cwd, env, attempt } = deps;
    let settled = false;

    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      if (attempt.cancel === cancel) attempt.cancel = null;
      resolve();
    };
    const finishReject = (error: Error): void => {
      if (settled) return;
      settled = true;
      if (attempt.cancel === cancel) attempt.cancel = null;
      reject(error);
    };
    const cancel = (): void => finishReject(attempt.rejectReason ?? new StartupCancelledError());
    attempt.cancel = cancel;

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    attempt.child = child;
    if (deps.isCurrent(attempt)) deps.setProcess(child);

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (!deps.isCurrent(attempt) || deps.getProcess() !== child) {
        finishReject(new StartupCancelledError());
        return;
      }

      deps.setRunning(false);
      deps.setProcess(null);
      if (err.code === 'ENOENT') {
        dialog.showErrorBox(
          'Server Executable Not Found',
          `Server executable not found:\n${command}\n\nBuild or reinstall the desktop server sidecar and try again.`
        );
        finishReject(new Error(`Server executable not found: ${command}`));
      } else {
        dialog.showErrorBox('Server Error', `Failed to start server process: ${err.message}`);
        finishReject(err);
      }
    });

    // Fresh attempt — clear prior stderr so schema detection is scoped.
    deps.clearStderr();

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        console.log(`[server stdout] ${data.toString().trimEnd()}`);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        deps.appendStderr(text);
        console.error(`[server stderr] ${text.trimEnd()}`);
      });
    }

    child.on('exit', (code, signal) => {
      deps.onManagedExit(child, code, signal);
    });

    child.on('spawn', () => {
      if (!deps.isCurrent(attempt) || deps.getProcess() !== child) {
        finishReject(new StartupCancelledError());
        return;
      }
      deps.setRunning(true);
      finishResolve();
    });
  });
}
