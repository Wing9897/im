import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';

/**
 * Unit tests for desktop/paths.ts
 *
 * Property 6: Environment Path Resolution
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 *
 * For any execution context (dev mode or packaged .exe), the resolved paths
 * point to the correct directories for frontend dist and server cwd.
 */

// Mock electron module
vi.mock('electron', () => ({
  app: {
    exit: vi.fn(),
  },
  dialog: {
    showErrorBox: vi.fn(),
  },
}));

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('paths - resolveFrontendDistPath', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dev mode: returns path containing web/dist', async () => {
    const { resolveFrontendDistPath } = await import('../paths');
    const result = resolveFrontendDistPath(true);

    // In dev mode, path should resolve to web/dist relative to project root
    expect(result).toContain(path.join('web', 'dist'));
    // Should be an absolute path
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('packaged mode: uses process.resourcesPath + web-dist', async () => {
    const fakeResourcesPath = 'C:\\Program Files\\IntelligenceMonitor\\resources';
    Object.defineProperty(process, 'resourcesPath', {
      value: fakeResourcesPath,
      writable: true,
      configurable: true,
    });

    const { resolveFrontendDistPath } = await import('../paths');
    const result = resolveFrontendDistPath(false);

    expect(result).toBe(path.join(fakeResourcesPath, 'web-dist'));
  });
});

describe('paths - resolveServerCwd', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dev mode: returns path containing server', async () => {
    const { resolveServerCwd } = await import('../paths');
    const result = resolveServerCwd(true);

    // In dev mode, path should end with 'server'
    expect(path.basename(result)).toBe('server');
    // Should be an absolute path
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('packaged mode: uses bundled server runtime directory', async () => {
    const fakeResourcesPath = 'C:\\Program Files\\IntelligenceMonitor\\resources';
    Object.defineProperty(process, 'resourcesPath', {
      value: fakeResourcesPath,
      writable: true,
      configurable: true,
    });

    const { resolveServerCwd } = await import('../paths');
    const result = resolveServerCwd(false);

    expect(result).toBe(
      path.join(
        fakeResourcesPath,
        'server-runtime',
        'intelligence-monitor-server'
      )
    );
  });
});

describe('paths - validatePaths', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not show error or exit when both paths exist', async () => {
    const fs = await import('node:fs');
    const { app, dialog } = await import('electron');
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const { validatePaths } = await import('../paths');
    validatePaths('/some/frontend/dist', '/some/server');

    expect(dialog.showErrorBox).not.toHaveBeenCalled();
    expect(app.exit).not.toHaveBeenCalled();
  });

  it('shows error dialog and exits when frontend path is missing', async () => {
    const fs = await import('node:fs');
    const { app, dialog } = await import('electron');
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('frontend')) return false;
      return true;
    });

    const { validatePaths } = await import('../paths');
    validatePaths('/missing/frontend/dist', '/some/server');

    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      'Missing Resources',
      expect.stringContaining('/missing/frontend/dist')
    );
    expect(app.exit).toHaveBeenCalledWith(1);
  });

  it('shows error dialog and exits when server path is missing', async () => {
    const fs = await import('node:fs');
    const { app, dialog } = await import('electron');
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('server')) return false;
      return true;
    });

    const { validatePaths } = await import('../paths');
    validatePaths('/some/frontend/dist', '/missing/server/path');

    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      'Missing Resources',
      expect.stringContaining('/missing/server/path')
    );
    expect(app.exit).toHaveBeenCalledWith(1);
  });
});
