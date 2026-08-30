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
      showMessageBox: vi.fn().mockResolvedValue({ response: 1 }),
    },
    shell: {
      showItemInFolder: vi.fn(),
      openPath: vi.fn().mockResolvedValue(''),
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

describe('Main Process connection mode', () => {
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
