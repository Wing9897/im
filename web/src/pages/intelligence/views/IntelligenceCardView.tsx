import { Clock } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../../types";
import { PlatformTag } from "../../../components/common/PlatformTag";
import { IntelEventAvatarStack } from "../../../components/task/IntelEventAvatarStack";
import { taskTagBaseClass, taskTagColorStyle } from "../../../styles/cardTagClasses";
import { lookupTaskEmoji } from "../../../domain/tasks/taskEmoji";
import { useAutoRead } from "../../../hooks/useAutoRead";
import { CardFieldIcon, FeedCard } from "../../../components/ui";
import { cardTitleClass } from "../../../components/ui/pageTypography";
import { formatIntelligenceEventTime } from "../../../domain/intelligence/intelligenceSourceMeta";
import { IntelligenceNotIntelButton } from "./IntelligenceNotIntelButton";
import {
  AUTO_READ_VISIBILITY_THRESHOLD,
  AUTO_READ_DELAY_MS,
  cardReadClass,
  taskColor,
} from "../intelligenceViewLayout";

interface IntelligenceCardProps {
  item: AnalysisEvent;
  isRead: boolean;
  isConsumed: boolean;
  onAutoRead: (id: string) => void;
  onClick?: (item: AnalysisEvent) => void;
  notIntelBusy?: boolean;
  onNotIntel?: (item: AnalysisEvent) => void;
}

export const IntelligenceCard = React.memo(function IntelligenceCard({
  item,
  isRead,
  isConsumed,
  onAutoRead,
  onClick,
  notIntelBusy,
  onNotIntel,
}: IntelligenceCardProps) {
  const { t } = useTranslation("intelligence");
  const taskGlyph = lookupTaskEmoji(item.emoji);
  const containerRef = useAutoRead<HTMLDivElement>({
    itemId: item.id,
    isRead: isConsumed,
    visibilityThreshold: AUTO_READ_VISIBILITY_THRESHOLD,
    delayMs: AUTO_READ_DELAY_MS,
    onAutoRead,
  });

  const accentColor = taskColor(item.taskName);
  const showTags = Boolean(item.taskName || item.sourcePlatform);

  return (
    <div ref={containerRef} className="h-full min-w-0">
      <FeedCard
        className={[
          "im-intelligence-card h-full",
          isRead ? cardReadClass : "",
        ]
          .filter(Boolean)
          .join(" ")}
        density="default"
        style={{
          borderLeft: `3px solid ${isRead ? "var(--text-muted)" : accentColor}`,
        }}
        onClick={() => onClick?.(item)}
        header={
          <>
            {!isRead ? (
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: accentColor }}
                aria-label={t("list.unreadAria")}
                title={t("list.unreadAria")}
              />
            ) : (
              <span className="mt-1 h-1.5 w-1.5 shrink-0" aria-hidden="true" />
            )}
            <IntelEventAvatarStack
              emoji={taskGlyph}
              size="card"
              label={t("card.eventAvatarAria")}
            />
            <div
              className={`min-w-0 flex-1 line-clamp-2 ${cardTitleClass}`}
              title={item.title}
            >
              {item.title}
            </div>
          </>
        }
        meta={
          showTags ? (
            <div className="flex items-center gap-1.5 overflow-hidden">
              {item.taskName ? (
                <span
                  className={`${taskTagBaseClass} max-w-[9rem] truncate`}
                  style={taskTagColorStyle(accentColor)}
                  title={item.taskName}
                >
                  {item.taskName}
                </span>
              ) : null}
              {item.sourcePlatform ? (
                <PlatformTag
                  platform={item.sourcePlatform}
                  className="im-intelligence-card-tag im-intelligence-card-platform-tag shrink-0"
                />
              ) : null}
            </div>
          ) : (
            "\u00a0"
          )
        }
        body={<span title={item.body}>{item.body}</span>}
        footer={
          <span className="flex min-w-0 items-center justify-between gap-sm">
            <span className="inline-flex min-w-0 items-center gap-xs truncate">
              <CardFieldIcon icon={Clock} />
              {t("card.sourcedFrom", { time: formatIntelligenceEventTime(item) })}
            </span>
            {onNotIntel && !item.dismissed ? (
              <IntelligenceNotIntelButton
                disabled={notIntelBusy}
                onClick={() => onNotIntel(item)}
              />
            ) : null}
          </span>
        }
      />
    </div>
  );
});
