import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchHealth } from "../../api/system";
import { formatAppVersionLabel } from "../../utils/appVersion";
import { FormGrid, SurfaceCard } from "../ui";
import { captionClass, formLabelClass } from "../ui/pageTypography";

function formatDatabaseVersion(
  schemaSemver: string | null | undefined,
  current: number,
  required: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const semver = typeof schemaSemver === "string" && schemaSemver.trim() ? schemaSemver.trim() : null;
  if (current === required) {
    return t("general.databaseVersionCurrent", { version: semver ?? current });
  }
  if (semver) {
    return t("general.databaseVersionMismatchSemver", {
      semver,
      current,
      required,
    });
  }
  return t("general.databaseVersionMismatch", { current, required });
}

/** Read-only app + database schema version block for General settings. */
export function SystemVersionPanel() {
  const { t } = useTranslation("settings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [requiredSchemaVersion, setRequiredSchemaVersion] = useState<number | null>(null);
  const [schemaSemver, setSchemaSemver] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const health = await fetchHealth();
        if (cancelled) return;
        setSchemaVersion(health.schemaVersion);
        setRequiredSchemaVersion(health.schemaVersion);
        setSchemaSemver(
          typeof health.schemaSemver === "string" ? health.schemaSemver : null,
        );
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const unavailable = t("general.versionUnavailable");
  const loadingLabel = t("general.versionLoading");
  const schemaValue = loading
    ? loadingLabel
    : error || schemaVersion === null || requiredSchemaVersion === null
      ? unavailable
      : formatDatabaseVersion(schemaSemver, schemaVersion, requiredSchemaVersion, t);

  return (
    <div data-testid="system-version-panel">
      <FormGrid>
        <VersionInfoTile
          label={t("general.appVersionLabel")}
          value={formatAppVersionLabel()}
          caption={t("general.appVersionHelp")}
        />
        <VersionInfoTile
          label={t("general.databaseVersionLabel")}
          value={schemaValue}
          caption={t("general.databaseVersionHelp")}
        />
      </FormGrid>
    </div>
  );
}

function VersionInfoTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <SurfaceCard density="compact" material="panel">
      <p className={formLabelClass}>{label}</p>
      <p className="mt-xs text-body font-medium tabular-nums text-text-primary">{value}</p>
      <p className={`mt-xs ${captionClass}`}>{caption}</p>
    </SurfaceCard>
  );
}
