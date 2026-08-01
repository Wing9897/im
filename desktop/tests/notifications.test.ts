import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock Setup ---

const mockNotificationShow = vi.fn();
let notificationConstructorArgs: any = null;
let mockIsSupported = true;

vi.mock('electron', () => {
  return {
    Notification: Object.assign(
      function (this: any, options: any) {
        notificationConstructorArgs = options;
        this.show = mockNotificationShow;
        this.on = vi.fn();
      },
      {
        isSupported: () => mockIsSupported,
      }
    ),
    BrowserWindow: vi.fn(),
  };
});

// Mock http to avoid Node built-in resolution issues in vitest
vi.mock('node:http', () => ({
  default: {
    get: vi.fn(() => ({
      on: vi.fn(),
      destroy: vi.fn(),
    })),
  },
}));

import {
  initAnalysisNotifications,
  setAnalysisNotificationAuth,
  setAnalysisNotificationLocale,
  stopAnalysisNotifications,
  showCompletedNotification,
  showFailedNotification,
  handleSseMessage,
  isWindowVisibleAndFocused,
} from '../notifications';
import { resetShellLocaleForTests } from '../shell-i18n';

// --- Helpers ---

function createMockWindow(options: { visible?: boolean; focused?: boolean; destroyed?: boolean } = {}) {
  const { visible = false, focused = false, destroyed = false } = options;
  return {
    isVisible: vi.fn(() => visible),
    isFocused: vi.fn(() => focused),
    isDestroyed: vi.fn(() => destroyed),
  } as any;
}

// --- Tests ---

