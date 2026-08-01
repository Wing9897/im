import { useTranslation } from "react-i18next";

import { SettingsRow, TextField } from "../ui";
import type { SetupDeviceAuth } from "./useSetupDeviceAuth";
import { normalizeUsernameInput } from "./useSetupDeviceAuth";

export type SetupAuthField =
  | "serverUrl"
  | "username"
  | "password"
  | "confirmPassword"
  | "deviceLabel";

interface SetupAuthFormFieldsProps {
  /** DOM id / test id namespace — `setup` for first run, `reauth` for re-login. */
  idPrefix: "setup" | "reauth";
  auth: SetupDeviceAuth;
  /** Rows to render, in order. */
  fields: readonly SetupAuthField[];
  /** Pin the server URL to the current origin. */
  lockServerUrl?: boolean;
  /** Overrides the device-name default hint (host register uses its own). */
  deviceLabelPlaceholder?: string;
  /** `new-password` on register / reset; `current-password` on login. */
  passwordAutoComplete?: "current-password" | "new-password";
}

const fieldClass = "w-full";

/**
 * Shared auth input rows for both setup wizards. The wizards keep their own
 * shells and buttons; only these fields and their ids are common.
 */
export function SetupAuthFormFields({
  idPrefix,
  auth,
  fields,
  lockServerUrl = false,
  deviceLabelPlaceholder,
  passwordAutoComplete = "current-password",
}: SetupAuthFormFieldsProps) {
  const { t } = useTranslation("common");

  const renderField = (field: SetupAuthField) => {
    switch (field) {
      case "serverUrl":
        return (
          <SettingsRow
            key={field}
            label={t("setup.serverUrl")}
            htmlFor={`${idPrefix}-server-url`}
          >
            <TextField
              id={`${idPrefix}-server-url`}
              className={fieldClass}
              value={auth.serverUrl}
              onChange={(e) => auth.setServerUrl(e.target.value)}
              placeholder={t("setup.serverUrlPlaceholder")}
              disabled={lockServerUrl}
              readOnly={lockServerUrl}
              data-testid={`${idPrefix}-server-url`}
            />
          </SettingsRow>
        );
      case "username":
        return (
          <SettingsRow
            key={field}
            label={t("setup.username")}
            htmlFor={`${idPrefix}-username`}
          >
            <TextField
              id={`${idPrefix}-username`}
              className={fieldClass}
              value={auth.username}
              onChange={(e) => auth.setUsername(normalizeUsernameInput(e.target.value))}
              placeholder={t("setup.usernamePlaceholder")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              data-testid={`${idPrefix}-username`}
            />
          </SettingsRow>
        );
      case "password":
        return (
          <SettingsRow
            key={field}
            label={t("setup.password")}
            htmlFor={`${idPrefix}-password`}
          >
            <TextField
              id={`${idPrefix}-password`}
              type="password"
              className={fieldClass}
              value={auth.password}
              onChange={(e) => auth.setPassword(e.target.value)}
              autoComplete={passwordAutoComplete}
              data-testid={`${idPrefix}-password`}
            />
          </SettingsRow>
        );
      case "confirmPassword":
        return (
          <SettingsRow
            key={field}
            label={t("setup.confirmPassword")}
            htmlFor={`${idPrefix}-confirm-password`}
          >
            <TextField
              id={`${idPrefix}-confirm-password`}
              type="password"
              className={fieldClass}
              value={auth.confirmPassword}
              onChange={(e) => auth.setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              data-testid={`${idPrefix}-confirm-password`}
            />
          </SettingsRow>
        );
      case "deviceLabel":
        return (
          <SettingsRow
            key={field}
            label={t("setup.deviceLabel")}
            htmlFor={`${idPrefix}-device-label`}
          >
            <TextField
              id={`${idPrefix}-device-label`}
              className={fieldClass}
              value={auth.deviceLabel}
              onChange={(e) => auth.setDeviceLabel(e.target.value)}
              placeholder={deviceLabelPlaceholder ?? t("setup.defaultDeviceLabel")}
              data-testid={`${idPrefix}-device-label`}
            />
          </SettingsRow>
        );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[320px] flex-col gap-md">
      {fields.map(renderField)}
    </div>
  );
}
