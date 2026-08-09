import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";
import { AccountAccessKeysSection } from "./components/AccountAccessKeysSection";

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
