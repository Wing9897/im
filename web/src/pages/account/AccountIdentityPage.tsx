import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, SettingsRow, TextArea, TextField } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import { useToast } from "../../context/ToastContext";
import {
  BACKGROUND_MAX_CHARS,
  DISPLAY_NAME_MAX_CHARS,
  USER_PROFILE_DRAFT_KEY,
  compressAvatarToDataUrl,
  profilesEqual,
  resolveUserDisplayName,
  useUserProfile,
  type UserProfile,
} from "../../domain/user/userProfile";
import { usePersistedState } from "../../hooks/usePersistedState";
import { toErrorMessage } from "../../utils/errors";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../settings/SettingsShared";
import { AccountAvatarControl } from "./AccountAvatarControl";
import { AccountChangePasswordSection } from "./AccountChangePasswordSection";

/** Account → Identity: display name, avatar, background, change password. */
export function AccountIdentityPage() {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const { profile, setProfile } = useUserProfile();
  const [draft, setDraft] = usePersistedState<UserProfile>(
    USER_PROFILE_DRAFT_KEY,
    profile,
    { storage: "session", persistDebounceMs: 400 },
  );
  const baselineRef = useRef(profile);
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    setDraft((prev) => {
      if (profilesEqual(prev, baselineRef.current)) {
        baselineRef.current = profile;
        return profile;
      }
      baselineRef.current = profile;
      return prev;
    });
  }, [profile, setDraft]);

  const fallbackName = t("profile.defaultName");
  const displayName = resolveUserDisplayName(draft, fallbackName);

  const onAvatarFile = async (file: File) => {
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatarToDataUrl(file);
      setDraft((prev) => ({ ...prev, avatarDataUrl: dataUrl }));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setAvatarError(
        code === "too_large" ? t("profile.avatarTooLarge") : t("profile.avatarReadFailed"),
      );
    }
  };

  const onSave = () => {
    setSaving(true);
    setAvatarError(null);
    try {
      const next: UserProfile = {
        displayName: draft.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
        avatarDataUrl: draft.avatarDataUrl,
        background: draft.background.slice(0, BACKGROUND_MAX_CHARS),
      };
      setProfile(next);
      baselineRef.current = next;
      setDraft(next);
      showToast(t("profile.saved"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="account-identity-page">
      <SettingsContentCard>
        <SettingsFieldGroup>
          <p className={`mb-0 max-w-[56ch] ${formHelpClass}`}>{t("profile.intro")}</p>

          <AccountAvatarControl
            avatarDataUrl={draft.avatarDataUrl}
            displayName={displayName}
            onPickFile={(file) => void onAvatarFile(file)}
            onClear={() => {
              setAvatarError(null);
              setDraft((prev) => ({ ...prev, avatarDataUrl: null }));
            }}
          />

          <SettingsRow
            label={t("profile.displayNameLabel")}
            htmlFor="user-display-name"
            help={t("profile.displayNameHelp")}
          >
            <TextField
              id="user-display-name"
              data-testid="user-display-name"
              className="max-w-[320px]"
              value={draft.displayName}
              maxLength={DISPLAY_NAME_MAX_CHARS}
              placeholder={fallbackName}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, displayName: e.target.value }))
              }
              aria-label={t("profile.displayNameLabel")}
            />
          </SettingsRow>

          <SettingsRow
            label={t("profile.backgroundLabel")}
            htmlFor="user-background"
            help={t("profile.backgroundHelp")}
          >
            <TextArea
              id="user-background"
              data-testid="user-background"
              className="max-w-[480px]"
              value={draft.background}
              maxLength={BACKGROUND_MAX_CHARS}
              rows={4}
              placeholder={t("profile.backgroundPlaceholder")}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, background: e.target.value }))
              }
              aria-label={t("profile.backgroundLabel")}
            />
          </SettingsRow>

          {avatarError ? (
            <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
              {avatarError}
            </p>
          ) : null}

          <div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void onSave()}
              data-testid="user-profile-save"
            >
              {saving ? t("profile.saving") : t("profile.save")}
            </Button>
          </div>
        </SettingsFieldGroup>
      </SettingsContentCard>

      <div className="mt-lg">
        <SettingsContentCard>
          <SettingsFieldGroup>
            <AccountChangePasswordSection />
          </SettingsFieldGroup>
        </SettingsContentCard>
      </div>
    </div>
  );
}
