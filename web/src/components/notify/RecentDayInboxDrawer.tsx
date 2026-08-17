import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { OverlayPortal } from "../common/OverlayPortal";
import { Button } from "../ui";
import { useRecentInbox } from "../../hooks/useRecentInbox";
import { NotifyChannelToggles } from "./NotifyChannelToggles";

function formatWhen(iso: string, remindAtMs: number): string {
  const ms = Date.parse(iso);
  const value = Number.isFinite(ms) ? ms : remindAtMs;
  if (!Number.isFinite(value)) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

/** Shell right drawer: rolling 24h of announced reminders. Does not sit on the timeline grid. */
export function RecentDayInboxDrawer() {
  const { t } = useTranslation("common");
  const { entries, open, setOpen, dismissEntry, clearAll } = useRecentInbox();

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[1500] flex justify-end bg-[color-mix(in_srgb,var(--surface-base)_35%,transparent)]"
        data-testid="recent-day-inbox-overlay"
        onClick={() => setOpen(false)}
      >
        <aside
          className="im-dialog-drawer im-material-panel relative flex h-full w-[min(360px,calc(100vw-24px))] flex-col border-l border-surface-border"
          data-testid="recent-day-inbox"
          role="dialog"
          aria-label={t("notify.inboxTitle")}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between gap-sm border-b border-surface-border px-md py-sm">
            <h2 className="m-0 text-body font-semibold text-text-primary">
              {t("notify.inboxTitle")}
            </h2>
            <div className="flex shrink-0 items-center gap-xs">
              <NotifyChannelToggles variant="labeled" testIdPrefix="drawer" />
              <button
                type="button"
                className="im-icon-btn"
                aria-label={t("notify.inboxCloseAria")}
                data-testid="recent-day-inbox-close"
                onClick={() => setOpen(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </header>
          {entries.length > 0 ? (
            <div
              className="flex items-center justify-end border-b border-surface-border px-md py-xs"
              data-testid="recent-day-inbox-toolbar"
            >
              <Button
                size="sm"
                variant="secondary"
                aria-label={t("notify.inboxClearAllAria")}
                data-testid="recent-day-inbox-clear-all"
                onClick={() => clearAll()}
              >
                {t("notify.inboxClearAll")}
              </Button>
            </div>
          ) : null}
          <div className="im-auto-scrollbar min-h-0 flex-1 overflow-y-auto px-md py-sm">
            {entries.length === 0 ? (
              <p className="m-0 text-caption text-text-muted">{t("notify.inboxEmpty")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-sm p-0">
                {entries.map((row) => (
                  <li
                    key={row.dedupeKey}
                    className="rounded-md border border-surface-border/70 px-sm py-sm"
                    data-testid={`recent-day-inbox-item-${row.eventId}`}
                  >
                    <div className="flex items-start justify-between gap-sm">
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-body text-text-primary">{row.title}</p>
                        <p className="m-0 text-caption text-text-muted">
                          {formatWhen(row.startTime, row.remindAtMs)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("notify.inboxClearAria")}
                        data-testid="recent-day-inbox-item-clear"
                        onClick={() => dismissEntry(row.dedupeKey)}
                      >
                        {t("notify.inboxClear")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </OverlayPortal>
  );
}
