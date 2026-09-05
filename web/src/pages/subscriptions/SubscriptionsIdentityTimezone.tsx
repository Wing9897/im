import {
  AlertBanner,
  Button,
  MenuSelect,
  SettingsRow,
  type MenuSelectOption,
} from "../../components/ui";

export function SubscriptionsIdentityTimezone({
  timezoneLabel,
  timezoneHelp,
  timezonePending,
  saveLabel,
  timezoneDraft,
  timezoneOptions,
  timezoneBusy,
  pendingPublicTimezone,
  onDraftChange,
  onSave,
}: {
  timezoneLabel: string;
  timezoneHelp: string;
  timezonePending: string;
  saveLabel: string;
  timezoneDraft: string;
  timezoneOptions: readonly MenuSelectOption[];
  timezoneBusy: boolean;
  pendingPublicTimezone: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] pt-md">
      <SettingsRow label={timezoneLabel} htmlFor="calendar-share-timezone" help={timezoneHelp}>
        <MenuSelect
          id="calendar-share-timezone"
          data-testid="calendar-share-timezone"
          variant="field"
          menuPortal
          className="max-w-[420px]"
          value={timezoneDraft}
          options={timezoneOptions}
          searchable
          disabled={timezoneBusy}
          onChange={onDraftChange}
          aria-label={timezoneLabel}
        />
      </SettingsRow>

      {pendingPublicTimezone ? (
        <AlertBanner
          variant="warning"
          role="status"
          className="mb-0 max-w-[56ch]"
          data-testid="calendar-share-timezone-pending"
        >
          {timezonePending}
        </AlertBanner>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={timezoneBusy || !timezoneDraft.trim()}
          onClick={onSave}
          data-testid="calendar-share-timezone-save"
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
