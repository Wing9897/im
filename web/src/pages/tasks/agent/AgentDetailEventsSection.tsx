import { useTranslation } from "react-i18next";

import { EmptyState } from "../../../components/common/EmptyState";
import { PanelSection } from "../../../components/ui";
import { captionClass } from "../../../components/ui/pageTypography";
import type { UserEvent } from "../../../api/userEvents";
import { formatIsoLocal } from "./agentDetailFormat";

type Props = {
  events: UserEvent[];
  eventsLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AgentDetailEventsSection({
  events,
  eventsLoading,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <PanelSection
      title={t("tasks:agentDetail.eventsTitle")}
      showCount={!eventsLoading}
      itemCount={events.length}
      collapsible
      open={open}
      onOpenChange={onOpenChange}
    >
      {eventsLoading ? (
        <p className={captionClass}>{t("ui.loading")}</p>
      ) : events.length === 0 ? (
        <EmptyState
          title={t("tasks:agentDetail.eventsEmptyTitle")}
          description={t("tasks:agentDetail.eventsEmptyDescription")}
        />
      ) : (
        <ul className="flex flex-col gap-sm" data-testid="project-detail-events">
          {events.map((event) => (
            <li
              key={event.id}
              className="min-w-0 rounded-lg border border-surface-border/70 px-sm py-xs"
            >
              <div className="truncate font-medium text-text-primary">{event.title}</div>
              <p className={`${captionClass} mt-0.5 break-words`}>
                {formatIsoLocal(event.startTime)}
                {event.location?.trim() ? ` · ${event.location.trim()}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
