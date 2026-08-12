import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createAccessKey,
  fetchAccessKeys,
  revokeAccessKey,
  type AccessKeyPublic,
} from "../../../api/accessKeys";
import { ResolvedApiBaseUrl } from "../../../components/settings/ResolvedApiBaseUrl";
import { Button, CheckboxField, FormStack, SettingsRow, TextField } from "../../../components/ui";
import { formHelpClass, sectionTitleClass } from "../../../components/ui/pageTypography";
import { useToast } from "../../../context/ToastContext";
import { toErrorMessage } from "../../../utils/errors";

function formatScopes(scopes: string[] | undefined, t: (key: string) => string): string {
  if (!scopes || scopes.length === 0 || scopes.includes("*")) {
    return t("account.accessKeys.scopesFull");
  }
  if (scopes.includes("read")) {
    return t("account.accessKeys.scopesReadOnly");
  }
  return scopes.join(", ");
}

export function AccountAccessKeysSection() {
  const { t } = useTranslation("common");
  const { showToast } = useToast();

  const [keys, setKeys] = useState<AccessKeyPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAccessKeys();
      setKeys(response.keys ?? []);
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onCreate = async () => {
    setCreating(true);
    setRevealedSecret(null);
    try {
      const label = newLabel.trim() || t("account.accessKeys.defaultLabel");
      const created = await createAccessKey(label, { readOnly });
      setRevealedSecret(created.key);
      setNewLabel("");
      setReadOnly(false);
      await reload();
      showToast(t("account.accessKeys.created"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await revokeAccessKey(id);
      await reload();
      showToast(t("account.accessKeys.revoked"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const onCopySecret = async () => {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      showToast(t("account.accessKeys.copied"), "success");
    } catch {
      showToast(t("account.accessKeys.copyFailed"), "error");
    }
  };

  return (
    <section id="access-keys" data-testid="profile-access-keys">
      <FormStack gap="lg">
        <div>
          <h2 className={`${sectionTitleClass} m-0`}>{t("account.accessKeys.title")}</h2>
          <p className={`mb-0 mt-xs max-w-[56ch] ${formHelpClass}`}>
            {t("account.accessKeys.intro")}
          </p>
        </div>

        <ResolvedApiBaseUrl
          ns="common"
          titleKey="account.accessKeys.baseUrlTitle"
          bodyKey="account.accessKeys.baseUrlBody"
          testId="account-keys-api-base-url"
        />

        <SettingsRow label={t("account.accessKeys.newLabel")} htmlFor="access-key-label">
          <TextField
            id="access-key-label"
            className="max-w-[320px]"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t("account.accessKeys.newPlaceholder")}
            data-testid="access-key-label-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating) {
                e.preventDefault();
                void onCreate();
              }
            }}
          />
        </SettingsRow>

        <CheckboxField
          id="access-key-read-only"
          data-testid="access-key-read-only"
          label={t("account.accessKeys.readOnly")}
          help={t("account.accessKeys.readOnlyHelp")}
          checked={readOnly}
          onChange={(e) => setReadOnly(e.target.checked)}
        />

        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={creating}
            onClick={() => void onCreate()}
            data-testid="access-key-create"
          >
            <Plus size={14} strokeWidth={2} aria-hidden />
            {creating ? t("account.accessKeys.creating") : t("account.accessKeys.create")}
          </Button>
        </div>

        {revealedSecret ? (
          <div
            className="max-w-[480px] rounded-md border border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-md"
            data-testid="access-key-reveal"
          >
            <p className={`${sectionTitleClass} m-0`}>{t("account.accessKeys.revealTitle")}</p>
            <p className={`mb-sm mt-xs ${formHelpClass}`}>{t("account.accessKeys.revealHelp")}</p>
            <p className="mb-sm break-all font-mono text-caption text-text-primary">{revealedSecret}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void onCopySecret()}>
              <Copy size={14} aria-hidden />
              {t("account.accessKeys.copy")}
            </Button>
          </div>
        ) : null}

        <div>
          <p className={`${sectionTitleClass} m-0 mb-sm`}>{t("account.accessKeys.listTitle")}</p>
          {loading ? (
            <p className={`${formHelpClass} mb-0`}>{t("ui.loading")}</p>
          ) : keys.length === 0 ? (
            <p className={`${formHelpClass} mb-0`} data-testid="access-keys-empty">
              {t("account.accessKeys.empty")}
            </p>
          ) : (
            <ul className="m-0 max-w-[480px] list-none space-y-xs p-0">
              {keys.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-sm rounded-md border border-surface-border px-sm py-xs"
                  data-testid={`access-key-row-${entry.id}`}
                >
                  <span className="min-w-0 text-body">
                    <span className="font-medium">{entry.label}</span>
                    <span className="ml-sm font-mono text-caption text-text-muted">
                      {entry.preview}
                    </span>
                    <span className="mt-xxs block text-caption text-text-muted">
                      {formatScopes(entry.scopes, t)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t("account.accessKeys.revokeAria", { label: entry.label })}
                    onClick={() => void onRevoke(entry.id)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormStack>
    </section>
  );
}
