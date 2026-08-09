/**
 * Project sources preview + full list dialog.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DetailPresentationShell } from "../../../components/detail";
import {
  detailDialogShellClass,
  taskDetailBodyClass,
  taskDetailFooterClass,
  taskDetailHeaderClass,
  taskDetailTitleClass,
} from "../../../components/detail/classes";
import { Button, PanelSection } from "../../../components/ui";
import { captionClass } from "../../../components/ui/pageTypography";

const SOURCE_PREVIEW = 8;

interface AgentDetailSourcesSectionProps {
  channelLabels: string[];
}

export function AgentDetailSourcesSection({ channelLabels }: AgentDetailSourcesSectionProps) {
  const { t } = useTranslation("common");
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const previewSources = useMemo(
    () => channelLabels.slice(0, SOURCE_PREVIEW),
    [channelLabels],
  );
  const hiddenSourceCount = Math.max(0, channelLabels.length - SOURCE_PREVIEW);

  return (
    <>
      <PanelSection
        title={t("tasks.agentDetail.sourcesTitle")}
        showCount
        itemCount={channelLabels.length}
        headerActions={
          channelLabels.length > SOURCE_PREVIEW ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSourcesOpen(true)}
              data-testid="project-detail-sources-all"
            >
              {t("tasks.agentDetail.sourcesViewAll", { count: channelLabels.length })}
            </Button>
          ) : null
        }
      >
        {channelLabels.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-xs" data-testid="project-detail-sources">
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {previewSources.map((label) => (
                <li
                  key={label}
                  className="min-w-0 truncate text-body leading-relaxed text-text-primary"
                  title={label}
                >
                  {label}
                </li>
              ))}
            </ul>
            {hiddenSourceCount > 0 ? (
              <button
                type="button"
                className="self-start text-caption font-medium text-accent hover:underline"
                onClick={() => setSourcesOpen(true)}
                data-testid="project-detail-sources-more"
              >
                {t("tasks.detail.channelsMore", { count: hiddenSourceCount })}
              </button>
            ) : null}
          </div>
        ) : (
          <p className={captionClass}>{t("tasks.detail.noChannels")}</p>
        )}
      </PanelSection>

      {sourcesOpen ? (
        <DetailPresentationShell
          presentation="modal"
          onClose={() => setSourcesOpen(false)}
          className={detailDialogShellClass}
          width="min(560px, calc(100vw - 32px))"
          aria-label={t("tasks.agentDetail.sourcesDialogTitle")}
        >
          <header className={`${taskDetailHeaderClass} shrink-0`}>
            <h2 className={taskDetailTitleClass}>
              {t("tasks.agentDetail.sourcesDialogTitle")}
            </h2>
            <p className={`${captionClass} mt-1`}>
              {t("ui.itemsCount", { count: channelLabels.length })}
            </p>
          </header>
          <div
            className={`${taskDetailBodyClass} flex-1`}
            data-testid="project-detail-sources-dialog-list"
          >
            <ul className="m-0 flex list-none flex-col gap-sm p-0">
              {channelLabels.map((label) => (
                <li
                  key={label}
                  className="min-w-0 break-words rounded-lg border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-card)_65%,transparent)] px-sm py-xs text-body leading-relaxed text-text-primary [overflow-wrap:anywhere]"
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <footer className={`${taskDetailFooterClass} shrink-0`}>
            <Button variant="secondary" onClick={() => setSourcesOpen(false)}>
              {t("dialog.close")}
            </Button>
          </footer>
        </DetailPresentationShell>
      ) : null}
    </>
  );
}
