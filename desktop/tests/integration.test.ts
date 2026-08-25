import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration tests for the full startup/shutdown cycle.
 *
 * These tests verify the INTERACTIONS between ProcessManager, BrowserWindow,
 * and the quit/close sequences — ensuring components are correctly wired together.
 *
 */

// --- Shared Mock State ---

let appEventHandlers: Record<string, Function[]> = {};
let gotLockReturn = true;

// Track call order for verifying sequencing
const callOrder: string[] = [];

// App mocks
const mockQuit = vi.fn(() => callOrder.push('app.quit'));
const mockExit = vi.fn((code: number) => callOrder.push(`app.exit(${code})`));
const mockWhenReady = vi.fn();
const mockRequestSingleInstanceLock = vi.fn(() => gotLockReturn);
const mockRegister = vi.fn();
const mockUnregisterAll = vi.fn();
const mockShowErrorBox = vi.fn();
const mockIsNotificationSupported = vi.fn(() => false);

// BrowserWindow mock state
const mockShow = vi.fn(() => callOrder.push('window.show'));
const mockCenter = vi.fn(() => callOrder.push('window.center'));
const mockHide = vi.fn(() => callOrder.push('window.hide'));
const mockFocus = vi.fn();
const mockRestore = vi.fn();
const mockIsMinimized = vi.fn(() => false);
const mockLoadURL = vi.fn(() => callOrder.push('window.loadURL'));
const mockWebContents = {
  on: vi.fn(),
  once: vi.fn(),
  openDevTools: vi.fn(),
  setWindowOpenHandler: vi.fn(),
};

let windowCloseHandler: ((event: any) => void) | null | undefined = null;
let readyToShowHandler: (() => void) | null = null;
let capturedBrowserWindowOpts: any = null;
let windowCreated = false;

// ProcessManager mock
const mockPMStart = vi.fn(() => {
  callOrder.push('processManager.start');
  return Promise.resolve();
});
const mockPMStop = vi.fn(() => {
  callOrder.push('processManager.stop');
  return Promise.resolve();
});
const mockPMIsRunning = vi.fn(() => true);
let pmConstructorCalled = false;

// Tray mock
const mockCreateTray = vi.fn(() => callOrder.push('createTray'));
const mockDestroyTray = vi.fn();

// Paths mock
const mockResolveFrontendDistPath = vi.fn(() => '/project/web/dist');
const mockResolveServerCwd = vi.fn(() => '/project/server');
const mockValidatePaths = vi.fn();

// Connection mock (default host)
let mockConnectionConfig: { mode: 'host' | 'client'; serverUrl?: string } = {
  mode: 'host',
};
const mockLoadConnection = vi.fn(() => ({ ...mockConnectionConfig }));
const mockInitAnalysisNotifications = vi.fn();

// --- Electron Mock ---

vi.mock('electron', () => {
  const BrowserWindowMock = vi.fn(function (this: any, opts: any) {
    capturedBrowserWindowOpts = opts;
    windowCreated = true;
    callOrder.push('BrowserWindow.create');
    this.show = mockShow;
    this.center = mockCenter;
    this.hide = mockHide;
    this.focus = mockFocus;
    this.restore = mockRestore;
    this.isMinimized = mockIsMinimized;
    this.loadURL = mockLoadURL;
    this.webContents = mockWebContents;
    this.once = vi.fn((event: string, handler: Function) => {
      if (event === 'ready-to-show') {
        readyToShowHandler = handler as () => void;
      }
    });
    this.on = vi.fn((event: string, handler: Function) => {
      if (event === 'close') {
        windowCloseHandler = handler as (event: any) => void;
      }
    });
    return this;
  });

  return {
    app: {
      requestSingleInstanceLock: () => mockRequestSingleInstanceLock(),
      on: vi.fn((event: string, handler: Function) => {
        if (!appEventHandlers[event]) appEventHandlers[event] = [];
        appEventHandlers[event].push(handler);
      }),
      whenReady: () => mockWhenReady(),
      quit: mockQuit,
      exit: mockExit,
      getPath: vi.fn(() => '/mock/userData'),
      setAsDefaultProtocolClient: vi.fn(() => true),
    },
    BrowserWindow: BrowserWindowMock,
    dialog: {
      showErrorBox: mockShowErrorBox,
    },
    globalShortcut: {
      register: mockRegister,
      unregisterAll: mockUnregisterAll,
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    Notification: class {
      static isSupported = mockIsNotificationSupported;
      show = vi.fn();
    },
  };
});

vi.mock('../connection', async () => {
  const actual = await vi.importActual<typeof import('../connection')>('../connection');
  return {
    ...actual,
    loadConnection: () => mockLoadConnection(),
  };
});

vi.mock('../notifications', () => ({
  initAnalysisNotifications: (...args: unknown[]) => mockInitAnalysisNotifications(...args),
  stopAnalysisNotifications: vi.fn(),
}));

vi.mock('../chromium-cache', () => ({
  maybeRecoverChromiumDiskCache: vi.fn(),
}));

vi.mock('../process-manager', () => ({
  ProcessManager: vi.fn(function (this: any, opts: any) {
    pmConstructorCalled = true;
    this.start = mockPMStart;
    this.stop = mockPMStop;
    this.isRunning = mockPMIsRunning;
    this.onUnexpectedExit = vi.fn();
    return this;
  }),
}));

vi.mock('../tray', () => ({
  createTray: mockCreateTray,
  destroyTray: mockDestroyTray,
  updateTrayStatus: vi.fn(),
  refreshTrayLocale: vi.fn(),
  setTrayLocalePreference: vi.fn(),
  setTrayAnalysisState: vi.fn(),
}));

vi.mock('../menu', () => ({
  buildApplicationMenu: vi.fn(() => ({ items: [] })),
}));

vi.mock('../paths', () => ({
  resolveFrontendDistPath: mockResolveFrontendDistPath,
  resolveServerCwd: mockResolveServerCwd,
  validatePaths: mockValidatePaths,
}));

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    default: actual,
    join: (...args: string[]) => actual.join(...args),
  };
});

