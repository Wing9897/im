import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { EmptyStateGlyph } from "../components/common/EmptyStateGlyph";
import { AppPageShell, Button } from "../components/ui";
import { homePathForMode } from "../domain/ui/simpleMode";
import { useSimpleMode } from "../context/SimpleModeContext";

/** Catch-all unknown SPA path — home button, no silent redirect. */
export function NotFoundPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { simpleMode } = useSimpleMode();

  return (
    <AppPageShell>
      <EmptyState
        illustration={<EmptyStateGlyph icon={SearchX} />}
        title={t("ui.notFound.title")}
        description={t("ui.notFound.body")}
        actions={
          <Button
            variant="primary"
            onClick={() => navigate(homePathForMode(simpleMode))}
            data-testid="not-found-home"
          >
            {t("ui.notFound.home")}
          </Button>
        }
      />
    </AppPageShell>
  );
}
