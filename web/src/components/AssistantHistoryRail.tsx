import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ASSISTANT_SESSIONS_CHANGED_EVENT,
  createEmptySession,
  deleteSession,
  getActiveSessionId,
  hydrateAssistantSessions,
  listSessions,
  setActiveSessionId,
  type AssistantSession,
} from "../domain/assistant/assistantSessions";
import { getDateTimeLocale } from "../i18n/locale";

function formatSessionTime(updatedAt: number): string {
  try {
    return new Intl.DateTimeFormat(getDateTimeLocale(), {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(updatedAt));
  } catch {
    return "";
  }
}

/**
 * Sidebar history rail: assistant sessions (SQLite via ui-prefs; deletable).
 */
export function AssistantHistoryRail({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation("assistant");
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AssistantSession[]>(() => listSessions());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveSessionId());

  const refresh = useCallback(() => {
    setSessions(listSessions());
    setActiveId(getActiveSessionId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateAssistantSessions().then(() => {
      if (!cancelled) refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(ASSISTANT_SESSIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ASSISTANT_SESSIONS_CHANGED_EVENT, onChange);
  }, [refresh]);

  const openAssistant = useCallback(() => {
    navigate("/assistant");
  }, [navigate]);

  const onNewSession = useCallback(() => {
    createEmptySession();
    openAssistant();
  }, [openAssistant]);

  const onSelect = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      openAssistant();
    },
    [openAssistant],
  );

  const onDelete = useCallback((id: string, e: MouseEvent) => {
    e.stopPropagation();
    deleteSession(id);
  }, []);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-0.5"
      data-testid="assistant-history-rail"
      aria-label={t("history.aria")}
    >
      <button
        type="button"
        className={[
          "group relative flex min-h-8 cursor-pointer flex-row items-center rounded-md border border-transparent text-[12px] font-medium leading-tight text-text-secondary transition-[background,color] duration-150 ease-out",
          collapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-2.5 py-1.5",
          "hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
        ].join(" ")}
        onClick={onNewSession}
        aria-label={t("history.new")}
        title={t("history.new")}
        data-testid="assistant-history-new"
      >
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        {!collapsed ? (
          <span className="truncate max-[780px]:hidden">{t("history.new")}</span>
        ) : null}
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sessions.length === 0 ? (
          !collapsed ? (
            <p
              className="px-2.5 py-2 text-[11px] leading-snug text-text-muted max-[780px]:hidden"
              data-testid="assistant-history-empty"
            >
              {t("history.empty")}
            </p>
          ) : null
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeId;
            return (
              <div
                key={session.id}
                className={[
                  "group relative flex min-h-8 items-center rounded-md border border-transparent text-[12px] leading-tight",
                  collapsed ? "justify-center px-0 py-1.5" : "gap-1 px-1.5 py-1",
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] text-text-primary"
                    : "text-text-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
                ].join(" ")}
              >
                <button
                  type="button"
                  className={[
                    "flex min-w-0 flex-1 items-center border-none bg-transparent text-left text-inherit",
                    collapsed ? "justify-center px-0" : "gap-2 px-1 py-0.5",
                  ].join(" ")}
                  onClick={() => onSelect(session.id)}
                  aria-label={session.title}
                  title={`${session.title} · ${formatSessionTime(session.updatedAt)}`}
                  data-testid="assistant-history-item"
                  data-session-id={session.id}
                >
                  {collapsed ? (
                    <span
                      className={[
                        "inline-flex h-2 w-2 shrink-0 rounded-full",
                        isActive ? "bg-accent" : "bg-text-muted",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 max-[780px]:hidden">
                      <span className="truncate font-medium">{session.title}</span>
                      <span className="truncate text-[10px] text-text-muted">
                        {formatSessionTime(session.updatedAt)}
                      </span>
                    </span>
                  )}
                </button>
                {!collapsed ? (
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-muted opacity-0 hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] hover:text-text-primary group-hover:opacity-100 max-[780px]:hidden"
                    onClick={(e) => onDelete(session.id, e)}
                    aria-label={t("history.deleteAria", { title: session.title })}
                    title={t("history.delete")}
                    data-testid="assistant-history-delete"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
