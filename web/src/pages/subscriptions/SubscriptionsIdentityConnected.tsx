import { Badge, Button, SurfaceCard } from "../../components/ui";
import { cardTitleClass, formHelpClass } from "../../components/ui/pageTypography";
import { IdentityAvatar } from "../../components/user/IdentityAvatar";
import type { useSubscriptionsIdentity } from "./useSubscriptionsIdentity";
import { SubscriptionsIdentityTimezone } from "./SubscriptionsIdentityTimezone";

type Identity = ReturnType<typeof useSubscriptionsIdentity>;

export function SubscriptionsIdentityConnected({ identity }: { identity: Identity }) {
  const { t } = identity;
  return (
    <SurfaceCard
      density="field"
      material="elevated"
      className="flex flex-col gap-md"
      data-testid="subscriptions-identity-panel"
      data-connected="true"
    >
      <div className="flex flex-wrap items-center gap-md">
        <IdentityAvatar
          label={identity.shareAvatar.label}
          src={identity.shareAvatar.imageSrc}
          size="lg"
          testId="subscriptions-identity-avatar"
        />
        <div className="min-w-0 flex-1">
          <p className={`mb-0 truncate ${cardTitleClass}`} data-testid="subscriptions-identity-handle">
            {identity.shareHandle || "—"}
          </p>
          <div className="mt-xs flex flex-wrap items-center gap-xs">
            <Badge tone="success" data-testid="subscriptions-identity-status">
              {t("identity.statusConnected")}
            </Badge>
            <span className="truncate text-caption text-text-muted" data-testid="subscriptions-identity-server">
              {identity.serverLabel}
            </span>
          </div>
          <p className={`mb-0 mt-xs ${formHelpClass}`}>
            {t("identity.localDevice", { name: identity.localDisplayName })}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={identity.busy}
          disabled={identity.busy}
          onClick={() => void identity.onLogout()}
          data-testid="calendar-share-logout"
        >
          {identity.busy ? t("identity.loggingOut") : t("identity.logout")}
        </Button>
      </div>

      {identity.statusMessage ? (
        <p className={`mb-0 ${formHelpClass} text-error`} role="alert" data-testid="calendar-share-status">
          {identity.statusMessage}
        </p>
      ) : null}

      <SubscriptionsIdentityTimezone
        timezoneLabel={t("identity.timezoneLabel")}
        timezoneHelp={t("identity.timezoneHelp")}
        timezonePending={t("identity.timezonePending")}
        saveLabel={identity.timezoneSaveLabel}
        timezoneDraft={identity.timezoneDraft}
        timezoneOptions={identity.timezoneOptions}
        timezoneBusy={identity.timezoneBusy}
        pendingPublicTimezone={identity.pendingPublicTimezone}
        onDraftChange={identity.setTimezoneDraft}
        onSave={() => void identity.onSaveTimezone()}
      />
    </SurfaceCard>
  );
}
