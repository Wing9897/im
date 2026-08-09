import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui";
import {
  itemsPageChromeActionsClass,
  itemsPageChromeBackButtonClass,
  itemsPageChromeControlsClass,
  itemsPageChromeInnerClass,
  itemsPageChromeOuterClass,
  itemsPageChromeTitleClass,
  itemsPageChromeTitleClusterClass,
  itemsPageChromeTitleClusterWithControlsClass,
} from "./itemsPageChromeClasses";

type BackProps = {
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
};

type Props = {
  title: string;
  back?: BackProps;
  /** Same-bar filters / search (entry list). */
  controls?: ReactNode;
  /** Accessible name for the controls group (filters). */
  controlsAriaLabel?: string;
  actions?: ReactNode;
  innerClassName?: string;
  outerClassName?: string;
  controlsClassName?: string;
  actionsClassName?: string;
  "data-testid"?: string;
};

/**
 * Single Items top strip (ChatEditor-style sticky chrome).
 * Category / entry list / form all use this band language.
 */
export function ItemsPageChrome({
  title,
  back,
  controls,
  controlsAriaLabel,
  actions,
  innerClassName = itemsPageChromeInnerClass,
  outerClassName = itemsPageChromeOuterClass,
  controlsClassName = itemsPageChromeControlsClass,
  actionsClassName = itemsPageChromeActionsClass,
  "data-testid": dataTestId,
}: Props) {
  const titleClusterClass = controls
    ? itemsPageChromeTitleClusterWithControlsClass
    : itemsPageChromeTitleClusterClass;

  return (
    <header className={outerClassName} data-testid={dataTestId}>
      <div className={innerClassName}>
        <div className={titleClusterClass}>
          {back ? (
            <Button
              variant="ghost"
              size="icon"
              className={itemsPageChromeBackButtonClass}
              onClick={back.onClick}
              disabled={back.disabled}
              aria-label={back.ariaLabel}
              title={back.ariaLabel}
            >
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
            </Button>
          ) : null}
          <h1 className={itemsPageChromeTitleClass}>{title}</h1>
        </div>

        {controls ? (
          <div
            className={controlsClassName}
            role="group"
            aria-label={controlsAriaLabel}
          >
            {controls}
          </div>
        ) : null}

        {actions ? (
          <div className={actionsClassName}>{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
