import { TopBarStatusActions } from "./AppTopBar/TopBarStatusActions";
import { CommandPaletteTrigger } from "./CommandPaletteTrigger";
import { AssistantQuickTrigger } from "./AssistantQuickTrigger";
import { SidebarCollapseButton } from "./SidebarCollapseButton";
import { MonitorModeSwitch } from "./MonitorModeSwitch";

export type ShellChromeLayout = "web" | "desktop";

type ShellChromeCoreProps = {
  /**
   * Both layouts: brand → optional collapse → mode → right-clustered
   * icon-only search/assistant + status (same as Electron title bar).
   * `desktop` omits window controls here — those stay in DesktopTitleBar.
   */
  layout: ShellChromeLayout;
  /** Sidebar collapse (typically pages mode only on desktop). */
  showCollapse: boolean;
  brandClassName?: string;
  collapseClassName?: string;
  modeClassName?: string;
  /** Right-side action cluster. Web defaults to `ml-auto` flex row. */
  actionsClassName?: string;
};

const DEFAULT_BRAND_CLASS =
  "mr-sm whitespace-nowrap text-[14px] font-semibold tracking-[-0.02em] text-text-primary";

const DEFAULT_WEB_ACTIONS_CLASS =
  "ml-auto flex min-w-0 items-center gap-sm";

/**
 * Shared chrome shared by {@link AppTopBar} and {@link DesktopTitleBar}.
 * Window minimize/maximize/close stay desktop-only in DesktopTitleBar.
 */
export function ShellChromeCore({
  layout,
  showCollapse,
  brandClassName = DEFAULT_BRAND_CLASS,
  collapseClassName,
  modeClassName,
  actionsClassName,
}: ShellChromeCoreProps) {
  const brand = (
    <span className={brandClassName} data-testid="shell-chrome-brand">
      Intelligence Monitor
    </span>
  );
  const collapse = showCollapse ? (
    <SidebarCollapseButton className={collapseClassName} />
  ) : null;
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
      {collapse}
      {mode}
      <div className={resolvedActionsClass} data-testid="shell-chrome-actions">
        <AssistantQuickTrigger compact />
        <CommandPaletteTrigger compact />
        <TopBarStatusActions variant="titleBar" />
      </div>
    </>
  );
}
