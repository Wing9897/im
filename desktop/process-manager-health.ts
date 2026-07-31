import http, { type ClientRequest } from 'node:http';
import type { ChildProcess } from 'node:child_process';
import { dialog } from 'electron';
import { looksLikeSchemaHardReject, schemaHardRejectHint } from './process-manager-schema';
import { getShellCopy } from './shell-i18n';

export class StartupCancelledError extends Error {
  constructor() {
    super('Server startup cancelled');
    this.name = 'StartupCancelledError';
  }
}

export interface HealthStartupAttempt {
  generation: number;
  child: ChildProcess | null;
  cancelled: boolean;
  cancel: (() => void) | null;
}

export interface HealthPollOptions {
  healthUrl: string;
  healthInterval: number;
  healthTimeout: number;
  attempt: HealthStartupAttempt;
  isCurrent: (attempt: HealthStartupAttempt) => boolean;
  recentStderr: () => string;
  getManagedProcess: () => ChildProcess | null;
}

/** Poll /api/v1/health until ok (or upgrade states) or timeout / cancel. */
export function pollServerHealth(options: HealthPollOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const { healthUrl, healthInterval, healthTimeout, attempt } = options;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let request: ClientRequest | null = null;
    let settled = false;

    const clearRequest = (): void => {
      if (!request) return;
      if (typeof request.destroy === 'function') request.destroy();
      request = null;
    };

    const cleanup = (): void => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      clearRequest();
      if (attempt.cancel === cancel) attempt.cancel = null;
    };

    const succeed = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const cancel = (): void => fail(new StartupCancelledError());
    attempt.cancel = cancel;

    const scheduleNext = (): void => {
      if (settled || !options.isCurrent(attempt)) return;
      pollTimer = setTimeout(() => {
        pollTimer = null;
        checkHealth();
      }, healthInterval);
    };

    const checkHealth = (): void => {
      if (settled || !options.isCurrent(attempt)) {
        cancel();
        return;
      }

      let currentRequest: ClientRequest | null = null;
      let completedBeforeAssignment = false;
      let requestCompleted = false;

      const completeAttempt = (): void => {
        if (requestCompleted || settled) return;
        requestCompleted = true;
        if (!currentRequest) {
          completedBeforeAssignment = true;
        } else if (request === currentRequest) {
          request = null;
        }
        scheduleNext();
      };

      const createdRequest = http.get(healthUrl, (res) => {
        let body = '';
        if (res.statusCode === 200) {
          res.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
        }
        res.once('error', completeAttempt);
        res.once('aborted', completeAttempt);
        res.once('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(body);
              if (
                (parsed.status === 'ok' ||
                  parsed.status === 'needs_upgrade' ||
                  parsed.status === 'migrating' ||
                  parsed.status === 'upgrade_failed') &&
                options.isCurrent(attempt)
              ) {
                succeed();
                return;
              }
            } catch {
              // Invalid JSON means the server is not healthy yet.
            }
          }
          completeAttempt();
        });
        if (res.statusCode !== 200) res.resume();
      });

      currentRequest = createdRequest;
      if (!completedBeforeAssignment && !settled && options.isCurrent(attempt)) {
        request = createdRequest;
      }

      createdRequest.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'ECONNREFUSED') {
          console.error(`[health] Unexpected error: ${err.message}`);
        }
        completeAttempt();
      });
    };

    timeoutTimer = setTimeout(() => {
      if (settled || !options.isCurrent(attempt)) return;
      const managed = options.getManagedProcess();
      if (looksLikeSchemaHardReject(options.recentStderr())) {
        const copy = getShellCopy();
        dialog.showErrorBox(copy.incompatibleDatabaseTitle, schemaHardRejectHint());
        const child = attempt.child;
        if (child && managed === child && !child.killed) child.kill();
        fail(new Error('Incompatible database schema'));
        return;
      }
      const copy = getShellCopy();
      const hint = schemaHardRejectHint();
      dialog.showErrorBox(
        copy.serverStartupTimeoutTitle,
        copy.serverStartupTimeoutBody(Math.ceil(healthTimeout / 1000), hint),
      );
      const child = attempt.child;
      if (child && managed === child && !child.killed) child.kill();
      fail(new Error('Health check timed out'));
    }, healthTimeout);

    if (!options.isCurrent(attempt)) {
      cancel();
      return;
    }
    checkHealth();
  });
}
