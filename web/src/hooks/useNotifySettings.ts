import { useEffect, useState } from "react";
import {
  NOTIFY_SETTINGS_CHANGED_EVENT,
  hydrateNotifySettings,
  loadNotifySettings,
  saveNotifySettings,
  type NotifySettings,
} from "../domain/notify/scanner/settings";

/**
 * Hydrate local-notify settings and stay in sync with same-tab CustomEvents.
 * Shared by the notifications page and shell channel toggles.
 */
export function useNotifySettings() {
  const [settings, setSettings] = useState<NotifySettings>(() => loadNotifySettings());

  useEffect(() => {
    let cancelled = false;
    void hydrateNotifySettings().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
      }
    });
    const sync = () => {
      if (!cancelled) {
        setSettings(loadNotifySettings());
      }
    };
    window.addEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, sync);
    };
  }, []);

  return {
    settings,
    setSettings,
    load: loadNotifySettings,
    save: saveNotifySettings,
  };
}
