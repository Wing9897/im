import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSchemaStatus } from "../../api/schema";
import { formatAppVersionLabel } from "../../utils/appVersion";
import { SettingsRow } from "../ui";

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
        const schema = await fetchSchemaStatus();
        if (cancelled) return;
        setSchemaVersion(schema.schemaVersion);
        setRequiredSchemaVersion(schema.requiredSchemaVersion);
        setSchemaSemver(
          typeof schema.schemaSemver === "string" ? schema.schemaSemver : null,
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

  return (
    <div className="flex flex-col gap-lg" data-testid="system-version-panel">
      <SettingsRow label={t("general.appVersionLabel")} help={t("general.appVersionHelp")}>
        <p className="text-body font-medium text-text-primary">{formatAppVersionLabel()}</p>
      </SettingsRow>
      <SettingsRow label={t("general.databaseVersionLabel")} help={t("general.databaseVersionHelp")}>
        <p className="text-body font-medium text-text-primary">
          {loading
            ? loadingLabel
            : error || schemaVersion === null || requiredSchemaVersion === null
              ? unavailable
              : formatDatabaseVersion(schemaSemver, schemaVersion, requiredSchemaVersion, t)}
        </p>
      </SettingsRow>
    </div>
  );
}
