import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  fetchSetupDevices,
  logoutDeviceSession,
  revokeSetupDevice,
  type SetupDevice,
} from "../../../api/setup";
import { Button, FormStack, SettingsRow } from "../../../components/ui";
import { formHelpClass, sectionTitleClass } from "../../../components/ui/pageTypography";
import {
  clearConnection,
  hasDeviceSession,
  subscribeConnection,
} from "../../../domain/connection/connectionStore";
import { resetDesktopConnectionAfterLogout } from "../../../electron/electronConnection";
import { useToast } from "../../../context/ToastContext";
import { toErrorMessage } from "../../../utils/errors";

interface AccountDeviceSessionSectionProps {
  onLoggedOut?: () => void;
}

export function AccountDeviceSessionSection({
  onLoggedOut,
}: AccountDeviceSessionSectionProps) {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [devices, setDevices] = useState<SetupDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const reload = useCallback(async () => {
    if (!hasDeviceSession()) {
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDevices(await fetchSetupDevices());
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // New or refreshed device sessions update the list.
  useEffect(() => {
    return subscribeConnection(() => {
      if (hasDeviceSession()) {
        void reload();
      }
    });
  }, [reload]);

  const formatExpires = (iso: string): string => {
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return iso;
    try {
      return new Date(parsed).toLocaleString();
    } catch {
      return iso;
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await revokeSetupDevice(id);
      await reload();
      showToast(t("account.devices.revoked"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      try {
        await logoutDeviceSession();
      } catch {
        /* still clear local session */
      }
      // Finish Desktop client→host reset before clearing the session so
      // session_lost / authGate cannot race restartShell.
      try {
        await resetDesktopConnectionAfterLogout();
      } catch (error) {
        showToast(toErrorMessage(error), "error");
      }
      clearConnection();
      showToast(t("account.devices.loggedOut"), "success");
      onLoggedOut?.();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <section id="device-session" data-testid="profile-device-session">
      <FormStack gap="lg">
        <div>
          <h2 className={`${sectionTitleClass} m-0`}>{t("account.devices.title")}</h2>
          <p className={`mb-0 mt-xs max-w-[56ch] ${formHelpClass}`}>
            {t("account.devices.intro")}
          </p>
        </div>

        <div>
          <p className={`${sectionTitleClass} m-0 mb-sm`}>{t("account.devices.listTitle")}</p>
          {loading ? (
            <p className={`${formHelpClass} mb-0`}>{t("ui.loading")}</p>
          ) : devices.length === 0 ? (
            <p className={`${formHelpClass} mb-0`} data-testid="devices-empty">
              {t("account.devices.empty")}
            </p>
          ) : (
            <ul className="m-0 max-w-[480px] list-none space-y-xs p-0">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between gap-sm rounded-md border border-surface-border px-sm py-xs"
                  data-testid={`device-row-${device.id}`}
                >
                  <span className="min-w-0 text-body">
                    <span className="font-medium">{device.label}</span>
                    {device.current ? (
                      <span className="ml-sm text-caption text-accent">
                        {t("account.devices.current")}
                      </span>
                    ) : null}
                    {device.lastSeenAt ? (
                      <span className="mt-0.5 block text-caption text-text-muted">
                        {t("account.devices.lastSeen", {
                          time: formatExpires(device.lastSeenAt),
                        })}
                      </span>
                    ) : null}
                  </span>
                  {!device.current ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={t("account.devices.revokeAria", { label: device.label })}
                      onClick={() => void onRevoke(device.id)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <SettingsRow label={t("account.devices.logoutLabel")} help={t("account.devices.logoutHelp")}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loggingOut}
            onClick={() => void onLogout()}
            data-testid="device-logout"
          >
            {loggingOut ? t("account.devices.loggingOut") : t("account.devices.logout")}
          </Button>
        </SettingsRow>
      </FormStack>
    </section>
  );
}
