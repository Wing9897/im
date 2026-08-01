import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Setup ---

const mockSetApplicationMenu = vi.fn();
const mockBuildFromTemplate = vi.fn();

let capturedTemplate: any[] = [];

vi.mock('electron', () => {
  return {
    Menu: {
      buildFromTemplate: vi.fn((template: any[]) => {
        capturedTemplate = template;
        mockBuildFromTemplate(template);
        return { items: template };
      }),
      setApplicationMenu: vi.fn((menu: any) => {
        mockSetApplicationMenu(menu);
      }),
    },
  };
});

import { buildApplicationMenu, refreshApplicationMenu, MenuConfig } from '../menu';
import { setShellLocale, resetShellLocaleForTests } from '../shell-i18n';

// --- Tests ---

describe('Menu Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedTemplate = [];
    resetShellLocaleForTests();
    setShellLocale('en');
  });

  describe('buildApplicationMenu', () => {
    /**
     * **Validates: Requirements 2.1**
     */
    it('creates a menu with Edit, View, and Window menus on non-macOS', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      buildApplicationMenu(config);

      const topLabels = capturedTemplate.map((item: any) => item.label);
      expect(topLabels).toEqual(['Edit', 'View', 'Window']);
    });

    /**
     * **Validates: Requirements 2.2**
     */
    it('Edit menu contains Undo, Redo, Cut, Copy, Paste, Select All', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      buildApplicationMenu(config);

      const editMenu = capturedTemplate.find((item: any) => item.label === 'Edit');
      expect(editMenu).toBeDefined();

      const submenu = editMenu.submenu as any[];
      const roles = submenu
        .filter((item: any) => item.role)
        .map((item: any) => item.role);

      expect(roles).toContain('undo');
      expect(roles).toContain('redo');
      expect(roles).toContain('cut');
      expect(roles).toContain('copy');
      expect(roles).toContain('paste');
      expect(roles).toContain('selectAll');
    });

    /**
     * **Validates: Requirements 2.3**
     */
    it('View menu contains Reload, Toggle DevTools, Zoom In, Zoom Out, Reset Zoom', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      buildApplicationMenu(config);

      const viewMenu = capturedTemplate.find((item: any) => item.label === 'View');
      expect(viewMenu).toBeDefined();

      const submenu = viewMenu.submenu as any[];
      const roles = submenu
        .filter((item: any) => item.role)
        .map((item: any) => item.role);

      expect(roles).toContain('reload');
      expect(roles).toContain('toggleDevTools');
      expect(roles).toContain('zoomIn');
      expect(roles).toContain('zoomOut');
      expect(roles).toContain('resetZoom');
    });

    /**
     * **Validates: Requirements 2.4**
     */
    it('Window menu contains Minimize and Close', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      buildApplicationMenu(config);

      const windowMenu = capturedTemplate.find((item: any) => item.label === 'Window');
      expect(windowMenu).toBeDefined();

      const submenu = windowMenu.submenu as any[];
      const roles = submenu
        .filter((item: any) => item.role)
        .map((item: any) => item.role);

      expect(roles).toContain('minimize');
      expect(roles).toContain('close');
    });

    /**
     * **Validates: Requirements 2.5**
     */
    it('on macOS, prepends an app menu with About and Quit', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: true };
      buildApplicationMenu(config);

      const topLabels = capturedTemplate.map((item: any) => item.label);
      expect(topLabels).toEqual(['Intelligence Monitor', 'Edit', 'View', 'Window']);

      const appMenu = capturedTemplate[0];
      expect(appMenu.label).toBe('Intelligence Monitor');

      const submenu = appMenu.submenu as any[];
      const roles = submenu
        .filter((item: any) => item.role)
        .map((item: any) => item.role);

      expect(roles).toContain('about');
      expect(roles).toContain('quit');
    });

    /**
     * **Validates: Requirements 2.5**
     */
    it('on non-macOS, does NOT include an app menu', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      buildApplicationMenu(config);

      const topLabels = capturedTemplate.map((item: any) => item.label);
      expect(topLabels).not.toContain('Intelligence Monitor');
    });

    /**
     * **Validates: Requirements 2.1**
     */
    it('calls Menu.buildFromTemplate and Menu.setApplicationMenu', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      const result = buildApplicationMenu(config);

      expect(mockBuildFromTemplate).toHaveBeenCalledTimes(1);
      expect(mockSetApplicationMenu).toHaveBeenCalledTimes(1);
      expect(mockSetApplicationMenu).toHaveBeenCalledWith(result);
    });

    /**
     * **Validates: Requirements 2.5**
     */
    it('macOS app menu uses the provided appName as label', () => {
      const config: MenuConfig = { appName: 'Custom App Name', isMac: true };
      buildApplicationMenu(config);

      const appMenu = capturedTemplate[0];
      expect(appMenu.label).toBe('Custom App Name');
    });

    it('rebuilds section titles when locale changes', () => {
      const config: MenuConfig = { appName: 'Intelligence Monitor', isMac: false };
      buildApplicationMenu(config);
      vi.clearAllMocks();

      setShellLocale('zh-Hant');
      refreshApplicationMenu();

      const topLabels = capturedTemplate.map((item: any) => item.label);
      expect(topLabels).toEqual(['編輯', '檢視', '視窗']);
    });
  });
});
