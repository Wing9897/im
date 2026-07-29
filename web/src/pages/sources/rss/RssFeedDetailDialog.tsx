import { useTranslation } from "react-i18next";
import type { RssFeedItem } from "./providers/types";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import {
  rssDetailHeroClass,
  rssDetailHeroLabelClass,
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
          <span style={statusDotStyle(feed.account.status)} aria-hidden="true" />
          {formatAccountLabel(feed.account) || t("rss.fallbackName")}
        </>
      }
      subtitle={`${platformDisplayLabel(feed.account.platform)} · ${formatStatusLabel(feed.account.status)}`}
      error={feed.lastError}
      onClose={onClose}
      onEdit={onEdit}
    >
      <div className={rssDetailHeroClass}>
        <div className={rssDetailHeroLabelClass}>{t("rss.feedUrlLabel")}</div>
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
            time: feed.account.updatedAt
              ? formatOsDateTime(feed.account.updatedAt)
              : t("detail.neverPolled"),
          })}
        </span>
      </div>
    </SourceDetailDialogLayout>
  );
}
