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

describe('Main Process lifecycle', () => {
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

  describe('Quit Sequence', () => {
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

  describe('Dev Mode', () => {
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
});
