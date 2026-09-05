import { Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Lucide subscribe mark beside subscribed event titles (matches nav subscriptions icon). */
export function SubscribedEventSubscribeIcon({
  className = "",
  ariaLabel,
  title,
  testId = "subscribed-event-icon",
}: {
  className?: string;
  ariaLabel?: string;
  title?: string;
  testId?: string;
}) {
  const { t } = useTranslation("timeline");
  return (
    <Bookmark
      size={14}
      strokeWidth={2.25}
      aria-label={ariaLabel ?? t("eventList.subscribeIconAria")}
      title={title}
      className={["shrink-0 text-accent", className].filter(Boolean).join(" ")}
      data-testid={testId}
    />
  );
}
