import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AccentBarCard, Badge, type BadgeTone, LinkButton } from "./ui";
import { cardBodyClass, cardTitleClass } from "./ui/pageTypography";
import { AiStaffAvatar } from "./aiStaff/AiStaffAvatar";
import type { SystemTaskInfo, SystemTaskKind } from "../domain/tasks/systemTaskCatalog";

interface SystemInfoTaskCardProps {
  item: SystemTaskInfo;
}

const KIND_BADGE_TONE: Record<SystemTaskKind, BadgeTone> = {
  virtual: "info",
  system: "neutral",
  agent: "info",
};

const KIND_BAR_CLASS: Record<SystemTaskKind, string> = {
  virtual: "bg-info",
  system: "bg-[color-mix(in_srgb,var(--text-muted)_55%,transparent)]",
  agent: "bg-warning",
};

const KIND_LABEL_KEY: Record<SystemTaskKind, "ui.virtual" | "ui.system" | "ui.agent"> = {
  virtual: "ui.virtual",
  system: "ui.system",
  agent: "ui.agent",
};

/** Read-only card for system / virtual / agent mechanisms on the tasks page. */
export function SystemInfoTaskCard({ item }: SystemInfoTaskCardProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const kindLabel = t(KIND_LABEL_KEY[item.kind]);

  return (
    <AccentBarCard
      accentClass={KIND_BAR_CLASS[item.kind]}
      enter="rise"
      data-testid={`system-task-card-${item.id}`}
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          {item.staffId ? (
            <AiStaffAvatar staffId={item.staffId} size="xs" label={item.title} />
          ) : item.avatarSrc ? (
            <span
              className="im-ai-staff-avatar inline-flex h-[22px] w-[22px] shrink-0 overflow-hidden rounded-full bg-transparent"
              role="img"
              aria-label={item.title}
              data-testid={`system-task-avatar-${item.id}`}
            >
              <img
                src={item.avatarSrc}
                alt=""
                width={22}
                height={22}
                className="pointer-events-none h-full w-full border-0 object-cover"
                draggable={false}
              />
            </span>
          ) : null}
          <span className={`min-w-0 flex-1 truncate ${cardTitleClass}`} title={item.title}>
            {item.title}
          </span>
        </div>
        <Badge tone={KIND_BADGE_TONE[item.kind]}>{kindLabel}</Badge>
      </div>

      <p className={cardBodyClass}>{item.shortDescription}</p>

      {item.linkTo && item.linkLabel ? (
        <div className="mt-auto pt-xs">
          <LinkButton
            tone="accent"
            onClick={() => navigate(item.linkTo!)}
            aria-label={item.linkLabel}
          >
            {item.linkLabel}
          </LinkButton>
        </div>
      ) : null}
    </AccentBarCard>
  );
}
