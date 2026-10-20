import { useCallback, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { SegmentedControl } from "../../../components/ui";
import type { SourcePlatformTabProps } from "../plugins/types";
import { WebhookPanel } from "../webhook/WebhookPanel";
import { HttpTab } from "./HttpTab";

type HttpSubMode = "poll" | "webhook";

function parseHttpSubMode(value: string | null): HttpSubMode {
  return value === "webhook" ? "webhook" : "poll";
}

function HttpModeToggle({
  value,
  onChange,
}: {
  value: HttpSubMode;
  onChange: (mode: HttpSubMode) => void;
}) {
  const { t } = useTranslation("sources");

  return (
    <SegmentedControl
      layout="inline"
      ariaLabel={t("http.modeAria")}
      value={value}
      onChange={(id) => onChange(id as HttpSubMode)}
      items={[
        { id: "poll", label: t("http.modePoll") },
        { id: "webhook", label: t("http.modeWebhook") },
      ]}
      className="mb-0"
    />
  );
}

/** Top-level HTTP sources tab: poll sources + inbound Webhook config. */
export function HttpPlatformTab({
  tabParam = "tab",
  modeParam = "mode",
}: SourcePlatformTabProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = useMemo(
    () => parseHttpSubMode(searchParams.get(modeParam)),
    [modeParam, searchParams],
  );

  const setMode = useCallback(
    (next: HttpSubMode) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set(tabParam, "http");
          if (next === "poll") params.delete(modeParam);
          else params.set(modeParam, next);
          return params;
        },
        { replace: true },
      );
    },
    [modeParam, setSearchParams, tabParam],
  );

  const modeToggle: ReactNode = (
    <HttpModeToggle value={mode} onChange={setMode} />
  );

  return mode === "webhook" ? (
    <WebhookPanel modeToggle={modeToggle} />
  ) : (
    <HttpTab modeToggle={modeToggle} />
  );
}
