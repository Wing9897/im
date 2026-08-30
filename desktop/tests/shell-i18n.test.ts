import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTrayTooltip,
  getProductName,
  getShellCopy,
  getShellLocale,
  isShellLocalePreference,
  normalizeShellLocale,
  normalizeShellLocalePreference,
  onShellLocaleChange,
  resetShellLocaleForTests,
  setShellLocale,
} from '../shell-i18n';

describe('shell-i18n', () => {
  beforeEach(() => {
    resetShellLocaleForTests();
  });

  it('normalizes known locales and falls back to zh-Hant', () => {
    expect(normalizeShellLocale('en')).toBe('en');
    expect(normalizeShellLocale('zh-Hans')).toBe('zh-Hans');
    expect(normalizeShellLocale('zh-Hant')).toBe('zh-Hant');
    expect(normalizeShellLocale('fr')).toBe('zh-Hant');
    expect(normalizeShellLocale(null)).toBe('zh-Hant');
    expect(isShellLocalePreference('auto')).toBe(true);
    expect(isShellLocalePreference('en')).toBe(true);
    expect(isShellLocalePreference('fr')).toBe(false);
    expect(normalizeShellLocalePreference('auto')).toBe('auto');
    expect(normalizeShellLocalePreference('nope')).toBe('zh-Hant');
  });

  it('keeps product name English', () => {
    expect(getProductName()).toBe('Intelligence Monitor');
  });

  it('formats tray tooltips per locale', () => {
    expect(formatTrayTooltip('Running', 'en')).toBe('Intelligence Monitor - Running');
    expect(formatTrayTooltip('Stopped', 'zh-Hant')).toBe('Intelligence Monitor - 已停止');
    expect(formatTrayTooltip('Error', 'zh-Hans')).toBe('Intelligence Monitor - 错误');
  });

  it('notifies listeners when locale changes', () => {
    const seen: string[] = [];
    const unsub = onShellLocaleChange(() => {
      seen.push(getShellLocale());
    });
    setShellLocale('en');
    setShellLocale('en'); // no-op
    setShellLocale('zh-Hans');
    unsub();
    setShellLocale('zh-Hant');
    expect(seen).toEqual(['en', 'zh-Hans']);
    expect(getShellCopy('en').showWindow).toBe('Show Window');
    expect(getShellCopy('zh-Hant').showWindow).toBe('顯示視窗');
    expect(getShellCopy('zh-Hant').languageMenu).toBe('介面語言');
    expect(getShellCopy('zh-Hans').languageAuto).toBe('自动');
    expect(getShellCopy('en').pauseAnalysis).toBe('Pause analysis');
    expect(getShellCopy('zh-Hant').emergencyAbort).toBe('緊急中止…');
    expect(getShellCopy('zh-Hant').schemaResetAndRetry).toBe('重置資料庫');
    expect(getShellCopy('zh-Hant').schemaRelaunch).toBe('重新啟動');
    expect(getShellCopy('zh-Hans').schemaDetailsToggle).toBe('详细资料');
    expect(getShellCopy('en').schemaOpenFolder).toBe('Open folder');
  });

  it('includes analysis notification copy', () => {
    expect(getShellCopy('zh-Hant').analysisCompleted).toBe('分析完成');
    expect(getShellCopy('zh-Hans').analysisFailed).toBe('分析失败');
    expect(getShellCopy('en').unknownError).toBe('Unknown error');
  });
});
