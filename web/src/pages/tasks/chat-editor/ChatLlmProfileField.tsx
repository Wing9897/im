import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge, MenuSelect, SettingsRow } from "../../../components/ui";
import { buttonBaseClass, buttonSizeClass } from "../../../components/ui/controlStyles";
import { formHelpClass } from "../../../components/ui/pageTypography";
import { useChatEditorLlmProfiles, type LlmProfileGate } from "./useChatEditorLlmProfiles";

interface ChatLlmProfileFieldProps {
  llmProfileId: string;
  requiredTitle: string;
  onLlmProfileIdChange: (value: string) => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
}

const createCtaClass = [
  buttonBaseClass,
  buttonSizeClass.sm,
  "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
].join(" ");

export function ChatLlmProfileField({
  llmProfileId,
  requiredTitle,
  onLlmProfileIdChange,
  onLlmProfileGateChange,
}: ChatLlmProfileFieldProps) {
  const { t } = useTranslation("common");
  const {
    profilesLoading,
    profilesEmpty,
    profilesAllIncomplete,
    profileOptions,
    selectedProfile,
    selectedComplete,
  } = useChatEditorLlmProfiles({
    llmProfileId,
    onLlmProfileIdChange,
    onLlmProfileGateChange,
  });

  return (
    <div className="md:col-span-2">
      <SettingsRow
        label={t("tasks:editor.llmProfileLabel")}
        htmlFor={profilesEmpty ? undefined : "chat-llm-profile"}
        help={t("tasks:editor.llmProfileHint")}
        required
        requiredTitle={requiredTitle}
      >
        {profilesLoading ? (
          <p className={`m-0 ${formHelpClass}`} data-testid="task-llm-profile-loading">
            {t("tasks:editor.llmProfileLoading")}
          </p>
        ) : profilesEmpty ? (
          <div
            className="flex flex-col items-start gap-sm"
            data-testid="task-llm-profile-empty"
          >
            <p className={`m-0 ${formHelpClass}`}>{t("tasks:editor.llmProfileEmpty")}</p>
            <Link
              to="/settings/ai/provider"
              data-testid="task-llm-profile-create-cta"
              className={createCtaClass}
            >
              {t("tasks:editor.llmProfileCreateCta")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            <div className="flex flex-wrap items-center gap-sm">
              <MenuSelect
                id="chat-llm-profile"
                variant="field"
                menuPortal
                value={llmProfileId}
                options={profileOptions}
                placeholder={t("tasks:editor.llmProfilePlaceholder")}
                onChange={onLlmProfileIdChange}
                className="min-w-0 flex-1"
                aria-label={t("tasks:editor.llmProfileLabel")}
                aria-required
                data-testid="task-llm-profile"
                disabled={profilesAllIncomplete}
              />
              {selectedProfile && !selectedComplete ? (
                <Badge tone="warning" data-testid="task-llm-profile-incomplete-badge">
                  {t("tasks:editor.llmProfileIncompleteBadge")}
                </Badge>
              ) : null}
            </div>
            {profilesAllIncomplete ? (
              <div
                className="flex flex-wrap items-center gap-sm"
                data-testid="task-llm-profile-all-incomplete"
              >
                <p className={`m-0 ${formHelpClass}`}>
                  {t("tasks:editor.llmProfileAllIncomplete")}
                </p>
                <Link to="/settings/ai/provider" className={createCtaClass}>
                  {t("tasks:editor.llmProfileCreateCta")}
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </SettingsRow>
    </div>
  );
}
