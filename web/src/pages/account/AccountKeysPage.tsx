import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../settings/SettingsShared";
import { AccountAccessKeysSection } from "./AccountAccessKeysSection";

/** Account → Access keys: household API keys for webhook / automation. */
export function AccountKeysPage() {
  return (
    <div data-testid="account-keys-page">
      <SettingsContentCard>
        <SettingsFieldGroup>
          <AccountAccessKeysSection />
        </SettingsFieldGroup>
      </SettingsContentCard>
    </div>
  );
}
