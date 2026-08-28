import { Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Lucide subscribe mark beside subscribed event titles (matches nav subscriptions icon). */
export function SubscribedEventSubscribeIcon({ className = "" }: { className?: string }) {
  const { t } = useTranslation("timeline");
  return (
    <Bookmark
      size={14}
      strokeWidth={2.25}
      aria-label={t("eventList.subscribeIconAria")}
      className={["shrink-0 text-accent", className].filter(Boolean).join(" ")}
      data-testid="subscribed-event-icon"
    />
  );
}
