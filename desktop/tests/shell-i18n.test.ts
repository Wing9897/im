import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTrayTooltip,
  getProductName,
  getShellCopy,
  getShellLocale,
  normalizeShellLocale,
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
  });

  it('includes analysis notification copy', () => {
    expect(getShellCopy('zh-Hant').analysisCompleted).toBe('分析完成');
    expect(getShellCopy('zh-Hans').analysisFailed).toBe('分析失败');
    expect(getShellCopy('en').unknownError).toBe('Unknown error');
  });
});
