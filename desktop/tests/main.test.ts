import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock State ---

let appEventHandlers: Record<string, Function[]> = {};
let gotLockReturn = true;
let processArgv: string[] = [];

// Track calls for assertions
const mockQuit = vi.fn();
const mockExit = vi.fn();
const mockWhenReady = vi.fn();
const mockRequestSingleInstanceLock = vi.fn(() => gotLockReturn);
const mockRegister = vi.fn();
const mockUnregisterAll = vi.fn();
const mockIpcMainHandle = vi.fn();
const mockIpcMainOn = vi.fn();
const mockIpcMainRemoveHandler = vi.fn();
const mockIpcMainRemoveAllListeners = vi.fn();

// BrowserWindow mock state
const mockShow = vi.fn();
const mockCenter = vi.fn();
const mockHide = vi.fn();
const mockFocus = vi.fn();
const mockRestore = vi.fn();
const mockIsMinimized = vi.fn(() => false);
const mockLoadURL = vi.fn();
const mockOnce = vi.fn();
const mockWinOn = vi.fn();
const mockWebContents = {
  on: vi.fn(),
  once: vi.fn(),
  openDevTools: vi.fn(),
  setWindowOpenHandler: vi.fn(),
};

let windowCloseHandler: ((event: any) => void) | null = null;
let readyToShowHandler: (() => void) | null = null;
let capturedBrowserWindowOpts: any = null;

// ProcessManager mock
const mockPMStart = vi.fn().mockResolvedValue(undefined);
const mockPMStop = vi.fn().mockResolvedValue(undefined);
let pmConstructorCalled = false;
let pmConstructorOpts: any = null;

// Tray mock
const mockCreateTray = vi.fn();
const mockDestroyTray = vi.fn();

// Paths mock
const mockResolveFrontendDistPath = vi.fn(() => '/project/web/dist');
const mockResolveServerCwd = vi.fn(() => '/project/server');
const mockValidatePaths = vi.fn();

// Connection mock (default host — matches missing connection.json)
let mockConnectionConfig: { mode: 'host' | 'client'; serverUrl?: string } = {
  mode: 'host',
};
const mockLoadConnection = vi.fn(() => ({ ...mockConnectionConfig }));
const mockInitAnalysisNotifications = vi.fn();

// --- Electron Mock ---

vi.mock('electron', () => {
  const BrowserWindowMock = vi.fn(function (this: any, opts: any) {
    capturedBrowserWindowOpts = opts;
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
      mockOnce(event, handler);
    });
    this.on = vi.fn((event: string, handler: Function) => {
      if (event === 'close') {
        windowCloseHandler = handler as (event: any) => void;
      }
      mockWinOn(event, handler);
    });
    this.isMaximized = vi.fn(() => false);
    this.isDestroyed = vi.fn(() => false);
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
    globalShortcut: {
      register: mockRegister,
      unregisterAll: mockUnregisterAll,
    },
    ipcMain: {
      handle: mockIpcMainHandle,
      on: mockIpcMainOn,
      removeHandler: mockIpcMainRemoveHandler,
      removeAllListeners: mockIpcMainRemoveAllListeners,
    },
    dialog: {
      showErrorBox: vi.fn(),
    },
    Notification: class {
      static isSupported = () => false;
      show = vi.fn();
    },
  };
});

vi.mock('../connection', async () => {
  const actual = await vi.importActual<typeof import('../connection')>('../connection');
  return {
    ...actual,
    loadConnection: () => mockLoadConnection(),
    saveConnection: vi.fn((_ud: string, config: typeof mockConnectionConfig) => {
      mockConnectionConfig = { ...config };
      return { ...mockConnectionConfig };
    }),
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
    pmConstructorOpts = opts;
    this.start = mockPMStart;
    this.stop = mockPMStop;
    this.isRunning = vi.fn(() => true);
    this.onUnexpectedExit = vi.fn();
    return this;
  }),
}));

