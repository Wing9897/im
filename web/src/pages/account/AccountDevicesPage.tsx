import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";
import { AccountDeviceSessionSection } from "./components/AccountDeviceSessionSection";

/** Account → Devices: session list, revoke, logout. */
export function AccountDevicesPage() {
  return (
    <div data-testid="account-devices-page">
      <SettingsContentCard>
        <SettingsFieldGroup>
          <AccountDeviceSessionSection
            onLoggedOut={() => {
              window.location.reload();
            }}
          />
        </SettingsFieldGroup>
      </SettingsContentCard>
    </div>
  );
}
