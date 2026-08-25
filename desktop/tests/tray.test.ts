import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Setup ---

const mockSetToolTip = vi.fn();
const mockSetContextMenu = vi.fn();
const mockTrayOn = vi.fn();
const mockTrayDestroy = vi.fn();
const mockBuildFromTemplate = vi.fn();
const mockShowMessageBox = vi.fn<(...args: unknown[]) => Promise<{ response: number }>>(
  async () => ({ response: 1 }),
);

let trayConstructorIcon: any = null;
let capturedTemplate: any[] = [];

vi.mock('electron', () => {
  // Use a real function constructor so `new Tray(icon)` works
  function TrayMock(this: any, icon: any) {
    trayConstructorIcon = icon;
    this.setToolTip = mockSetToolTip;
    this.setContextMenu = mockSetContextMenu;
    this.setIgnoreDoubleClickEvents = vi.fn();
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
    dialog: {
      showMessageBox: (...args: unknown[]) => mockShowMessageBox(...args),
    },
  };
});

import {
  createTray,
  updateTrayStatus,
  destroyTray,
  refreshTrayLocale,
  setTrayLocalePreference,
  setTrayAnalysisState,
} from '../tray';
import { app, nativeImage } from 'electron';
import { setShellLocale, resetShellLocaleForTests } from '../shell-i18n';

// --- Helpers ---

function createMockWindow(
  options: {
    visible?: boolean;
    focused?: boolean;
    minimized?: boolean;
    destroyed?: boolean;
  } = {},
) {
  const {
    visible = true,
    focused = true,
    minimized = false,
    destroyed = false,
  } = options;
  const listeners: Record<string, Array<() => void>> = {};
  return {
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isVisible: vi.fn(() => visible),
    isFocused: vi.fn(() => focused),
    isMinimized: vi.fn(() => minimized),
    isDestroyed: vi.fn(() => destroyed),
    on: vi.fn((event: string, handler: () => void) => {
      (listeners[event] ??= []).push(handler);
    }),
    emit(event: string) {
      for (const handler of listeners[event] ?? []) handler();
    },
  } as any;
}

function invokeTrayClick(): void {
  const clickCall = mockTrayOn.mock.calls.find((call: any[]) => call[0] === 'click');
  expect(clickCall).toBeDefined();
  clickCall![1]();
}

function topLevelLabels(): string[] {
  return capturedTemplate
    .filter((item: any) => item.type !== 'separator')
    .map((item: any) => item.label);
}

function submenuFor(label: string): any[] {
  const item = capturedTemplate.find((entry: any) => entry.label === label);
  expect(item).toBeDefined();
  return item.submenu as any[];
}

