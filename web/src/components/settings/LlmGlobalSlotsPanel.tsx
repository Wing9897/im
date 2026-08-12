import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LlmGlobalSlotBinding, LlmProfile } from "../../api/llmProfiles";
import { LLM_GLOBAL_SLOTS, type LlmGlobalSlotId } from "../../types/llmProfiles";
import { isLlmProfileComplete } from "../../domain/settings/llmProfileCompleteness";
import { AiStaffAvatar, type AiStaffAvatarId } from "../aiStaff/AiStaffAvatar";
import { Badge, MenuSelect } from "../ui";
import {
  cardBodyClass,
  captionClass,
  formHelpClass,
  sectionTitleClass,
} from "../ui/pageTypography";

type LlmGlobalSlotsPanelProps = {
  slots: LlmGlobalSlotBinding[];
  profiles: LlmProfile[];
  savingSlot: LlmGlobalSlotId | null;
  onBind: (slot: LlmGlobalSlotId, profileId: string | null) => void;
};

const UNBOUND = "";

/** Global slots share avatar ids with `/ai/staff` (liaison is avatar-only). */
const SLOT_AVATAR_ID: Record<LlmGlobalSlotId, AiStaffAvatarId> = {
  assistant: "assistant",
  liaison: "liaison",
  taskEditor: "taskEditor",
};

export function LlmGlobalSlotsPanel({
  slots,
  profiles,
  savingSlot,
  onBind,
}: LlmGlobalSlotsPanelProps) {
  const { t } = useTranslation("settings");

  const bySlot = useMemo(() => {
    const map = new Map<LlmGlobalSlotId, LlmGlobalSlotBinding>();
    for (const row of slots) {
      map.set(row.slot, row);
    }
    return map;
  }, [slots]);

  const profileOptions = useMemo(
    () => [
      { value: UNBOUND, label: t("globalSlots.unbound") },
      ...profiles.map((profile) => {
        const complete = isLlmProfileComplete(profile);
        const base = profile.isDefault
          ? `${profile.name} (${t("profiles.defaultBadge")})`
          : profile.name;
        return {
          value: profile.id,
          label: complete
            ? base
            : `${base} — ${t("globalSlots.incompleteBadge")}`,
          disabled: !complete,
        };
      }),
    ],
    [profiles, t],
  );

  return (
    <section className="flex flex-col gap-md" data-testid="llm-global-slots">
      <div>
        <h2 className={sectionTitleClass}>{t("globalSlots.title")}</h2>
        <p className={`mt-xs mb-0 ${formHelpClass}`}>{t("globalSlots.intro")}</p>
      </div>

      <div className="im-surface-panel rounded-xl border border-surface-border/80 divide-y divide-surface-border/70">
        {LLM_GLOBAL_SLOTS.map((slot) => {
          const binding = bySlot.get(slot);
          const selected = (binding?.profileId ?? "").trim();
          const selectedProfile = profiles.find((p) => p.id === selected);
          const complete = selectedProfile ? isLlmProfileComplete(selectedProfile) : false;
          const title = t(`globalSlots.slot.${slot}.title`);
          const boundReady = Boolean(selected && complete);

          return (
            <div
              key={slot}
              className="flex flex-col gap-sm px-lg py-md sm:flex-row sm:items-center sm:gap-lg"
              data-testid={`llm-global-slot-${slot}`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-sm">
                <AiStaffAvatar
                  staffId={SLOT_AVATAR_ID[slot]}
                  size="md"
                  label={title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-xs">
                    <h3 className="m-0 text-card-title font-medium leading-snug text-text-primary">
                      {title}
                    </h3>
                    {boundReady ? (
                      <Badge tone="info">{t("globalSlots.boundBadge")}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("globalSlots.needsSetupBadge")}</Badge>
                    )}
                  </div>
                  <p className={`mt-xs mb-0 ${cardBodyClass}`}>
                    {t(`globalSlots.slot.${slot}.help`)}
                  </p>
                  {selectedProfile && boundReady ? (
                    <p className={`mt-xs mb-0 ${captionClass}`}>
                      {t("globalSlots.boundProfile", {
                        name: selectedProfile.name,
                        model: selectedProfile.model || t("profiles.noModel"),
                      })}
                    </p>
                  ) : null}
                  {selected && selectedProfile && !complete ? (
                    <p className={`mt-xs mb-0 ${captionClass}`}>
                      {t("globalSlots.incompleteHint")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="w-full shrink-0 sm:w-[min(100%,240px)]">
                {profiles.length === 0 ? (
                  <p
                    className={`m-0 ${captionClass}`}
                    data-testid={`llm-global-slot-${slot}-empty`}
                  >
                    {t("globalSlots.noProfiles")}
                  </p>
                ) : (
                  <MenuSelect
                    id={`llm-global-slot-${slot}-select`}
                    variant="field"
                    menuPortal
                    value={selected || UNBOUND}
                    options={profileOptions}
                    placeholder={t("globalSlots.placeholder")}
                    onChange={(next) => {
                      const trimmed = next.trim();
                      onBind(slot, trimmed ? trimmed : null);
                    }}
                    disabled={savingSlot === slot}
                    aria-label={title}
                    data-testid={`llm-global-slot-${slot}-select`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
