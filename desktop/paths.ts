import { app, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Resolves the path to the bundled frontend dist directory.
 *
 * - Dev mode: `../web/dist` relative to the project root (one level up from desktop/)
 * - Packaged mode: `web-dist` within `process.resourcesPath`
 */
export function resolveFrontendDistPath(devMode: boolean): string {
  if (devMode) {
    // In dev, desktop/ is at project root level; web/dist is a sibling directory
    return path.resolve(__dirname, '..', '..', 'web', 'dist');
  }
  // In packaged app, electron-builder places extraResources in process.resourcesPath
  return path.join(process.resourcesPath, 'web-dist');
}

/**
 * Resolves the working directory for the backend subprocess.
 *
 * - Dev mode: `../server/` relative to the project root (one level up from desktop/)
 * - Packaged mode: self-contained PyInstaller directory within resources
 */
export function resolveServerCwd(devMode: boolean): string {
  if (devMode) {
    // In dev, server/ is a sibling directory to desktop/
    return path.resolve(__dirname, '..', '..', 'server');
  }
  return path.join(
    process.resourcesPath,
    'server-runtime',
    'intelligence-monitor-server'
  );
}

/**
 * Validates that the resolved frontend dist and server paths exist on disk.
 * If either path is missing, shows a native error dialog and exits the app.
 */
export function validatePaths(frontendDist: string, serverCwd: string): void {
  const missing: string[] = [];

  if (!fs.existsSync(frontendDist)) {
    missing.push(`Frontend dist: ${frontendDist}`);
  }
  if (!fs.existsSync(serverCwd)) {
    missing.push(`Server runtime: ${serverCwd}`);
  }

  if (missing.length > 0) {
    dialog.showErrorBox(
      'Missing Resources',
      `The following required resources were not found:\n\n${missing.join('\n')}\n\nPlease rebuild the application or verify your installation.`
    );
    app.exit(1);
  }
}
