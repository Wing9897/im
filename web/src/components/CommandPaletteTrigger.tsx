import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommandPalette } from "../hooks/useCommandPalette";

interface CommandPaletteTriggerProps {
  compact?: boolean;
}

/** Opens the global command palette — bind to Cmd/Ctrl+K in provider. */
export function CommandPaletteTrigger({ compact = false }: CommandPaletteTriggerProps) {
  const { t } = useTranslation("common");
  const { openPalette } = useCommandPalette();
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcut = isMac ? "⌘K" : "Ctrl+K";
  const triggerAria = t("commandPalette.triggerAria", { shortcut });

  return (
    <button
      type="button"
      className={compact ? "im-command-trigger im-command-trigger--compact" : "im-command-trigger"}
      onClick={openPalette}
      aria-label={triggerAria}
      title={triggerAria}
    >
      <Search size={14} strokeWidth={2} aria-hidden="true" />
      {!compact ? <span className="hidden sm:inline">{t("commandPalette.triggerLabel")}</span> : null}
      {!compact ? <kbd className="im-command-kbd">{shortcut}</kbd> : null}
    </button>
  );
}
