import { useTranslation } from "react-i18next";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { ModalDialog } from "./ModalDialog";
import { Button } from "./ui";

const SHORTCUT_KEYS = [
  ["Cmd/Ctrl+K", "commandPalette"],
  ["Cmd/Ctrl+J", "quickAssistant"],
  ["Space", "holdToTalk"],
  ["/", "focusSearch"],
  ["j/k", "listNav"],
  ["Enter", "openItem"],
  ["Esc", "closePanel"],
] as const;

export function ShortcutHelpDialog() {
  const { t } = useTranslation("common");
  const { shortcutHelpOpen, closeShortcutHelp } = useCommandPalette();

  return (
    <ModalDialog
      open={shortcutHelpOpen}
      title={t("shortcuts.title")}
      onClose={closeShortcutHelp}
      footer={
        <Button variant="secondary" size="sm" onClick={closeShortcutHelp}>
          {t("dialog.close")}
        </Button>
      }
    >
      <dl className="m-0 flex flex-col gap-sm">
        {SHORTCUT_KEYS.map(([shortcut, key]) => (
          <div
            key={shortcut}
            className="flex items-center justify-between gap-lg rounded-md border border-surface-border px-sm py-xs"
          >
            <dt className="text-body text-text-secondary">{t(`shortcuts.${key}`)}</dt>
            <dd className="m-0">
              <kbd className="im-command-kbd">{shortcut}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </ModalDialog>
  );
}
