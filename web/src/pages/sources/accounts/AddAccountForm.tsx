import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedControl, SettingsRow, TextField } from "../../../components/ui";
import { SourceAddFormCard } from "../SourceAddFormCard";

export type TelegramLoginMethod = "phone" | "qr";

interface AddAccountFormProps {
  loginMethod: TelegramLoginMethod;
  setLoginMethod: (value: TelegramLoginMethod) => void;
  apiId: string;
  setApiId: (value: string) => void;
  apiHash: string;
  setApiHash: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  submitting: boolean;
  onSubmit: () => Promise<void>;
}

export function AddAccountForm({
  loginMethod,
  setLoginMethod,
  apiId,
  setApiId,
  apiHash,
  setApiHash,
  phone,
  setPhone,
  submitting,
  onSubmit,
}: AddAccountFormProps) {
  const { t } = useTranslation("sources");
  const methodItems = useMemo(
    () => [
      { id: "phone", label: t("telegramFields.methodPhone") },
      { id: "qr", label: t("telegramFields.methodQr") },
    ],
    [t],
  );
  const needsPhone = loginMethod === "phone";
  const disabled = submitting || !apiId || !apiHash || (needsPhone && !phone);

  return (
    <SourceAddFormCard
      submitLabel={
        loginMethod === "qr"
          ? t("telegramFields.showQr")
          : t("telegramFields.addAccount")
      }
      submittingLabel={t("telegramFields.connecting")}
      submitting={submitting}
      submitDisabled={disabled}
      onSubmit={() => void onSubmit().catch(() => {})}
    >
      <div className="flex flex-col gap-xl">
        <SegmentedControl
          layout="inline"
          items={methodItems}
          value={loginMethod}
          onChange={(id) => setLoginMethod(id === "qr" ? "qr" : "phone")}
          ariaLabel={t("telegramFields.methodAria")}
        />
        <div className="grid gap-xl md:grid-cols-2">
          <SettingsRow label={t("telegramFields.apiId")} htmlFor="telegram-api-id">
            <TextField
              id="telegram-api-id"
              type="text"
              placeholder={t("telegramFields.apiIdPlaceholder")}
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              disabled={submitting}
              maxLength={32}
            />
          </SettingsRow>
          <SettingsRow label={t("telegramFields.apiHash")} htmlFor="telegram-api-hash">
            <TextField
              id="telegram-api-hash"
              type="text"
              placeholder={t("telegramFields.apiHashPlaceholder")}
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              disabled={submitting}
              maxLength={128}
            />
          </SettingsRow>
        </div>
        {needsPhone ? (
          <SettingsRow label={t("telegramFields.phone")} htmlFor="telegram-phone">
            <TextField
              id="telegram-phone"
              type="text"
              placeholder={t("telegramFields.phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              maxLength={32}
            />
          </SettingsRow>
        ) : (
          <p className="text-body text-text-secondary">{t("telegramFields.qrHelp")}</p>
        )}
      </div>
    </SourceAddFormCard>
  );
}
