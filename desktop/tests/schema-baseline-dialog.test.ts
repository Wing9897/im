import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  dialog: { showMessageBox: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

import {
  buildSchemaBaselineDialogHtml,
  escapeHtml,
  schemaBaselineDialogCopy,
} from '../schema-baseline-dialog';
import { getShellCopy, resetShellLocaleForTests, setShellLocale } from '../shell-i18n';

const TRACE = `Traceback (most recent call last):
SchemaBaselineError: Unsupported database schema version 2; floor 6
`;

describe('schema-baseline-dialog copy and html', () => {
  beforeEach(() => {
    resetShellLocaleForTests();
  });
  it('keeps the traceback out of the visible product copy', () => {
    resetShellLocaleForTests();
    const copy = schemaBaselineDialogCopy('reset_required');
    expect(copy.title).toBe('無法使用此資料庫');
    expect(copy.headline).toContain('無法原地升級');
    expect(copy.body).toContain('不會遷移');
    expect(copy.body).not.toMatch(/Traceback|SchemaBaselineError|reset_local_databases/);
    expect(copy.resetAndRetry).toBe('重置資料庫並重試');
    expect(copy.detailsToggle).toBe('詳細資料');
    expect(copy.openFolder).toBe('開啟資料夾');
  });

  it('puts technical detail only inside collapsed details', () => {
    resetShellLocaleForTests();
    const html = buildSchemaBaselineDialogHtml({
      kind: 'reset_required',
      copy: schemaBaselineDialogCopy('reset_required'),
      productName: 'Intelligence Monitor',
      technicalDetail: TRACE,
    });
    const [beforeDetails, detailsAndAfter] = html.split('<details>');
    expect(beforeDetails).not.toContain('Traceback');
    expect(beforeDetails).not.toContain('SchemaBaselineError');
    expect(beforeDetails).toContain('無法使用此資料庫');
    expect(detailsAndAfter).toContain('詳細資料');
    expect(detailsAndAfter).toContain(escapeHtml(TRACE.trim()));
    expect(html).toContain('data-kind="reset_required"');
    expect(html).toContain('btn-reset');
    expect(html).toContain('btn-open');
  });

  it('localizes English product copy', () => {
    resetShellLocaleForTests();
    setShellLocale('en');
    const copy = schemaBaselineDialogCopy('reset_required');
    expect(copy.title).toBe('This database cannot be used');
    expect(copy.resetAndRetry).toBe('Reset database and retry');
    expect(getShellCopy().schemaResetConfirm).toBe('Back up and reset');
  });
});
