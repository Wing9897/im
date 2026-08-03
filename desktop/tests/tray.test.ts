import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Setup ---

const mockSetToolTip = vi.fn();
const mockSetContextMenu = vi.fn();
const mockTrayOn = vi.fn();
const mockTrayDestroy = vi.fn();
const mockBuildFromTemplate = vi.fn();

let trayConstructorIcon: any = null;
let capturedTemplate: any[] = [];

vi.mock('electron', () => {
  // Use a real function constructor so `new Tray(icon)` works
  function TrayMock(this: any, icon: any) {
    trayConstructorIcon = icon;
    this.setToolTip = mockSetToolTip;
    this.setContextMenu = mockSetContextMenu;
    this.on = mockTrayOn;
    this.destroy = mockTrayDestroy;
  }

  return {
    Tray: TrayMock,
    Menu: {
      buildFromTemplate: vi.fn((template: any[]) => {
        capturedTemplate = template;
        mockBuildFromTemplate(template);
        return { items: template };
      }),
    },
    nativeImage: {
      createFromPath: vi.fn((path: string) => ({ path, _isMockImage: true })),
    },
    app: {
      quit: vi.fn(),
    },
    BrowserWindow: vi.fn(),
  };
});

import { createTray, updateTrayStatus, destroyTray, refreshTrayLocale } from '../tray';
import { app, nativeImage } from 'electron';
import { setShellLocale, resetShellLocaleForTests } from '../shell-i18n';

// --- Helpers ---

function createMockWindow() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
  } as any;
}

// --- Tests ---

describe('Tray Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trayConstructorIcon = null;
    capturedTemplate = [];
    // Reset module-level tray state by calling destroyTray
    destroyTray();
    resetShellLocaleForTests();
    setShellLocale('en');
    vi.clearAllMocks();
  });

  describe('createTray', () => {
    it('creates a Tray with the correct icon path', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      expect(nativeImage.createFromPath).toHaveBeenCalledWith('resources/icon.ico');
      expect(trayConstructorIcon).toEqual({ path: 'resources/icon.ico', _isMockImage: true });
    });

    it('sets initial tooltip to "Intelligence Monitor - Stopped"', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - Stopped');
    });

    it('context menu contains items: Show Window, Restart Server, Quit', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      expect(mockBuildFromTemplate).toHaveBeenCalledTimes(1);

      // Find meaningful menu items (skip separators)
      const labels = capturedTemplate
        .filter((item: any) => item.type !== 'separator')
        .map((item: any) => item.label);

      expect(labels).toEqual(['Show Window', 'Restart Server', 'Quit']);
    });

    it('omits Restart Server when showRestartServer is false', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win, { showRestartServer: false });

      const labels = capturedTemplate
        .filter((item: any) => item.type !== 'separator')
        .map((item: any) => item.label);

      expect(labels).toEqual(['Show Window', 'Quit']);
    });

    it('"Show Window" menu item click calls win.show() and win.focus()', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      const showItem = capturedTemplate.find((item: any) => item.label === 'Show Window');
      expect(showItem).toBeDefined();

      showItem.click();

      expect(win.show).toHaveBeenCalled();
      expect(win.focus).toHaveBeenCalled();
    });

    it('"Restart Server" menu item click calls the onRestartServer handler', () => {
      const win = createMockWindow();
      const mockRestart = vi.fn();
      createTray('resources/icon.ico', win, { onRestartServer: mockRestart });

      const restartItem = capturedTemplate.find((item: any) => item.label === 'Restart Server');
      expect(restartItem).toBeDefined();

      restartItem.click();

      expect(mockRestart).toHaveBeenCalled();
    });

    it('"Restart Server" does not throw when no handler is provided', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      const restartItem = capturedTemplate.find((item: any) => item.label === 'Restart Server');
      expect(restartItem).toBeDefined();

      // Should not throw even without a handler
      expect(() => restartItem.click()).not.toThrow();
    });

    it('"Quit" menu item click calls app.quit()', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      const quitItem = capturedTemplate.find((item: any) => item.label === 'Quit');
      expect(quitItem).toBeDefined();

      quitItem.click();

      expect(app.quit).toHaveBeenCalled();
    });

    it('double-click on tray icon shows and focuses window', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      // Find the 'double-click' event registration
      const doubleClickCall = mockTrayOn.mock.calls.find(
        (call: any[]) => call[0] === 'double-click'
      );
      expect(doubleClickCall).toBeDefined();

      // Invoke the double-click handler
      const handler = doubleClickCall![1];
      handler();

      expect(win.show).toHaveBeenCalled();
      expect(win.focus).toHaveBeenCalled();
    });
  });

  describe('updateTrayStatus', () => {
    it('updates tooltip to show "Running" status', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      vi.clearAllMocks();

      updateTrayStatus('Running');

      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - Running');
    });

    it('updates tooltip to show "Stopped" status', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      vi.clearAllMocks();

      updateTrayStatus('Stopped');

      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - Stopped');
    });

    it('updates tooltip to show "Error" status', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      vi.clearAllMocks();

      updateTrayStatus('Error');

      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - Error');
    });

    it('updates tooltip immediately when called (synchronous update)', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      vi.clearAllMocks();

      // This verifies that calling updateTrayStatus immediately updates the tooltip
      // (no timer, no debounce — ensures < 3 second latency)
      updateTrayStatus('Running');

      expect(mockSetToolTip).toHaveBeenCalledTimes(1);
      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - Running');
    });

    it('does not throw when tray is not created', () => {
      // destroyTray was already called in beforeEach
      expect(() => updateTrayStatus('Running')).not.toThrow();
    });
  });

  describe('destroyTray', () => {
    it('destroys the tray instance', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      destroyTray();

      expect(mockTrayDestroy).toHaveBeenCalled();
    });

    it('does not throw when called without a tray', () => {
      expect(() => destroyTray()).not.toThrow();
    });

    it('resets status state after destroy', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      updateTrayStatus('Running');
      destroyTray();
      vi.clearAllMocks();

      // Create a new tray — should start with default "Stopped" tooltip
      createTray('resources/icon.ico', win);
      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - Stopped');
    });
  });

  describe('locale switching', () => {
    it('rebuilds tooltip and menu labels when locale changes', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      vi.clearAllMocks();

      setShellLocale('zh-Hans');
      refreshTrayLocale();

      expect(mockSetToolTip).toHaveBeenCalledWith('Intelligence Monitor - 已停止');
      const labels = capturedTemplate
        .filter((item: any) => item.type !== 'separator')
        .map((item: any) => item.label);
      expect(labels).toEqual(['显示窗口', '重新启动服务器', '退出']);
    });
  });
});