async function flushDialog(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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

    it('context menu contains Show Window, language, analysis, Restart Server, Quit', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      expect(mockBuildFromTemplate).toHaveBeenCalledTimes(1);
      expect(topLevelLabels()).toEqual([
        'Show Window',
        'Interface language',
        'AI analysis',
        'Restart Server',
        'Quit',
      ]);
    });

    it('omits Restart Server when showRestartServer is false', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win, { showRestartServer: false });

      expect(topLevelLabels()).toEqual([
        'Show Window',
        'Interface language',
        'AI analysis',
        'Quit',
      ]);
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

    it('left-click hides a visible focused window to the tray', () => {
      const win = createMockWindow({ visible: true, focused: true });
      createTray('resources/icon.ico', win);

      invokeTrayClick();

      expect(win.hide).toHaveBeenCalled();
      expect(win.show).not.toHaveBeenCalled();
    });

    it('left-click shows and focuses a hidden window', () => {
      const win = createMockWindow({ visible: false, focused: false });
      createTray('resources/icon.ico', win);

      invokeTrayClick();

      expect(win.show).toHaveBeenCalled();
      expect(win.focus).toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });

    it('left-click focuses a visible unfocused window instead of hiding', () => {
      const win = createMockWindow({ visible: true, focused: false });
      createTray('resources/icon.ico', win);

      invokeTrayClick();

      expect(win.show).toHaveBeenCalled();
      expect(win.focus).toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });

    it('left-click restores a minimized window', () => {
      const win = createMockWindow({ visible: true, focused: false, minimized: true });
      createTray('resources/icon.ico', win);

      invokeTrayClick();

      expect(win.restore).toHaveBeenCalled();
      expect(win.show).toHaveBeenCalled();
      expect(win.focus).toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });

    it('left-click hides when the window just blurred (tray stole focus)', () => {
      const win = createMockWindow({ visible: true, focused: false });
      createTray('resources/icon.ico', win);
      win.emit('blur');

      invokeTrayClick();

      expect(win.hide).toHaveBeenCalled();
      expect(win.show).not.toHaveBeenCalled();
    });

    it('does not require double-click to restore the window', () => {
      const win = createMockWindow({ visible: false, focused: false });
      createTray('resources/icon.ico', win);

      const doubleClickCall = mockTrayOn.mock.calls.find(
        (call: any[]) => call[0] === 'double-click',
      );
      expect(doubleClickCall).toBeUndefined();

      invokeTrayClick();
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
      expect(topLevelLabels()).toEqual([
        '显示窗口',
        '界面语言',
        'AI 分析',
        '重新启动服务器',
        '退出',
      ]);
    });
  });

  describe('language submenu', () => {
    it('exposes auto / zh-Hant / zh-Hans / en radio items', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);

      const radios = submenuFor('Interface language');
      expect(radios.map((item) => item.label)).toEqual([
        'Auto',
        '繁體中文',
        '简体中文',
        'English',
      ]);
      expect(radios.every((item) => item.type === 'radio')).toBe(true);
      expect(radios.map((item) => item.checked)).toEqual([false, true, false, false]);
    });

    it('clicking a language radio reports the preference', () => {
      const win = createMockWindow();
      const onLocalePreference = vi.fn();
      createTray('resources/icon.ico', win, { onLocalePreference });

      const radios = submenuFor('Interface language');
      radios[0].click();
      expect(onLocalePreference).toHaveBeenCalledWith('auto');

      radios[3].click();
      expect(onLocalePreference).toHaveBeenCalledWith('en');
    });

    it('setTrayLocalePreference updates the checked radio', () => {
      const win = createMockWindow();
      createTray('resources/icon.ico', win);
      setTrayLocalePreference('en');

      const radios = submenuFor('Interface language');
      expect(radios.map((item) => item.checked)).toEqual([false, false, false, true]);
    });
  });

  describe('analysis submenu', () => {
    it('pauses and resumes via onAnalysisCommand when enabled', () => {
      const win = createMockWindow();
      const onAnalysisCommand = vi.fn();
      createTray('resources/icon.ico', win, { onAnalysisCommand });
      setTrayAnalysisState({ paused: false, enabled: true });

      const items = submenuFor('AI analysis');
      expect(items[0].label).toBe('Pause analysis');
      expect(items[0].enabled).toBe(true);
      items[0].click();
      expect(onAnalysisCommand).toHaveBeenCalledWith('pause');

      setTrayAnalysisState({ paused: true, enabled: true });
      const resumed = submenuFor('AI analysis');
      expect(resumed[0].label).toBe('Resume analysis');
      resumed[0].click();
      expect(onAnalysisCommand).toHaveBeenCalledWith('resume');
    });

    it('grays out analysis actions when not authenticated', () => {
      const win = createMockWindow();
      const onAnalysisCommand = vi.fn();
      createTray('resources/icon.ico', win, { onAnalysisCommand });

      const items = submenuFor('AI analysis');
      expect(items[0].enabled).toBe(false);
      expect(items[1].enabled).toBe(false);
      items[0].click();
      items[1].click();
      expect(onAnalysisCommand).not.toHaveBeenCalled();
      expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    it('confirms emergency abort before invoking the handler', async () => {
      const win = createMockWindow();
      const onAnalysisCommand = vi.fn();
      createTray('resources/icon.ico', win, { onAnalysisCommand });
      setTrayAnalysisState({ paused: false, enabled: true });
      mockShowMessageBox.mockResolvedValueOnce({ response: 0 });

      submenuFor('AI analysis')[1].click();
      await flushDialog();

      expect(mockShowMessageBox).toHaveBeenCalled();
      const callArgs = mockShowMessageBox.mock.calls[0] ?? [];
      const options = callArgs[callArgs.length - 1] as { buttons: string[] };
      expect(options.buttons[0]).toBe('Emergency abort');
      expect(onAnalysisCommand).toHaveBeenCalledWith('abort');
    });

    it('does not abort when the confirmation is cancelled', async () => {
      const win = createMockWindow();
      const onAnalysisCommand = vi.fn();
      createTray('resources/icon.ico', win, { onAnalysisCommand });
      setTrayAnalysisState({ paused: false, enabled: true });
      mockShowMessageBox.mockResolvedValueOnce({ response: 1 });

      submenuFor('AI analysis')[1].click();
      await flushDialog();

      expect(mockShowMessageBox).toHaveBeenCalled();
      expect(onAnalysisCommand).not.toHaveBeenCalled();
    });
  });
});
