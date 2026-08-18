import { TopBarStatusActions } from "./AppTopBar/TopBarStatusActions";
import { CommandPaletteTrigger } from "./CommandPaletteTrigger";
import { AssistantQuickTrigger } from "./AssistantQuickTrigger";
import { MonitorModeSwitch } from "./MonitorModeSwitch";

export type ShellChromeLayout = "web" | "desktop";

type ShellChromeCoreProps = {
  /**
   * Both layouts: brand → mode → spacer → search → assistant →
   * inbox/viewer → collector status (before window chrome).
   * `desktop` omits window controls here — those stay in DesktopTitleBar.
   * Sidebar open/close is the overlay edge chevron only (not title-bar chrome).
   */
  layout: ShellChromeLayout;
  brandClassName?: string;
  modeClassName?: string;
  /** Right-side action cluster. Web defaults to `ml-auto` flex row. */
  actionsClassName?: string;
};

const DEFAULT_BRAND_CLASS =
  "mr-sm whitespace-nowrap text-[14px] font-semibold tracking-[-0.02em] text-text-primary";

const DEFAULT_WEB_ACTIONS_CLASS =
  "ml-auto flex min-w-0 flex-1 items-center gap-sm";

/**
 * Shared chrome shared by {@link AppTopBar} and {@link DesktopTitleBar}.
 * Window minimize/maximize/close stay desktop-only in DesktopTitleBar.
 */
export function ShellChromeCore({
  layout,
  brandClassName = DEFAULT_BRAND_CLASS,
  modeClassName,
  actionsClassName,
}: ShellChromeCoreProps) {
  const brand = (
    <span className={brandClassName} data-testid="shell-chrome-brand">
      Intelligence Monitor
    </span>
  );
  const mode = (
    <div className={modeClassName} data-testid="shell-chrome-mode">
      <MonitorModeSwitch compact />
    </div>
  );
  const resolvedActionsClass =
    actionsClassName ?? (layout === "web" ? DEFAULT_WEB_ACTIONS_CLASS : undefined);

  return (
    <>
      {brand}
      {mode}
      <div className={resolvedActionsClass} data-testid="shell-chrome-actions">
        <div className="shell-chrome-spacer min-w-2 flex-1 self-stretch" aria-hidden="true" />
        <CommandPaletteTrigger compact />
        <AssistantQuickTrigger compact />
        <TopBarStatusActions variant="titleBar" />
      </div>
    </>
  );
}
