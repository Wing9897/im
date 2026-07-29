import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../settings/SettingsShared";
import { ProfileDeviceSessionSection } from "./ProfileDeviceSessionSection";

/** Account → Devices: session list, revoke, logout. */
export function AccountDevicesPage() {
  return (
    <div data-testid="account-devices-page">
      <SettingsContentCard>
        <SettingsFieldGroup>
          <ProfileDeviceSessionSection
            onLoggedOut={() => {
              window.location.reload();
            }}
          />
        </SettingsFieldGroup>
      </SettingsContentCard>
    </div>
  );
}
