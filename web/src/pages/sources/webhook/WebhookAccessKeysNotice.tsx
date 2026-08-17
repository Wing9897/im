import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function WebhookAccessKeysNotice({
  keyCount,
  isConfigured,
}: {
  keyCount: number;
  isConfigured: boolean;
}) {
  const { t } = useTranslation("sources");
  return (
    <div className="im-surface-inset mb-md rounded-md border border-surface-border p-md">
      <p className="mb-sm text-body leading-snug text-text-secondary">
        {t("webhook.keysProfileIntro")}{" "}
        <Link to="/account/keys" className="text-info no-underline">
          {t("webhook.keysProfileLink")}
        </Link>
        {t("webhook.keysProfileSuffix")}
      </p>
      <p className="mb-0 text-xs text-text-muted" data-testid="webhook-keys-status">
        {isConfigured
          ? t("webhook.keySet", { count: keyCount })
          : t("webhook.keyUnset")}
      </p>
    </div>
  );
}
