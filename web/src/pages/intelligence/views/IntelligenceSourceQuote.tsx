import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { fetchMessage } from "../../../api/messages";
import type { Message } from "../../../types";
import { Button } from "../../../components/ui";
import { CollapsePanel } from "../../../components/ui/CollapsePanel";
import { captionClass } from "../../../components/ui/pageTypography";

interface IntelligenceSourceQuoteProps {
  sourceMessageId: string | null | undefined;
}

export function IntelligenceSourceQuote({
  sourceMessageId,
}: IntelligenceSourceQuoteProps) {
  const { t } = useTranslation("intelligence");
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);

  const id = sourceMessageId?.trim() || "";

  useEffect(() => {
    if (!id) {
      setMessage(null);
      setMissing(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    void fetchMessage(id)
      .then((row) => {
        if (!cancelled) setMessage(row);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(null);
          setMissing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <p className={captionClass} data-testid="intel-source-unbound">
        {t("detail.sourceQuoteMissing")}
      </p>
    );
  }

  return (
    <CollapsePanel
      nested
      title={t("detail.sourceQuote")}
      open={open}
      onToggle={() => setOpen((prev) => !prev)}
    >
      {loading ? (
        <p className={captionClass}>{t("detail.sourceQuoteLoading")}</p>
      ) : missing || !message ? (
        <p className={captionClass}>{t("detail.sourceQuoteGone")}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-sm" data-testid="intel-source-quote">
          <blockquote className="m-0 border-l-2 border-surface-border pl-sm text-body leading-relaxed text-text-secondary">
            {message.content?.trim() || t("detail.sourceQuoteGone")}
          </blockquote>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/monitor?id=${encodeURIComponent(id)}`)}
            >
              {t("detail.openInMonitor")}
            </Button>
          </div>
        </div>
      )}
    </CollapsePanel>
  );
}
