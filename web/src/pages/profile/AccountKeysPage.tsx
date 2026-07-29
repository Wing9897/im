import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../settings/SettingsShared";
import { ProfileAccessKeysSection } from "./ProfileAccessKeysSection";

/** Account → Access keys: household API keys for webhook / automation. */
export function AccountKeysPage() {
  return (
    <div data-testid="account-keys-page">
      <SettingsContentCard>
        <SettingsFieldGroup>
          <ProfileAccessKeysSection />
        </SettingsFieldGroup>
      </SettingsContentCard>
    </div>
  );
}
