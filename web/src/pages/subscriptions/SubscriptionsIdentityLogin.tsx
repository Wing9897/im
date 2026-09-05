import { Button, SettingsRow, SurfaceCard, TextField } from "../../components/ui";
import { cardTitleClass, formHelpClass } from "../../components/ui/pageTypography";
import { IdentityAvatar } from "../../components/user/IdentityAvatar";
import type { useSubscriptionsIdentity } from "./useSubscriptionsIdentity";
import { DEFAULT_CALENDAR_SHARE_URL } from "./useSubscriptionsIdentity";
import { SubscriptionsIdentityTimezone } from "./SubscriptionsIdentityTimezone";

type Identity = ReturnType<typeof useSubscriptionsIdentity>;

export function SubscriptionsIdentityLogin({ identity }: { identity: Identity }) {
  const { t } = identity;
  return (
    <SurfaceCard
      density="default"
      material="elevated"
      enter="rise-soft"
      className="flex flex-col gap-md"
      data-testid="subscriptions-identity-panel"
      data-connected="false"
    >
      <div className="flex flex-wrap items-start gap-md">
        <IdentityAvatar
          label={identity.localAvatar.label}
          src={identity.localAvatar.imageSrc}
          size="lg"
          testId="subscriptions-identity-avatar"
        />
        <div className="min-w-0 flex-1">
          <h2 className={`mb-xs ${cardTitleClass}`}>{t("identity.title")}</h2>
          <p className={`mb-0 max-w-[56ch] ${formHelpClass}`}>{t("identity.help")}</p>
          <p className={`mb-0 mt-xs ${formHelpClass}`}>
            {t("identity.localDevice", { name: identity.localDisplayName })}
          </p>
        </div>
      </div>

      <div className="grid gap-md md:grid-cols-2">
        <SettingsRow label={t("identity.urlLabel")} htmlFor="calendar-share-url" help={t("identity.urlHelp")}>
          <TextField
            id="calendar-share-url"
            data-testid="calendar-share-url"
            value={identity.baseUrl}
            placeholder={DEFAULT_CALENDAR_SHARE_URL}
            disabled={identity.busy}
            onChange={(event) => identity.setBaseUrl(event.target.value)}
            autoComplete="url"
          />
        </SettingsRow>

        <SettingsRow label={t("identity.handleLabel")} htmlFor="calendar-share-handle">
          <TextField
            id="calendar-share-handle"
            data-testid="calendar-share-handle"
            value={identity.handle}
            disabled={identity.busy}
            onChange={(event) => identity.setHandle(event.target.value)}
            autoComplete="username"
          />
        </SettingsRow>

        <SettingsRow label={t("identity.passwordLabel")} htmlFor="calendar-share-password">
          <TextField
            id="calendar-share-password"
            data-testid="calendar-share-password"
            type="password"
            value={identity.password}
            disabled={identity.busy}
            onChange={(event) => identity.setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </SettingsRow>
      </div>

      {identity.statusMessage ? (
        <p className={`mb-0 ${formHelpClass}`} data-testid="calendar-share-status" role="status">
          {identity.statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={identity.busy}
          disabled={identity.busy || !identity.handle.trim() || !identity.password}
          onClick={() => void identity.onLogin()}
          data-testid="calendar-share-login"
        >
          {identity.busy ? t("identity.loggingIn") : t("identity.login")}
        </Button>
      </div>

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
