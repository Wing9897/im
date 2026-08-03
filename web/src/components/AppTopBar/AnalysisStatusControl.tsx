import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { colorStatusDotStyle } from "../../styles/statusDot";
import { logWarn } from "../../utils/logger";

function StatusDotLabel({
  color,
  label,
  pulse,
}: {
  color: string;
  label: string;
  pulse?: boolean;
}) {
  return (
    <>
      <span
        style={colorStatusDotStyle(color)}
        className={pulse ? "im-pulse-dot" : undefined}
        aria-hidden="true"
      />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-secondary">
        {label}
      </span>
    </>
  );
}

interface AnalysisStatusControlProps {
  color: string;
  label: string;
  title: string;
  pulse?: boolean;
  analysisPaused: boolean;
  busy: boolean;
  disabled?: boolean;
  abortingAnalysis: boolean;
  onTogglePause: () => void;
  onEmergencyAbort: () => Promise<void>;
}

/**
 * Top-bar AI status pill — same chrome as the original status chip.
 * Click toggles pause; hover reveals a chevron; menu portals to body
 * so title-bar overflow cannot clip the emergency abort item.
 */
export function AnalysisStatusControl({
  color,
  label,
  title,
  pulse,
  analysisPaused,
  busy,
  disabled = false,
  abortingAnalysis,
  onTogglePause,
  onEmergencyAbort,
}: AnalysisStatusControlProps) {
  const { t } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);
  const [abortConfirmOpen, setAbortConfirmOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const interactive = !disabled && !busy;

  useLayoutEffect(() => {
    if (!menuOpen || !rootRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? 140;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setMenuPos({ top: rect.bottom + 6, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const pauseLabel = busy
    ? t("topBar.busy")
    : disabled
      ? t("topBar.controlsUnavailable")
      : analysisPaused
        ? t("topBar.clickResume")
        : t("topBar.clickPause");

  const pillTitle = interactive
    ? t("topBar.pillTitle", { title, pauseHint: pauseLabel })
    : busy
      ? t("topBar.pillTitleBusy", { title, pauseHint: pauseLabel })
      : t("topBar.pillTitleDisabled", { title });

  const handleConfirmAbort = async () => {
    setAbortConfirmOpen(false);
    setMenuOpen(false);
    try {
      await onEmergencyAbort();
    } catch (e) {
      logWarn("[AnalysisStatusControl] onEmergencyAbort error", e);
    }
  };

  const chevronSlotClass = [
    "grid transition-[grid-template-columns] duration-150 ease-out",
    menuOpen
      ? "grid-cols-[1fr]"
      : "grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr]",
  ].join(" ");

  const menu =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={t("topBar.analysisControl")}
            data-testid="system-status-menu"
            className="fixed z-[3000] m-0 min-w-[140px] list-none rounded-lg border-0 bg-[color-mix(in_srgb,var(--surface-raised,var(--surface-card))_96%,transparent)] p-1 shadow-[0_10px_28px_color-mix(in_srgb,var(--text-primary)_22%,transparent)] outline-none backdrop-blur-md"
            style={
              menuPos
                ? { top: menuPos.top, left: menuPos.left }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
          >
            <li role="none">
              <button
                type="button"
                role="menuitem"
                data-testid="emergency-abort-button"
                disabled={busy || disabled}
                className="flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-error outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--error)_14%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--error)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setMenuOpen(false);
                  setAbortConfirmOpen(true);
                }}
              >
                {abortingAnalysis ? t("topBar.aborting") : t("topBar.emergencyAbort")}
              </button>
            </li>
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className="group relative inline-flex max-w-[260px] min-w-0"
        data-testid="analysis-status-control"
      >
        <div
          className="ui-status-pill inline-flex max-w-full min-w-0 items-stretch rounded-full text-xs"
          style={{
            ["--pill-color" as string]: color,
            background: "color-mix(in srgb, var(--pill-color) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pill-color) 32%, transparent)",
          }}
          title={pillTitle}
        >
          <button
            type="button"
            data-testid="system-status-pill"
            aria-label={
              interactive
                ? t("topBar.pillAria", { label, pauseHint: pauseLabel })
                : t("topBar.pillAriaDisabled", { label })
            }
            disabled={!interactive}
            onClick={() => {
              if (!interactive) return;
              setMenuOpen(false);
              onTogglePause();
            }}
            className={`inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full border-0 bg-transparent py-[3px] pl-2.5 pr-2 outline-none transition-colors focus-visible:outline-none ${
              interactive
                ? "cursor-pointer hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)]"
                : "cursor-not-allowed opacity-70"
            }`}
          >
            <StatusDotLabel color={color} label={label} pulse={pulse} />
          </button>

          <div className={chevronSlotClass}>
            <div className="min-w-0 overflow-hidden">
              <button
                type="button"
                data-testid="system-status-menu-trigger"
                aria-label={t("topBar.analysisControlMenu")}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                disabled={disabled || busy}
                onClick={(event) => {
                  event.stopPropagation();
                  if (disabled || busy) return;
                  setMenuOpen((open) => !open);
                }}
                className={`flex h-full items-center rounded-full border-0 bg-transparent px-1.5 text-text-muted outline-none transition-colors focus-visible:outline-none ${
                  interactive
                    ? "cursor-pointer hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
                    : "cursor-not-allowed"
                }`}
              >
                <ChevronDown
                  size={11}
                  strokeWidth={2.25}
                  aria-hidden="true"
                  className={`transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {menu}

      {abortConfirmOpen ? (
        <ConfirmDialog
          title={t("topBar.abortDialogTitle")}
          accentColor={"var(--error)"}
          body={t("topBar.abortDialogBody")}
          confirmLabel={t("topBar.emergencyAbort")}
          confirmBusyLabel={t("topBar.aborting")}
          busy={abortingAnalysis}
          onCancel={() => setAbortConfirmOpen(false)}
          onConfirm={handleConfirmAbort}
        />
      ) : null}
    </>
  );
}
