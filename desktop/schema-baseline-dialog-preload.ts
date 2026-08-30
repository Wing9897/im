import { ipcRenderer } from 'electron';

// Keep preload self-contained — sandboxed preload cannot require sibling modules.
const SCHEMA_BASELINE_DIALOG_CHANNELS = {
  openFolder: 'schema-baseline-dialog:open-folder',
  reset: 'schema-baseline-dialog:reset',
  quit: 'schema-baseline-dialog:quit',
} as const;

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open')?.addEventListener('click', () => {
    void ipcRenderer.invoke(SCHEMA_BASELINE_DIALOG_CHANNELS.openFolder);
  });
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    void ipcRenderer.invoke(SCHEMA_BASELINE_DIALOG_CHANNELS.reset);
  });
  document.getElementById('btn-quit')?.addEventListener('click', () => {
    void ipcRenderer.invoke(SCHEMA_BASELINE_DIALOG_CHANNELS.quit);
  });
});
