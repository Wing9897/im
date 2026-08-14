import { useTranslation } from "react-i18next";
import type { RssFeedItem } from "./providers/types";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import {
  detailChromeCardTitleClass,
  rssDetailHeroClass,
  rssDetailHeroUrlClass,
  rssDetailPollStatusClass,
} from "../../../components/detail/classes";
import { SourceDetailDialogLayout } from "../../../components/detail";
import { formatOsDateTime } from "../../../utils/time";

interface RssFeedDetailDialogProps {
  feed: RssFeedItem;
  onClose: () => void;
  onEdit?: () => void;
}

export function RssFeedDetailDialog({ feed, onClose, onEdit }: RssFeedDetailDialogProps) {
  const { t } = useTranslation("sources");
  const pollInterval = t("detail.everyMinutes", {
    minutes: Math.round(feed.pollIntervalSeconds / 60),
  });
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("rss.detailAria", { url: feed.feedUrl })}
      title={
        <>
          <span style={statusDotStyle(feed.source.status)} aria-hidden="true" />
          {formatSourceLabel(feed.source) || t("rss.fallbackName")}
        </>
      }
      subtitle={`${platformDisplayLabel(feed.source.platform)} · ${formatStatusLabel(feed.source.status)}`}
      error={feed.lastError}
      onClose={onClose}
      onEdit={onEdit}
    >
      <div className={rssDetailHeroClass}>
        <div className={detailChromeCardTitleClass}>{t("rss.feedUrlLabel")}</div>
        <div className={rssDetailHeroUrlClass}>{feed.feedUrl}</div>
      </div>
      <div className={rssDetailPollStatusClass}>
        <span>{t("rss.pollLabel", { interval: pollInterval })}</span>
        <span>
          {t("rss.lastSuccessLabel", {
            time: feed.lastSuccessAt ? formatOsDateTime(feed.lastSuccessAt) : t("detail.emDash"),
          })}
        </span>
        <span>
          {t("rss.lastPollLabel", {
            time: feed.source.updatedAt
              ? formatOsDateTime(feed.source.updatedAt)
              : t("detail.neverPolled"),
          })}
        </span>
      </div>
    </SourceDetailDialogLayout>
  );
}