describe('Notifications Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationConstructorArgs = null;
    mockIsSupported = true;
    resetShellLocaleForTests();
    // Reset module state (stop restores defaults, including enabled=true)
    stopAnalysisNotifications();
  });

  afterEach(() => {
    stopAnalysisNotifications();
    resetShellLocaleForTests();
  });

  describe('isWindowVisibleAndFocused', () => {
    /**
     * **Validates: Requirements 5.3**
     */
    it('returns false when no window is set', () => {
      expect(isWindowVisibleAndFocused()).toBe(false);
    });

    /**
     * **Validates: Requirements 5.3**
     */
    it('returns false when window is destroyed', () => {
      const win = createMockWindow({ destroyed: true });
      initAnalysisNotifications(win, { enabled: false });
      expect(isWindowVisibleAndFocused()).toBe(false);
    });

    /**
     * **Validates: Requirements 5.3**
     */
    it('returns false when window is visible but not focused', () => {
      const win = createMockWindow({ visible: true, focused: false });
      initAnalysisNotifications(win, { enabled: false });
      expect(isWindowVisibleAndFocused()).toBe(false);
    });

    /**
     * **Validates: Requirements 5.3**
     */
    it('returns false when window is focused but not visible', () => {
      const win = createMockWindow({ visible: false, focused: true });
      initAnalysisNotifications(win, { enabled: false });
      expect(isWindowVisibleAndFocused()).toBe(false);
    });

    /**
     * **Validates: Requirements 5.3**
     */
    it('returns true when window is both visible and focused', () => {
      const win = createMockWindow({ visible: true, focused: true });
      initAnalysisNotifications(win, { enabled: false });
      expect(isWindowVisibleAndFocused()).toBe(true);
    });
  });

  describe('showCompletedNotification', () => {
    /**
     * **Validates: Requirements 5.1**
     */
    it('shows notification with task name and 分析完成 message', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Telegram 頻道分析',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      expect(notificationConstructorArgs.title).toBe('Intelligence Monitor');
      expect(notificationConstructorArgs.body).toBe('Telegram 頻道分析 — 分析完成');
    });

    it('follows UI locale for notification copy', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true, locale: 'en' });

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Market watch',
        batchId: 'batch-1',
      });

      expect(notificationConstructorArgs.body).toBe('Market watch — Analysis completed');

      setAnalysisNotificationLocale('zh-Hans');
      showFailedNotification({
        taskId: 'task-1',
        taskName: 'Market watch',
        batchId: 'batch-1',
        error: '',
      });
      expect(notificationConstructorArgs.body).toBe('Market watch — 分析失败: 未知错误');
    });

    /**
     * **Validates: Requirements 5.1**
     */
    it('falls back to taskId when taskName is not provided', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      showCompletedNotification({
        taskId: 'task-123',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      expect(notificationConstructorArgs.body).toBe('task-123 — 分析完成');
    });

    /**
     * **Validates: Requirements 5.3**
     */
    it('suppresses notification when window is visible and focused', () => {
      const win = createMockWindow({ visible: true, focused: true });
      initAnalysisNotifications(win, { enabled: true });

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Test Task',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    /**
     * **Validates: Requirements 5.4**
     */
    it('suppresses notification when notifications are disabled', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: false });

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Test Task',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it('does not show notification when Notification API is not supported', () => {
      mockIsSupported = false;
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Test Task',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });
  });

  describe('showFailedNotification', () => {
    /**
     * **Validates: Requirements 5.2**
     */
    it('shows notification with task name and failure reason', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      showFailedNotification({
        taskId: 'task-1',
        taskName: 'Discord 分析',
        batchId: 'batch-1',
        error: 'LLM connection timeout',
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      expect(notificationConstructorArgs.title).toBe('Intelligence Monitor');
      expect(notificationConstructorArgs.body).toBe('Discord 分析 — 分析失敗: LLM connection timeout');
    });

    /**
     * **Validates: Requirements 5.2**
     */
    it('truncates long error messages', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      const longError = 'A'.repeat(100);
      showFailedNotification({
        taskId: 'task-1',
        taskName: 'Test',
        batchId: 'batch-1',
        error: longError,
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      const body: string = notificationConstructorArgs.body;
      expect(body).toContain('...');
      // Verify truncated: original error was 100 chars, truncated to 77+...
      expect(body).toContain('AAA...');
    });

    /**
     * **Validates: Requirements 5.2**
     */
    it('uses "未知錯誤" when error message is empty', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      showFailedNotification({
        taskId: 'task-1',
        taskName: 'Test Task',
        batchId: 'batch-1',
        error: '',
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      expect(notificationConstructorArgs.body).toBe('Test Task — 分析失敗: 未知錯誤');
    });

    /**
     * **Validates: Requirements 5.3**
     */
    it('suppresses notification when window is visible and focused', () => {
      const win = createMockWindow({ visible: true, focused: true });
      initAnalysisNotifications(win, { enabled: true });

      showFailedNotification({
        taskId: 'task-1',
        taskName: 'Test',
        batchId: 'batch-1',
        error: 'timeout',
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    /**
     * **Validates: Requirements 5.4**
     */
    it('suppresses notification when notifications are disabled', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: false });

      showFailedNotification({
        taskId: 'task-1',
        taskName: 'Test',
        batchId: 'batch-1',
        error: 'error',
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });
  });

  describe('handleSseMessage', () => {
    /**
     * **Validates: Requirements 5.1**
     */
    it('dispatches analysis_completed event to showCompletedNotification', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      handleSseMessage({
        event: 'analysis_completed',
        data: JSON.stringify({
          type: 'analysis_completed',
          payload: { taskId: 'task-1', taskName: 'My Task', batchId: 'batch-1' },
        }),
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      expect(notificationConstructorArgs.body).toBe('My Task — 分析完成');
    });

    /**
     * **Validates: Requirements 5.2**
     */
    it('dispatches analysis_failed event to showFailedNotification', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      handleSseMessage({
        event: 'analysis_failed',
        data: JSON.stringify({
          type: 'analysis_failed',
          payload: { taskId: 'task-2', taskName: 'RSS Task', batchId: 'batch-2', error: 'Network timeout' },
        }),
      });

      expect(mockNotificationShow).toHaveBeenCalled();
      expect(notificationConstructorArgs.body).toBe('RSS Task — 分析失敗: Network timeout');
    });

    it('ignores unrelated event types', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      handleSseMessage({
        event: 'messages_updated',
        data: JSON.stringify({ type: 'messages_updated', payload: {} }),
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it('gracefully handles invalid JSON data', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });

      // Should not throw
      expect(() =>
        handleSseMessage({
          event: 'analysis_completed',
          data: 'invalid-json{{{',
        })
      ).not.toThrow();

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });
  });

  describe('initAnalysisNotifications', () => {
    it('suppresses notifications when initialized with enabled: false', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: false });

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Test',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it('defaults enabled to true when not specified', () => {
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, {});

      showCompletedNotification({
        taskId: 'task-1',
        taskName: 'Test',
        batchId: 'batch-1',
      });

      expect(mockNotificationShow).toHaveBeenCalled();
    });

    it('does not open SSE without an access token (avoids 401 storms)', async () => {
      const http = await import('node:http');
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });
      expect(http.default.get).not.toHaveBeenCalled();
    });

    it('opens SSE with Authorization when access token is set', async () => {
      const http = await import('node:http');
      const win = createMockWindow({ visible: false, focused: false });
      initAnalysisNotifications(win, { enabled: true });
      setAnalysisNotificationAuth('device-access-token');
      expect(http.default.get).toHaveBeenCalled();
      const opts = vi.mocked(http.default.get).mock.calls.at(-1)?.[0] as {
        headers?: Record<string, string>;
        path?: string;
      };
      expect(opts.path).toBe('/api/v1/events');
      expect(opts.headers?.Authorization).toBe('Bearer device-access-token');
    });
  });

  describe('stopAnalysisNotifications', () => {
    it('resets window reference (isWindowVisibleAndFocused returns false)', () => {
      const win = createMockWindow({ visible: true, focused: true });
      initAnalysisNotifications(win, { enabled: false });
      expect(isWindowVisibleAndFocused()).toBe(true);

      stopAnalysisNotifications();
      expect(isWindowVisibleAndFocused()).toBe(false);
    });

    it('does not throw when called without initialization', () => {
      expect(() => stopAnalysisNotifications()).not.toThrow();
    });
  });
});
