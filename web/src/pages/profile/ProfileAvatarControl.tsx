import { useRef, type ChangeEvent } from "react";
import { User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, SettingsRow } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";

type ProfileAvatarControlProps = {
  avatarDataUrl: string | null;
  displayName: string;
  onPickFile: (file: File) => void;
  onClear: () => void;
};

export function ProfileAvatarControl({
  avatarDataUrl,
  displayName,
  onPickFile,
  onClear,
}: ProfileAvatarControlProps) {
  const { t } = useTranslation("common");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPickFile(file);
  };

  return (
    <SettingsRow label={t("profile.avatarLabel")} help={t("profile.avatarHelp")}>
      <div className="flex flex-wrap items-center gap-md">
        <button
          type="button"
          className={[
            "group relative shrink-0 overflow-hidden rounded-full border-0 bg-transparent p-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          ].join(" ")}
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("profile.uploadAvatarAria")}
          data-testid="user-avatar-upload"
        >
          {avatarDataUrl ? (
            <img
              src={avatarDataUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
              data-testid="user-avatar-preview"
            />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] text-text-secondary"
              data-testid="user-avatar-preview"
              title={displayName}
            >
              <User size={26} strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <span
            className={[
              "pointer-events-none absolute inset-0 flex items-center justify-center rounded-full",
              "bg-black/40 text-[10px] font-medium text-white opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
            ].join(" ")}
            aria-hidden
          >
            {t("profile.uploadAvatar")}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          data-testid="user-avatar-file"
          onChange={onFileChange}
        />
        <div className="flex min-w-0 flex-col gap-xs">
          {avatarDataUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="inline"
              className="self-start"
              onClick={onClear}
              data-testid="user-avatar-reset"
            >
              {t("profile.resetAvatar")}
            </Button>
          ) : (
            <p className={`mb-0 ${formHelpClass} max-w-[28rem]`}>{t("profile.avatarHint")}</p>
          )}
        </div>
      </div>
    </SettingsRow>
  );
}