vi.mock('../tray', () => ({
  createTray: mockCreateTray,
  destroyTray: mockDestroyTray,
  updateTrayStatus: vi.fn(),
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

// --- Helper to import main.ts with controlled state ---

async function importMain(options: { gotLock?: boolean; devMode?: boolean } = {}) {
  gotLockReturn = options.gotLock ?? true;

  // Mock process.argv for --dev flag detection
  const originalArgv = process.argv;
  if (options.devMode) {
    process.argv = ['node', 'main.js', '--dev'];
  } else {
    process.argv = ['node', 'main.js'];
  }

  // Setup whenReady to capture the handleAppReady call
  let readyResolve: () => void;
  const readyPromise = new Promise<void>((resolve) => { readyResolve = resolve; });
  mockWhenReady.mockReturnValue({ then: (cb: Function) => { cb(); return readyPromise; } });

  await vi.importActual('../main');

  process.argv = originalArgv;
}

// --- Tests ---

describe('Main Process', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    appEventHandlers = {};
    gotLockReturn = true;
    windowCloseHandler = null;
    readyToShowHandler = null;
    capturedBrowserWindowOpts = null;
    pmConstructorCalled = false;
    pmConstructorOpts = null;
    mockConnectionConfig = { mode: 'host' };
    mockLoadConnection.mockImplementation(() => ({ ...mockConnectionConfig }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Single Instance Lock (Requirement 1.1, 1.2)', () => {
    it('when lock is not acquired, app.quit() is called', async () => {
      gotLockReturn = false;

      // Import main module — triggers module-level code
      mockWhenReady.mockReturnValue({ then: vi.fn() });
      await vi.importActual('../main');

      expect(mockRequestSingleInstanceLock).toHaveBeenCalled();
      expect(mockQuit).toHaveBeenCalled();
    });

    it('when second-instance event fires, existing window is shown and focused', async () => {
      gotLockReturn = true;

      // Configure whenReady to execute the ready handler
      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');

      // Execute the ready handler to create the window
      if (readyHandler) await (readyHandler as Function)();

      // Fire second-instance event
      const secondInstanceHandlers = appEventHandlers['second-instance'] || [];
      expect(secondInstanceHandlers.length).toBeGreaterThan(0);

      secondInstanceHandlers.forEach((handler) => handler());

      expect(mockShow).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('when second-instance fires and window is minimized, it is restored', async () => {
      gotLockReturn = true;
      mockIsMinimized.mockReturnValue(true);

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      const secondInstanceHandlers = appEventHandlers['second-instance'] || [];
      secondInstanceHandlers.forEach((handler) => handler());

      expect(mockRestore).toHaveBeenCalled();
      expect(mockShow).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('Window Creation (Requirements 4.1-4.5, 11.1-11.3)', () => {
    it('BrowserWindow is created with correct dimensions and webPreferences', async () => {
      gotLockReturn = true;

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(capturedBrowserWindowOpts).not.toBeNull();
      expect(capturedBrowserWindowOpts.width).toBe(1280);
      expect(capturedBrowserWindowOpts.height).toBe(800);
      expect(capturedBrowserWindowOpts.minWidth).toBe(900);
      expect(capturedBrowserWindowOpts.minHeight).toBe(600);
      expect(capturedBrowserWindowOpts.show).toBe(false);
      expect(capturedBrowserWindowOpts.frame).toBe(false);
      expect(capturedBrowserWindowOpts.autoHideMenuBar).toBe(true);
      expect(capturedBrowserWindowOpts.webPreferences.preload).toContain('preload.js');
      expect(capturedBrowserWindowOpts.webPreferences.contextIsolation).toBe(true);
      expect(capturedBrowserWindowOpts.webPreferences.nodeIntegration).toBe(false);
      expect(mockWebContents.setWindowOpenHandler).toHaveBeenCalled();
    });

    it('ready-to-show event loads URL and shows window', async () => {
      gotLockReturn = true;

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      // Simulate ready-to-show
      expect(readyToShowHandler).not.toBeNull();
      readyToShowHandler!();

      expect(mockLoadURL).toHaveBeenCalledWith('http://localhost:18820/?desktop=1');
      expect(mockCenter).toHaveBeenCalled();
      expect(mockShow).toHaveBeenCalled();
      expect(mockCenter.mock.invocationCallOrder[0]).toBeLessThan(
        mockShow.mock.invocationCallOrder[0],
      );
    });
  });

  describe('Close Event — Hide to Tray (Requirements 6.1, 6.2)', () => {
    it('event.preventDefault() is called and window is hidden', async () => {
      gotLockReturn = true;

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(windowCloseHandler).not.toBeNull();

      const mockEvent = { preventDefault: vi.fn() };
      windowCloseHandler!(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();
    });
  });

  describe('Quit Sequence (Requirements 7.4, 7.5)', () => {
    it('before-quit sets isQuitting, calls processManager.stop(), then app.exit(0)', async () => {
      gotLockReturn = true;

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      // Get the before-quit handler
      const beforeQuitHandlers = appEventHandlers['before-quit'] || [];
      expect(beforeQuitHandlers.length).toBeGreaterThan(0);

      const mockEvent = { preventDefault: vi.fn() };
      beforeQuitHandlers[0](mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Wait for async shutdown
      await vi.waitFor(() => {
        expect(mockPMStop).toHaveBeenCalled();
      });

      await vi.waitFor(() => {
        expect(mockExit).toHaveBeenCalledWith(0);
      });
    });

    it('Ctrl+Q global shortcut is registered', async () => {
      gotLockReturn = true;

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+Q', expect.any(Function));
    });

    it('when isQuitting is true, close event does NOT preventDefault', async () => {
      gotLockReturn = true;

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      // First, trigger before-quit to set isQuitting = true
      const beforeQuitHandlers = appEventHandlers['before-quit'] || [];
      const mockBQEvent = { preventDefault: vi.fn() };
      beforeQuitHandlers[0](mockBQEvent);

      // Now trigger close event — should NOT call preventDefault
      const mockCloseEvent = { preventDefault: vi.fn() };
      windowCloseHandler!(mockCloseEvent);

      expect(mockCloseEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Dev Mode (Requirements 8.1, 8.4)', () => {
    it('with --dev flag, ProcessManager is NOT started', async () => {
      gotLockReturn = true;

      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--dev'];

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(pmConstructorCalled).toBe(false);
      expect(mockPMStart).not.toHaveBeenCalled();

      process.argv = originalArgv;
    });

    it('with --dev flag, close event calls app.quit() instead of hiding to tray', async () => {
      gotLockReturn = true;

      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--dev'];

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(windowCloseHandler).not.toBeNull();

      const mockEvent = { preventDefault: vi.fn() };
      windowCloseHandler!(mockEvent);

      expect(mockQuit).toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockHide).not.toHaveBeenCalled();

      process.argv = originalArgv;
    });

    it('with --dev flag, createTray is called with showRestartServer false', async () => {
      gotLockReturn = true;

      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--dev'];

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(mockCreateTray).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ showRestartServer: false }),
      );

      process.argv = originalArgv;
    });

    it('without --dev flag, ProcessManager IS started', async () => {
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

      expect(pmConstructorCalled).toBe(true);
      expect(mockPMStart).toHaveBeenCalled();

      process.argv = originalArgv;
    });
  });

  describe('Property 1: Single Instance Lock', () => {
    /**
     *
     * For any launch attempt while an instance exists, the new instance is rejected.
     * When lock cannot be acquired, app.quit() is called and no subprocess spawning occurs.
     */
    it('when lock is not acquired, app.quit() is called and no ProcessManager is created', async () => {
      gotLockReturn = false;
      mockWhenReady.mockReturnValue({ then: vi.fn() });

      await vi.importActual('../main');

      expect(mockRequestSingleInstanceLock).toHaveBeenCalled();
      expect(mockQuit).toHaveBeenCalled();
      expect(pmConstructorCalled).toBe(false);
    });

    /**
     *
     * For any launch where lock IS acquired, the app does not quit and
     * whenReady is called to proceed with setup.
     */
    it.each([
      { hasMinimizedWindow: false, label: 'normal window' },
      { hasMinimizedWindow: true, label: 'minimized window' },
    ])('when lock IS acquired ($label), app does not quit and readies', async ({ hasMinimizedWindow }) => {
      vi.resetModules();
      vi.clearAllMocks();
      appEventHandlers = {};
      capturedBrowserWindowOpts = null;

      gotLockReturn = true;
      mockIsMinimized.mockReturnValue(hasMinimizedWindow);

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(mockQuit).not.toHaveBeenCalled();
      expect(capturedBrowserWindowOpts).not.toBeNull();

      const secondInstanceHandlers = appEventHandlers['second-instance'] || [];
      if (secondInstanceHandlers.length > 0) {
        secondInstanceHandlers[0]();
        expect(mockShow).toHaveBeenCalled();
        expect(mockFocus).toHaveBeenCalled();
        if (hasMinimizedWindow) {
          expect(mockRestore).toHaveBeenCalled();
        }
      }
    });
  });

  describe('Property 4: Tray Persistence', () => {
    /**
     *
     * For any close event, the app process remains running.
     * The window is hidden but not destroyed, and quit is not called.
     */
    it.each([1, 5, 10])('for %i close event(s), the application does not quit', async (closeCount) => {
      vi.resetModules();
      vi.clearAllMocks();
      appEventHandlers = {};
      windowCloseHandler = null;

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

      expect(windowCloseHandler).not.toBeNull();

      for (let i = 0; i < closeCount; i++) {
        const mockEvent = { preventDefault: vi.fn() };
        windowCloseHandler!(mockEvent);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
      }

      expect(mockHide).toHaveBeenCalledTimes(closeCount);
      expect(mockQuit).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();

      process.argv = originalArgv;
    });
  });

  describe('Connection mode: host vs client', () => {
    async function readyWithConnection(
      connection: { mode: 'host' | 'client'; serverUrl?: string },
      options: { devMode?: boolean } = {},
    ): Promise<void> {
      mockConnectionConfig = { ...connection };
      gotLockReturn = true;

      const originalArgv = process.argv;
      process.argv = options.devMode
        ? ['node', 'main.js', '--dev']
        : ['node', 'main.js'];

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

    it('host (default): starts ProcessManager and loads localhost', async () => {
      await readyWithConnection({ mode: 'host' });

      expect(pmConstructorCalled).toBe(true);
      expect(mockPMStart).toHaveBeenCalled();
      expect(mockLoadURL).toHaveBeenCalledWith('http://localhost:18820/?desktop=1');
      expect(mockInitAnalysisNotifications).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ serverUrl: 'http://localhost:18820' }),
      );
      expect(mockCreateTray).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ showRestartServer: true }),
      );
    });

    it('client: does NOT start ProcessManager; loadURL uses remote serverUrl', async () => {
      await readyWithConnection({
        mode: 'client',
        serverUrl: 'http://192.168.1.50:18820',
      });

      expect(pmConstructorCalled).toBe(false);
      expect(mockPMStart).not.toHaveBeenCalled();
      expect(mockLoadURL).toHaveBeenCalledWith(
        'http://192.168.1.50:18820/?desktop=1',
      );
      expect(mockInitAnalysisNotifications).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ serverUrl: 'http://192.168.1.50:18820' }),
      );
      expect(mockCreateTray).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ showRestartServer: false }),
      );
    });

    it('client + --dev: still skips ProcessManager and loads remote URL', async () => {
      await readyWithConnection(
        { mode: 'client', serverUrl: 'http://10.0.0.9:18820' },
        { devMode: true },
      );

      expect(pmConstructorCalled).toBe(false);
      expect(mockLoadURL).toHaveBeenCalledWith('http://10.0.0.9:18820/?desktop=1');
    });
  });

  describe('Property 7: Dev/Prod Mode Isolation', () => {
    /**
     *
     * For any launch with the --dev flag, ProcessManager.start() is skipped
     * (no subprocess spawned), health check polling is skipped.
     */
    it.each([
      { extraArgs: [] as string[], label: 'no extra args' },
      { extraArgs: ['--verbose'], label: 'with --verbose' },
      { extraArgs: ['--debug', '--port=3000'], label: 'with multiple args' },
    ])('dev mode launch ($label) never instantiates ProcessManager', async ({ extraArgs }) => {
      vi.resetModules();
      vi.clearAllMocks();
      appEventHandlers = {};
      pmConstructorCalled = false;
      capturedBrowserWindowOpts = null;

      gotLockReturn = true;

      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--dev', ...extraArgs];

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(pmConstructorCalled).toBe(false);
      expect(mockPMStart).not.toHaveBeenCalled();
      expect(capturedBrowserWindowOpts).not.toBeNull();

      process.argv = originalArgv;
    });

    /**
     *
     * For any launch WITHOUT --dev flag, ProcessManager IS created and started.
     */
    it.each([
      { extraArgs: [] as string[], label: 'no extra args' },
      { extraArgs: ['--verbose'], label: 'with --verbose' },
      { extraArgs: ['--debug', '--port=3000'], label: 'with multiple args' },
    ])('prod mode launch ($label) instantiates and starts ProcessManager', async ({ extraArgs }) => {
      vi.resetModules();
      vi.clearAllMocks();
      appEventHandlers = {};
      pmConstructorCalled = false;
      capturedBrowserWindowOpts = null;

      gotLockReturn = true;

      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', ...extraArgs];

      let readyHandler: Function | null = null;
      mockWhenReady.mockReturnValue({
        then: (cb: Function) => {
          readyHandler = cb;
          return Promise.resolve();
        },
      });

      await vi.importActual('../main');
      if (readyHandler) await (readyHandler as Function)();

      expect(pmConstructorCalled).toBe(true);
      expect(mockPMStart).toHaveBeenCalled();

      process.argv = originalArgv;
    });
  });
});
