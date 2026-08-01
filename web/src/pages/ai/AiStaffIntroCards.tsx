import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import liaisonAvatarSrc from "../../assets/ai-staff/liaison.png";
import { AiStaffAvatar } from "../../components/aiStaff/AiStaffAvatar";
import { Badge, SurfaceCard } from "../../components/ui";
import {
  cardBodyClass,
  cardMetaClass,
  cardTitleClass,
  captionClass,
} from "../../components/ui/pageTypography";
import type { AiStaffDefinition, AiStaffId } from "../../domain/aiStaff/aiStaff";

export const FRONTLINE_LINKS: Partial<
  Record<AiStaffId, { to: string; labelKey: string }>
> = {
  assistant: { to: "/assistant", labelKey: "staff.openAssistant" },
  taskEditor: { to: "/tasks/new", labelKey: "staff.openTaskEditor" },
};

/** Page-local only — not an AiStaffId / roster member (own avatar asset). */
export function LiaisonIntroCard() {
  const { t } = useTranslation("settings");
  const name = t("staff.liaison.name");

  return (
    <SurfaceCard
      material="solid"
      density="compact"
      className="flex flex-col gap-xs"
      data-testid="ai-staff-card-liaison"
    >
      <div className="flex items-start gap-sm">
        <span
          className="im-ai-staff-avatar inline-flex shrink-0 overflow-hidden rounded-full bg-transparent"
          style={{ width: 36, height: 36 }}
          role="img"
          aria-label={name}
          data-testid="ai-staff-avatar-liaison"
        >
          <img
            src={liaisonAvatarSrc}
            alt=""
            width={36}
            height={36}
            className="pointer-events-none h-full w-full border-0 object-cover"
            draggable={false}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className={`m-0 ${cardTitleClass}`}>{name}</h3>
            <Badge tone="info">{t("staff.kind.agent")}</Badge>
            <Badge tone="neutral">{t("staff.liaison.badgeChannel")}</Badge>
          </div>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("staff.liaison.summary")}</p>
        </div>
      </div>

      <div>
        <div className={cardMetaClass}>{t("staff.capabilitiesLabel")}</div>
        <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
          {(
            t("staff.liaison.capabilities", {
              returnObjects: true,
            }) as string[]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <Link
        to="/settings/api"
        className={`${captionClass} font-medium text-accent no-underline hover:underline`}
      >
        {t("staff.liaison.openApiDocs")}
      </Link>
    </SurfaceCard>
  );
}

export function RosterStaffCard({ staff }: { staff: AiStaffDefinition }) {
  const { t } = useTranslation(["settings", "common"]);
  const link = FRONTLINE_LINKS[staff.id];
  const name = t(`common:aiStaff.${staff.id}`);

  return (
    <SurfaceCard
      material="solid"
      density="compact"
      className="flex flex-col gap-xs"
      data-testid={`ai-staff-card-${staff.id}`}
    >
      <div className="flex items-start gap-sm">
        <AiStaffAvatar staffId={staff.id} size="md" label={name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className={`m-0 ${cardTitleClass}`}>{name}</h3>
            <Badge tone={staff.kind === "agent" ? "info" : "neutral"}>
              {t(`staff.kind.${staff.kind}`)}
            </Badge>
            <Badge tone="neutral">{t(`staff.surface.${staff.surface}`)}</Badge>
          </div>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>
            {t(`staff.${staff.id}.summary`)}
          </p>
        </div>
      </div>

      <div>
        <div className={cardMetaClass}>{t("staff.capabilitiesLabel")}</div>
        <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
          {(
            t(`staff.${staff.id}.capabilities`, {
              returnObjects: true,
            }) as string[]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {link ? (
        <Link
          to={link.to}
          className={`${captionClass} font-medium text-accent no-underline hover:underline`}
        >
          {t(link.labelKey)}
        </Link>
      ) : (
        <p className={`mb-0 ${cardMetaClass}`}>{t("staff.backofficeNote")}</p>
      )}
    </SurfaceCard>
  );
}
