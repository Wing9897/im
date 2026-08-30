/**
 * Product recovery dialog when the sidecar refuses a below-floor / reset-required DB.
 * User-facing copy first; traceback lives in a collapsed <details> block.
 */

import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  backupThenResetDesktopDb,
  desktopDbPath,
} from './local-db-reset';
import type { SchemaRejectKind } from './process-manager-schema';
import { SCHEMA_BASELINE_DIALOG_CHANNELS } from './schema-baseline-dialog-channels';
import { getProductName, getShellCopy } from './shell-i18n';

export type SchemaBaselineRecoveryAction = 'relaunch' | 'quit';

export type SchemaBaselineDialogCopy = {
  title: string;
  headline: string;
  body: string;
  detailsToggle: string;
  openFolder: string;
  resetAndRetry: string;
  quit: string;
};

export function schemaBaselineDialogCopy(kind: SchemaRejectKind): SchemaBaselineDialogCopy {
  const copy = getShellCopy();
  if (kind === 'future_stamp') {
    return {
      title: copy.schemaFutureStampTitle,
      headline: copy.schemaFutureStampHeadline,
      body: copy.schemaFutureStampBody,
      detailsToggle: copy.schemaDetailsToggle,
      openFolder: copy.schemaOpenFolder,
      resetAndRetry: copy.schemaResetAndRetry,
      quit: copy.schemaQuit,
    };
  }
  return {
    title: copy.schemaResetRequiredTitle,
    headline: copy.schemaResetRequiredHeadline,
    body: copy.schemaResetRequiredBody,
    detailsToggle: copy.schemaDetailsToggle,
    openFolder: copy.schemaOpenFolder,
    resetAndRetry: copy.schemaResetAndRetry,
    quit: copy.schemaQuit,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildSchemaBaselineDialogHtml(options: {
  kind: SchemaRejectKind;
  copy: SchemaBaselineDialogCopy;
  productName: string;
  technicalDetail: string;
}): string {
  const { kind, copy, productName, technicalDetail } = options;
  const detail = technicalDetail.trim() || '—';
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <title>${escapeHtml(copy.title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --text: #f4f4f5;
      --muted: #a8a8b3;
      --accent: #19c37d;
      --danger: #f87171;
      --surface: #14151a;
      --card: #1e1f26;
      --border: #3a3b45;
      --inset: #0c0c0e;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      height: 100%;
      background: var(--surface);
      color: var(--text);
      font: 14px/1.55 "Segoe UI", "Microsoft JhengHei UI", "PingFang TC", sans-serif;
    }
    body { display: flex; flex-direction: column; }
    main { flex: 1; padding: 22px 24px 8px; overflow: auto; }
    h1 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 650;
      letter-spacing: 0.01em;
    }
    .product {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 12px;
    }
    .headline { margin: 0 0 10px; font-size: 15px; font-weight: 600; }
    .body { margin: 0 0 16px; color: var(--muted); white-space: pre-line; }
    details {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--inset);
      padding: 0;
    }
    summary {
      cursor: pointer;
      padding: 8px 12px;
      color: var(--muted);
      font-size: 13px;
      user-select: none;
    }
    pre {
      margin: 0;
      padding: 0 12px 12px;
      max-height: 180px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font: 11px/1.45 ui-monospace, "Cascadia Code", Consolas, monospace;
      color: #d4d4d8;
    }
    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 24px 18px;
      border-top: 1px solid var(--border);
      background: var(--card);
    }
    button {
      appearance: none;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      font: inherit;
      padding: 8px 14px;
      cursor: pointer;
    }
    button:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
    button.primary {
      background: var(--accent);
      border-color: transparent;
      color: #052e16;
      font-weight: 650;
    }
    button.danger {
      background: #7f1d1d;
      border-color: transparent;
      color: #fff;
      font-weight: 650;
    }
    button.danger:hover { background: #991b1b; }
  </style>
</head>
<body data-kind="${escapeHtml(kind)}">
  <main>
    <p class="product">${escapeHtml(productName)}</p>
    <h1>${escapeHtml(copy.title)}</h1>
    <p class="headline">${escapeHtml(copy.headline)}</p>
    <p class="body">${escapeHtml(copy.body)}</p>
    <details>
      <summary>${escapeHtml(copy.detailsToggle)}</summary>
      <pre id="technical-detail">${escapeHtml(detail)}</pre>
    </details>
  </main>
  <footer>
    <button type="button" id="btn-open" style="margin-right:auto">${escapeHtml(copy.openFolder)}</button>
    <button type="button" id="btn-quit">${escapeHtml(copy.quit)}</button>
    <button type="button" id="btn-reset" class="${kind === 'future_stamp' ? 'danger' : 'primary'}">${escapeHtml(copy.resetAndRetry)}</button>
  </footer>
</body>
</html>`;
}

function revealDesktopDataFolder(dataDir: string): void {
  const dbPath = desktopDbPath(dataDir);
  if (fs.existsSync(dbPath)) {
    shell.showItemInFolder(dbPath);
    return;
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  void shell.openPath(dataDir);
}

async function confirmReset(win: BrowserWindow): Promise<boolean> {
  const copy = getShellCopy();
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [copy.schemaResetConfirm, copy.schemaResetCancel],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: copy.schemaResetConfirmTitle,
    message: copy.schemaResetConfirmTitle,
    detail: copy.schemaResetConfirmBody,
  };
  const result = win.isDestroyed()
    ? await dialog.showMessageBox(options)
    : await dialog.showMessageBox(win, options);
  return result.response === 0;
}

export async function presentSchemaBaselineRecovery(options: {
  kind: SchemaRejectKind;
  technicalDetail: string;
  dataDir: string;
}): Promise<SchemaBaselineRecoveryAction> {
  const copy = schemaBaselineDialogCopy(options.kind);
  const html = buildSchemaBaselineDialogHtml({
    kind: options.kind,
    copy,
    productName: getProductName(),
    technicalDetail: options.technicalDetail,
  });

  const preloadPath = path.join(__dirname, 'schema-baseline-dialog-preload.js');
  const win = new BrowserWindow({
    width: 560,
    height: 460,
    minWidth: 440,
    minHeight: 360,
    show: false,
    autoHideMenuBar: true,
    title: copy.title,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  return new Promise<SchemaBaselineRecoveryAction>((resolve) => {
    let settled = false;
    const finish = (action: SchemaBaselineRecoveryAction): void => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler(SCHEMA_BASELINE_DIALOG_CHANNELS.openFolder);
      ipcMain.removeHandler(SCHEMA_BASELINE_DIALOG_CHANNELS.reset);
      ipcMain.removeHandler(SCHEMA_BASELINE_DIALOG_CHANNELS.quit);
      if (!win.isDestroyed()) win.close();
      resolve(action);
    };

    ipcMain.handle(SCHEMA_BASELINE_DIALOG_CHANNELS.openFolder, () => {
      revealDesktopDataFolder(options.dataDir);
    });

    ipcMain.handle(SCHEMA_BASELINE_DIALOG_CHANNELS.reset, async () => {
      const confirmed = await confirmReset(win);
      if (!confirmed) return { ok: false as const, cancelled: true };
      const result = backupThenResetDesktopDb(options.dataDir);
      if (!result.ok) {
        const shellCopy = getShellCopy();
        dialog.showMessageBox(win, {
          type: 'error',
          title: shellCopy.schemaResetFailedTitle,
          message: shellCopy.schemaResetFailedTitle,
          detail: `${shellCopy.schemaResetFailedBody}\n\n${result.error}`,
        });
        return { ok: false as const, cancelled: false };
      }
      const done = getShellCopy();
      await dialog.showMessageBox(win, {
        type: 'info',
        title: done.schemaResetDoneTitle,
        message: done.schemaResetDoneTitle,
        detail: done.schemaResetDoneBody,
        buttons: [done.schemaRelaunch],
        defaultId: 0,
        noLink: true,
      });
      finish('relaunch');
      return { ok: true as const };
    });

    ipcMain.handle(SCHEMA_BASELINE_DIALOG_CHANNELS.quit, () => {
      finish('quit');
    });

    win.on('closed', () => finish('quit'));
    win.once('ready-to-show', () => {
      win.center();
      win.show();
    });
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}
