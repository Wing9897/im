import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FormField, SelectField, SettingsRow, TextField } from "../../../components/ui";
import type { ActionFormState, HeaderEntry } from "../form/useActionFormDialog";

export function MqttFields({
  form,
  fieldErrors,
  submitting,
  onChange,
}: {
  form: ActionFormState;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onChange: (field: keyof ActionFormState, value: string | boolean | number | HeaderEntry[]) => void;
}) {
  const { t } = useTranslation("actions");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
      <SettingsRow label={t("fields.brokerUrl")} htmlFor="action-mqtt-broker">
        <FormField error={fieldErrors.broker_url}>
          <TextField
            id="action-mqtt-broker"
            type="text"
            placeholder="mqtt://broker.example.com:1883"
            value={form.mqttBrokerUrl}
            onChange={(e) => onChange("mqttBrokerUrl", e.target.value)}
            disabled={submitting}
          />
        </FormField>
      </SettingsRow>

      <SettingsRow label={t("fields.topic")} htmlFor="action-mqtt-topic">
        <FormField error={fieldErrors.topic}>
          <TextField
            id="action-mqtt-topic"
            type="text"
            placeholder="intelligence/alerts"
            value={form.mqttTopic}
            onChange={(e) => onChange("mqttTopic", e.target.value)}
            disabled={submitting}
          />
        </FormField>
      </SettingsRow>

      <SettingsRow label={t("fields.username")} htmlFor="action-mqtt-username">
        <FormField error={fieldErrors.username}>
          <TextField
            id="action-mqtt-username"
            type="text"
            placeholder={t("fields.optional")}
            value={form.mqttUsername}
            onChange={(e) => onChange("mqttUsername", e.target.value)}
            disabled={submitting}
          />
        </FormField>
      </SettingsRow>

      <SettingsRow label={t("fields.password")} htmlFor="action-mqtt-password">
        <FormField error={fieldErrors.password}>
          <div className="relative">
            <TextField
              id="action-mqtt-password"
              className="pr-9"
              type={showPassword ? "text" : "password"}
              placeholder={t("fields.optional")}
              value={form.mqttPassword}
              onChange={(e) => onChange("mqttPassword", e.target.value)}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex min-h-6 min-w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-1 text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
              tabIndex={-1}
              aria-label={showPassword ? t("fields.hidePassword") : t("fields.showPassword")}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Eye size={18} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </FormField>
      </SettingsRow>

      <SettingsRow label={t("fields.qosLevel")} htmlFor="action-mqtt-qos">
        <SelectField
          id="action-mqtt-qos"
          value={form.mqttQos}
          onChange={(e) => onChange("mqttQos", Number(e.target.value))}
          disabled={submitting}
        >
          <option value={0}>0 - At most once</option>
          <option value={1}>1 - At least once</option>
          <option value={2}>2 - Exactly once</option>
        </SelectField>
      </SettingsRow>
    </div>
  );
}
