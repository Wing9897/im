/**
 * Small shared bits for project detail panels (errors + ISO display).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatAnalysisErrorMessage } from "../../../domain/analysis/formatAnalysisError";
import { formatDateTime } from "../../../domain/timeline/dateUtils";

const ERROR_CLAMP_CHARS = 220;

export function formatIsoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatDateTime(ms) : iso;
}

export function ExpandableErrorText({
  text,
  testId,
}: {
  text: string;
  testId?: string;
}) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const display = formatAnalysisErrorMessage(text, t) ?? text;
  const needsClamp = display.length > ERROR_CLAMP_CHARS;
  const shown =
    !needsClamp || expanded ? display : `${display.slice(0, ERROR_CLAMP_CHARS).trimEnd()}…`;

  return (
    <div className="min-w-0" data-testid={testId}>
      <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{shown}</p>
      {needsClamp ? (
        <button
          type="button"
          className="mt-xs text-caption font-medium text-accent hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("tasks:agentDetail.showLess") : t("tasks:agentDetail.showMore")}
        </button>
      ) : null}
    </div>
  );
}