// --- Helper ---

async function setupAndReady(
  options: {
    devMode?: boolean;
    connection?: { mode: 'host' | 'client'; serverUrl?: string };
  } = {},
): Promise<void> {
  gotLockReturn = true;
  mockConnectionConfig = options.connection
    ? { ...options.connection }
    : { mode: 'host' };
  mockLoadConnection.mockImplementation(() => ({ ...mockConnectionConfig }));

  const originalArgv = process.argv;
  if (options.devMode) {
    process.argv = ['node', 'main.js', '--dev'];
  } else {
    process.argv = ['node', 'main.js'];
  }

  let readyHandler: Function | null = null;
  mockWhenReady.mockReturnValue({
    then: (cb: Function) => {
      readyHandler = cb;
      return Promise.resolve();
    },
  });

  await vi.importActual('../main');
  if (readyHandler) await (readyHandler as Function)();

  process.argv = originalArgv;
}

// --- Integration Tests ---

describe('Integration: Full Startup/Shutdown Cycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    appEventHandlers = {};
    gotLockReturn = true;
    windowCloseHandler = null;
    readyToShowHandler = null;
    capturedBrowserWindowOpts = null;
    windowCreated = false;
    pmConstructorCalled = false;
    callOrder.length = 0;
    mockConnectionConfig = { mode: 'host' };
    mockLoadConnection.mockImplementation(() => ({ ...mockConnectionConfig }));

    // Restore default implementations after clearAllMocks
    mockPMStart.mockImplementation(() => {
      callOrder.push('processManager.start');
      return Promise.resolve();
    });
    mockPMStop.mockImplementation(() => {
      callOrder.push('processManager.stop');
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Startup Sequence', () => {
    /**
     *
     * Test that start sequence calls ProcessManager.start() then creates window then creates tray.
     * The correct ordering is: ProcessManager.start() → BrowserWindow created → createTray called.
     */
    it('ProcessManager.start() completes before BrowserWindow and Tray are created', async () => {
      await setupAndReady();

      // Verify ordering: processManager.start comes before BrowserWindow.create
      const startIdx = callOrder.indexOf('processManager.start');
      const windowIdx = callOrder.indexOf('BrowserWindow.create');
      const trayIdx = callOrder.indexOf('createTray');

      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(windowIdx).toBeGreaterThanOrEqual(0);
      expect(trayIdx).toBeGreaterThanOrEqual(0);

      // ProcessManager.start() must happen before window creation
      expect(startIdx).toBeLessThan(windowIdx);
      // Window creation must happen before tray creation
      expect(windowIdx).toBeLessThan(trayIdx);
    });

    /**
     *
     * Verifies that all components are initialized after a successful startup.
     */
    it('all components are fully initialized after successful startup', async () => {
      await setupAndReady();

      expect(pmConstructorCalled).toBe(true);
      expect(mockPMStart).toHaveBeenCalledTimes(1);
      expect(windowCreated).toBe(true);
      expect(mockCreateTray).toHaveBeenCalledTimes(1);
    });
  });

  describe('Client mode startup', () => {
    it('skips ProcessManager and loads remote URL with desktop=1', async () => {
      await setupAndReady({
        connection: {
          mode: 'client',
          serverUrl: 'http://192.168.0.20:18820',
        },
      });

      expect(pmConstructorCalled).toBe(false);
      expect(mockPMStart).not.toHaveBeenCalled();
      expect(windowCreated).toBe(true);
      expect(mockLoadURL).toHaveBeenCalledWith(
        'http://192.168.0.20:18820/?desktop=1',
      );
      expect(callOrder).not.toContain('processManager.start');
      expect(mockInitAnalysisNotifications).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          serverUrl: 'http://192.168.0.20:18820',
        }),
      );
    });

    it('quit without ProcessManager still exits cleanly', async () => {
      await setupAndReady({
        connection: {
          mode: 'client',
          serverUrl: 'http://192.168.0.20:18820',
        },
      });
      callOrder.length = 0;

      const beforeQuitHandlers: Function[] = appEventHandlers['before-quit'] ?? [];
      const mockEvent = { preventDefault: vi.fn() };
      beforeQuitHandlers[0](mockEvent);

      await vi.waitFor(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      expect(mockPMStop).not.toHaveBeenCalled();
    });
  });

  describe('Startup Failure', () => {
    /**
     *
     * When ProcessManager.start() rejects, error dialog is shown,
     * app.exit(1) is called, and no window is created.
     */
    it('ProcessManager.start() failure shows error dialog, exits, and does NOT create window', async () => {
      mockPMStart.mockImplementation(() => {
        callOrder.push('processManager.start');
        return Promise.reject(new Error('Python not found on PATH'));
      });

      gotLockReturn = true;
      const originalArgv = process.argv;
      process.argv = ['node', 'main.js'];

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      process.argv = originalArgv;

      // Error dialog shown (title follows shell locale; body always includes the spawn error)
      expect(mockShowErrorBox).toHaveBeenCalledTimes(1);
      const [title, body] = mockShowErrorBox.mock.calls[0] as [string, string];
      expect(title.length).toBeGreaterThan(0);
      expect(body).toContain('Python not found on PATH');

      // app.exit(1) called
      expect(mockExit).toHaveBeenCalledWith(1);

      // Window NOT created
      expect(windowCreated).toBe(false);
      expect(mockCreateTray).not.toHaveBeenCalled();
    });
  });

  describe('Full Quit Sequence', () => {
    /**
     *
     * Test that quit sequence calls ProcessManager.stop() then app.exit(0).
     * The correct ordering is: before-quit fires → processManager.stop() → app.exit(0).
     */
    it('before-quit triggers processManager.stop() then app.exit(0) in order', async () => {
      await setupAndReady();
      callOrder.length = 0; // Reset to track only quit sequence

      // Trigger before-quit (simulating app.quit() / Ctrl+Q)
      const beforeQuitHandlers: Function[] = appEventHandlers['before-quit'] ?? [];
      expect(beforeQuitHandlers.length).toBeGreaterThan(0);

      const mockEvent = { preventDefault: vi.fn() };
      beforeQuitHandlers[0](mockEvent);

      // preventDefault called to take over the quit flow
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Wait for async shutdown
      await vi.waitFor(() => {
        expect(mockPMStop).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      // Verify ordering: stop before exit
      const stopIdx = callOrder.indexOf('processManager.stop');
      const exitIdx = callOrder.indexOf('app.exit(0)');

      expect(stopIdx).toBeGreaterThanOrEqual(0);
      expect(exitIdx).toBeGreaterThanOrEqual(0);
      expect(stopIdx).toBeLessThan(exitIdx);
    });

    /**
     *
     * Even if processManager.stop() is slow, app.exit(0) waits for it.
     */
    it('app.exit(0) waits for processManager.stop() even if slow', async () => {
      // Make stop() take 100ms to simulate slow shutdown
      mockPMStop.mockImplementation(() => {
        callOrder.push('processManager.stop');
        return new Promise((resolve) => setTimeout(resolve, 100));
      });

      await setupAndReady();
      callOrder.length = 0;

      const beforeQuitHandlers: Function[] = appEventHandlers['before-quit'] ?? [];
      const mockEvent = { preventDefault: vi.fn() };
      beforeQuitHandlers[0](mockEvent);

      // Wait for the full sequence to complete
      await vi.waitFor(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      }, { timeout: 500 });

      // Verify ordering still correct
      const stopIdx = callOrder.indexOf('processManager.stop');
      const exitIdx = callOrder.indexOf('app.exit(0)');
      expect(stopIdx).toBeLessThan(exitIdx);
    });
  });

  describe('Close Event Keeps Process Running', () => {
    /**
     *
     * Test that close event hides window but keeps process running.
     */
    it('close event hides window and processManager.isRunning() remains true', async () => {
      await setupAndReady();

      expect(windowCloseHandler).not.toBeNull();

      const mockEvent = { preventDefault: vi.fn() };
      windowCloseHandler!(mockEvent);

      // Window is hidden (not destroyed)
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();

      // Process is still running
      expect(mockPMIsRunning()).toBe(true);

      // app.exit NOT called
      expect(mockExit).not.toHaveBeenCalled();

      // processManager.stop NOT called
      expect(mockPMStop).not.toHaveBeenCalled();
    });

    /**
     *
     * Multiple close events don't trigger any shutdown.
     */
    it('repeated close events never trigger processManager.stop()', async () => {
      await setupAndReady();

      for (let i = 0; i < 5; i++) {
        const mockEvent = { preventDefault: vi.fn() };
        windowCloseHandler!(mockEvent);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
      }

      expect(mockHide).toHaveBeenCalledTimes(5);
      expect(mockPMStop).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
      expect(mockPMIsRunning()).toBe(true);
    });
  });

  describe('Property 2: Process Lifecycle Coupling', () => {
    /**
     *
     * Property 2: For any exit scenario, if app exits then processManager.stop() is always called.
     *
     * We test this by simulating various exit triggers (quit via before-quit) and verifying
     * that processManager.stop() is always called before app.exit().
     */
    it.each([
      { closeEventsBeforeQuit: 0, stopDelayMs: 0, label: 'immediate quit, no close events' },
      { closeEventsBeforeQuit: 2, stopDelayMs: 25, label: 'close events before quit, mid delay' },
      { closeEventsBeforeQuit: 5, stopDelayMs: 50, label: 'max close events, max delay' },
    ])('quit trigger always stops before exit ($label)', async ({ closeEventsBeforeQuit, stopDelayMs }) => {
      vi.resetModules();
      vi.clearAllMocks();
      appEventHandlers = {};
      windowCloseHandler = null;
      readyToShowHandler = null;
      capturedBrowserWindowOpts = null;
      windowCreated = false;
      pmConstructorCalled = false;
      callOrder.length = 0;

      mockPMStart.mockImplementation(() => {
        callOrder.push('processManager.start');
        return Promise.resolve();
      });

      mockPMStop.mockImplementation(() => {
        callOrder.push('processManager.stop');
        return new Promise((resolve) => setTimeout(resolve, stopDelayMs));
      });

      await setupAndReady();
      callOrder.length = 0;

      for (let i = 0; i < closeEventsBeforeQuit; i++) {
        const closeHandler = windowCloseHandler as ((event: any) => void) | null | undefined;
        closeHandler?.({ preventDefault: vi.fn() });
      }

      const beforeQuitHandlers: Function[] = appEventHandlers['before-quit'] ?? [];
      expect(beforeQuitHandlers.length).toBeGreaterThan(0);

      const mockEvent = { preventDefault: vi.fn() };
      beforeQuitHandlers[0](mockEvent);

      await vi.waitFor(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      }, { timeout: 200 });

      const stopIdx = callOrder.indexOf('processManager.stop');
      const exitIdx = callOrder.indexOf('app.exit(0)');
      expect(stopIdx).toBeGreaterThanOrEqual(0);
      expect(exitIdx).toBeGreaterThanOrEqual(0);
      expect(stopIdx).toBeLessThan(exitIdx);
    });
  });

  describe('Property 4: Tray Persistence', () => {
    /**
     *
     * Property 4: For any window close event, processManager.isRunning() remains true.
     * The application process remains running, the Python subprocess remains running,
     * and only an explicit quit action terminates the application.
     */
    it.each([1, 5, 10])('for %i close events, processManager remains running', async (closeCount) => {
      vi.resetModules();
      vi.clearAllMocks();
      appEventHandlers = {};
      windowCloseHandler = null;
      readyToShowHandler = null;
      capturedBrowserWindowOpts = null;
      windowCreated = false;
      pmConstructorCalled = false;
      callOrder.length = 0;

      mockPMStart.mockImplementation(() => {
        callOrder.push('processManager.start');
        return Promise.resolve();
      });
      mockPMStop.mockImplementation(() => {
        callOrder.push('processManager.stop');
        return Promise.resolve();
      });

      await setupAndReady();

      expect(windowCloseHandler).not.toBeNull();

      for (let i = 0; i < closeCount; i++) {
        const mockEvent = { preventDefault: vi.fn() };
        windowCloseHandler!(mockEvent);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
      }

      expect(mockPMIsRunning()).toBe(true);
      expect(mockPMStop).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalledTimes(closeCount);
    });
  });
});
