import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  NOTIFY_FLASH_CHANGED_EVENT,
  NOTIFY_FLASH_DURATION_MS,
  dismissNotifyFlash,
  loadNotifyFlashes,
  type NotifyFlashItem,
} from "../../domain/notify/notifyFlash";
import {
  NOTIFY_SETTINGS_CHANGED_EVENT,
  loadNotifySettings,
} from "../../domain/notify/scanner/settings";
import { isElectronDesktop } from "../../electron/electronWindow";

/**
 * Dedicated full-width top reminder bar. Not ToastContext —
 * operational save/error toasts stay on their own z-[2000] corner stack.
 * Electron: sits below the title bar so window controls stay clickable.
 * One bar max; a new reminder replaces the current one.
 */
export function NotifyFlashHost() {
  const { t } = useTranslation("common");
  const [items, setItems] = useState<NotifyFlashItem[]>(() => loadNotifyFlashes());
  const [flashEnabled, setFlashEnabled] = useState(
    () => loadNotifySettings().flashEnabled,
  );
  const desktopShell = isElectronDesktop();

  useEffect(() => {
    const syncFlashes = () => setItems(loadNotifyFlashes());
    const syncSettings = () => setFlashEnabled(loadNotifySettings().flashEnabled);
    window.addEventListener(NOTIFY_FLASH_CHANGED_EVENT, syncFlashes);
    window.addEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, syncSettings);
    return () => {
      window.removeEventListener(NOTIFY_FLASH_CHANGED_EVENT, syncFlashes);
      window.removeEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, syncSettings);
    };
  }, []);

  const item = items.at(-1);
  if (!flashEnabled || !item) {
    return null;
  }

  const positionClass = desktopShell
    ? "fixed left-0 right-0 top-[var(--desktop-title-bar-height)] z-[1900]"
    : "fixed left-0 right-0 top-0 z-[1900]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`im-notify-flash-stack pointer-events-none w-full ${positionClass}`}
      data-testid="notify-flash-stack"
      data-desktop-offset={desktopShell ? "true" : "false"}
    >
      <div
        key={item.id}
        className="im-toast-in im-notify-flash-item im-surface-panel pointer-events-auto relative flex w-full items-start gap-md overflow-hidden border-b border-accent px-lg py-md text-left shadow-[0_8px_24px_rgba(0,0,0,0.3)] [-webkit-app-region:no-drag]"
        data-testid="notify-flash-item"
        data-flash-persist={item.persist ? "true" : "false"}
      >
        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center text-accent" aria-hidden="true">
          <Bell size={14} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-body leading-normal text-text-primary">
          {item.text}
        </span>
        <button
          type="button"
          className="im-icon-btn shrink-0"
          aria-label={t("notify.flashDismissAria")}
          data-testid="notify-flash-dismiss"
          onClick={() => dismissNotifyFlash(item.id)}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
        {!item.persist ? (
          <span
            className="im-notify-flash-fuse pointer-events-none absolute inset-x-0 bottom-0"
            data-testid="notify-flash-fuse"
            aria-hidden="true"
            style={{ animationDuration: `${NOTIFY_FLASH_DURATION_MS}ms` }}
          />
        ) : null}
      </div>
    </div>
  );
}
