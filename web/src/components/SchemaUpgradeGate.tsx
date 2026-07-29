import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSchemaStatus, startSchemaUpgrade } from "../api/schema";
import type { SchemaUpgradeStatus } from "../types/schema";
import { AlertBanner } from "./ui/AlertBanner";
import { Button } from "./ui/Button";
import { PillButton } from "./ui/PillButton";
import { pageTitleClass } from "./ui/pageTypography";

function statusGuidance(
  status: SchemaUpgradeStatus | null,
  t: (key: string) => string,
): {
  title: string;
  body: string;
  tone?: "warning" | "error";
} | null {
  if (!status) return null;
  if (status.restoredFromBackup) {
    return {
      title: t("schema.restoredTitle"),
      body: t("schema.restoredBody"),
      tone: "warning",
    };
  }
  if (status.state === "needs_upgrade") {
    return {
      title: t("schema.needsTitle"),
      body: t("schema.needsBody"),
    };
  }
  if (status.state === "failed") {
    if (status.backupPath) {
      return {
        title: t("schema.failedBackupTitle"),
        body: t("schema.failedBackupBody"),
        tone: "error",
      };
    }
    return {
      title: t("schema.failedNoBackupTitle"),
      body: t("schema.failedNoBackupBody"),
      tone: "error",
    };
  }
  if (status.state === "migrating") {
    return {
      title: t("schema.migratingTitle"),
      body: t("schema.migratingBody"),
    };
  }
  return null;
}

function localizePhase(
  phase: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!phase) return t("schema.phases.idle");
  return t(`schema.phases.${phase}`, { defaultValue: phase });
}

function localizeMessage(
  messageKey: string | undefined,
  status: SchemaUpgradeStatus | null,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!messageKey) return fallback;
  return t(`schema.messages.${messageKey}`, {
    current: status?.schemaVersion,
    required: status?.requiredSchemaVersion,
    defaultValue: messageKey,
  });
}

interface SchemaUpgradeGateProps {
  onReady: () => void;
}

export function SchemaUpgradeGate({ onReady }: SchemaUpgradeGateProps) {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<SchemaUpgradeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSchemaStatus();
      setStatus(next);
      setLoadError(null);
      if (next.runtimeReady) onReady();
      return next;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [onReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!busy && status?.state !== "migrating") return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 500);
    return () => window.clearInterval(timer);
  }, [busy, refresh, status?.state]);

  const handleUpgrade = async () => {
    setBusy(true);
    setStatus((prev) =>
      prev
        ? {
            ...prev,
            state: "migrating",
            progress: {
              phase: "migrate",
              percent: Math.max(prev.progress.percent, 5),
              message: "starting",
            },
          }
        : prev,
    );
    try {
      const next = await startSchemaUpgrade();
      setStatus(next);
      if (next.runtimeReady) onReady();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCopyBackup = async () => {
    if (!status?.backupPath) return;
    try {
      await navigator.clipboard.writeText(status.backupPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const percent = status?.progress.percent ?? 0;
  const phaseLabel = localizePhase(status?.progress.phase, t);
  const message = localizeMessage(
    status?.progress.message,
    status,
    loadError || t("schema.checking"),
    t,
  );
  const guidance = statusGuidance(status, t);
  const canRetry =
    status?.state === "needs_upgrade" || status?.state === "failed";
  const retryBlocked =
    status?.state === "failed" && !status.backupPath && !status.restoredFromBackup;
  const buttonLabel =
    busy || status?.state === "migrating"
      ? t("schema.upgrading")
      : status?.restoredFromBackup || status?.error
        ? t("schema.retry")
        : t("schema.start");

  const progressWidth =
    status?.state === "failed" ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-xl text-text-primary">
      <div
        className="w-full max-w-[480px] rounded-lg border border-surface-border bg-surface-card p-2xl shadow-md"
        role="dialog"
        aria-modal="true"
        aria-label={t("schema.dialogAria")}
      >
        <h1 className={pageTitleClass}>{t("schema.title")}</h1>
        {status && (
          <p className="mt-md text-body leading-normal text-text-secondary">
            {t("schema.versionLine", {
              current: status.schemaVersion,
              required: status.requiredSchemaVersion,
            })}
          </p>
        )}
        {guidance && (
          <AlertBanner
            variant={guidance.tone ?? "info"}
            className="mt-lg !mb-0"
          >
            <strong className="mb-1 block">{guidance.title}</strong>
            {guidance.body}
          </AlertBanner>
        )}
        <div
          className="mt-lg h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--surface-border)_80%,transparent)]"
          aria-hidden="true"
        >
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <p className="mt-sm text-body leading-normal text-text-secondary" aria-live="polite">
          <span className="font-semibold text-text-primary">{phaseLabel}</span>
          {" · "}
          {message}
        </p>
        {status?.backupPath && (
          <p className="mt-md break-all text-xs leading-normal text-text-secondary select-text">
            {t("schema.backupPath", { path: status.backupPath })}
            <PillButton
              type="button"
              className="ml-sm"
              onClick={() => {
                void handleCopyBackup();
              }}
            >
              {copied ? t("schema.copied") : t("schema.copy")}
            </PillButton>
          </p>
        )}
        {(status?.error || loadError) && (
          <details className="mt-md text-body leading-normal text-text-secondary">
            <summary className="cursor-pointer text-error">{t("schema.techDetails")}</summary>
            <pre className="mt-sm whitespace-pre-wrap break-words rounded-md bg-[color-mix(in_srgb,var(--error)_8%,transparent)] p-sm text-xs leading-normal text-error">
              {status?.error || loadError}
            </pre>
          </details>
        )}
        {canRetry && !retryBlocked && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="mt-xl w-full"
            disabled={busy}
            onClick={() => {
              void handleUpgrade();
            }}
          >
            {buttonLabel}
          </Button>
        )}
        {retryBlocked && (
          <p className="mt-lg text-body leading-normal text-error">
            {t("schema.retryBlocked")}
          </p>
        )}
      </div>
    </div>
  );
}
