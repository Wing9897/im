/**
 * Shared device-auth behaviour for the setup wizards.
 *
 * `FirstRunWizard` (choose → connect) and `SessionReauthWizard`
 * (single card) keep their own shells; register / login / Desktop
 * mode logic lives here so the two cannot drift.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  loginWithPassword,
  registerAdmin,
  resetPassword,
} from "../../api/setup";
import { resolveBaseUrl } from "../../api/baseUrl";
import { normalizeBaseUrl } from "../../domain/connection/connectionStore";
import {
  applyLocalWebConnectionDefaults,
  applyRemoteWebConnection,
  ensureDesktopClientMode,
  ensureDesktopHostMode,
} from "../../electron/electronConnection";
import { toErrorMessage } from "../../utils/errors";

const USERNAME_RE = /^[a-z0-9._-]+$/;

/** Where a login call should land: this host origin, or `serverUrl`. */
export interface SetupAuthTarget {
  remote: boolean;
}

/** Return `false` to skip `onComplete` — Desktop `restartShell` was triggered. */
export type SetupAuthAction = () => Promise<void | false>;

export interface SetupDeviceAuth {
  serverUrl: string;
  setServerUrl: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  deviceLabel: string;
  setDeviceLabel: (value: string) => void;
  /** An auth action or a Desktop shell restart is in flight — gate all actions. */
  pending: boolean;
  restarting: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  /** Non-error notice (e.g. password reset succeeded — still need login). */
  success: string | null;
  setSuccess: (message: string | null) => void;
  /** Run an auth action with busy gating, error capture, and `onComplete`. */
  withBusy: (action: SetupAuthAction) => Promise<void>;
  /**
   * Point the Desktop shell and Web store at this host origin before an auth
   * call. `false` → `restartShell` was triggered, abort the action.
   */
  prepareLocalHost: () => Promise<boolean>;
  markRestarting: () => void;
  onRegister: () => void;
  onLogin: (target: SetupAuthTarget) => void;
  onResetPassword: (target?: SetupAuthTarget) => void;
}

export function normalizeUsernameInput(username: string): string {
  return username.trim().toLowerCase();
}

export function useSetupDeviceAuth(onComplete: () => void): SetupDeviceAuth {
  const { t } = useTranslation("common");
  const [serverUrl, setServerUrl] = useState(() => resolveBaseUrl());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Desktop IPC and auth requests settle after `restartShell` or a phase
  // change unmounts the wizard — never touch state past that point.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const markRestarting = () => {
    if (mountedRef.current) setRestarting(true);
  };

  const reportError = (message: string | null) => {
    if (mountedRef.current) {
      setError(message);
      if (message) setSuccess(null);
    }
  };

  const reportSuccess = (message: string | null) => {
    if (mountedRef.current) {
      setSuccess(message);
      if (message) setError(null);
    }
  };

  const withBusy = async (action: SetupAuthAction) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const completed = await action();
      if (completed !== false && mountedRef.current) {
        onCompleteRef.current();
      }
    } catch (err) {
      reportError(toErrorMessage(err));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const resolveDeviceLabel = (fallbackKey: "setup.defaultHostLabel" | "setup.defaultDeviceLabel") =>
    deviceLabel.trim() || t(fallbackKey);

  const requireUsername = (): string => {
    const normalized = normalizeUsernameInput(username);
    if (!normalized || !USERNAME_RE.test(normalized)) {
      throw new Error(t("setup.usernameInvalid"));
    }
    return normalized;
  };

  const requirePassword = (value: string): string => {
    if (!value) {
      throw new Error(t("setup.passwordInvalid"));
    }
    return value;
  };

  const requireMatchingPasswords = (): string => {
    const next = requirePassword(password);
    if (password !== confirmPassword) {
      throw new Error(t("setup.passwordMismatch"));
    }
    return next;
  };

  /** Switch Desktop client → host before auth (tokens are origin-scoped). */
  const prepareLocalHost = async (): Promise<boolean> => {
    if (await ensureDesktopHostMode()) {
      markRestarting();
      return false;
    }
    applyLocalWebConnectionDefaults();
    return true;
  };

  /** @returns the normalized base URL, or `null` when the shell is restarting. */
  const prepareRemoteTarget = async (): Promise<string | null> => {
    const base = normalizeBaseUrl(serverUrl);
    if (!base) throw new Error(t("setup.serverUrlRequired"));
    // Desktop remote restart: only IPC + restartShell — do NOT write remote into
    // the host origin's im:connection (would poison resolveBaseUrl after logout).
    if (await ensureDesktopClientMode(base)) {
      markRestarting();
      return null;
    }
    applyRemoteWebConnection(base);
    return base;
  };

  const onRegister = () =>
    void withBusy(async () => {
      const user = requireUsername();
      const pass = requireMatchingPasswords();
      if (!(await prepareLocalHost())) return false;
      await registerAdmin(user, pass, resolveDeviceLabel("setup.defaultHostLabel"));
    });

  const onLogin = ({ remote }: SetupAuthTarget) =>
    void withBusy(async () => {
      const user = requireUsername();
      const pass = requirePassword(password);
      if (!remote) {
        if (!(await prepareLocalHost())) return false;
        await loginWithPassword(user, pass, resolveDeviceLabel("setup.defaultDeviceLabel"));
        return;
      }
      const base = await prepareRemoteTarget();
      if (!base) return false;
      await loginWithPassword(user, pass, resolveDeviceLabel("setup.defaultDeviceLabel"), base);
    });

  const onResetPassword = ({ remote }: SetupAuthTarget = { remote: false }) =>
    void withBusy(async () => {
      const user = requireUsername();
      const pass = requireMatchingPasswords();
      // Reset does not establish a session — skip onComplete.
      if (remote) {
        const base = normalizeBaseUrl(serverUrl);
        if (!base) throw new Error(t("setup.serverUrlRequired"));
        await resetPassword(user, pass, base);
      } else {
        await resetPassword(user, pass);
      }
      if (mountedRef.current) {
        setPassword("");
        setConfirmPassword("");
      }
      reportSuccess(t("setup.resetPasswordOk"));
      return false;
    });

  return {
    serverUrl,
    setServerUrl,
    username,
    setUsername,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    deviceLabel,
    setDeviceLabel,
    pending: busy || restarting,
    restarting,
    error,
    setError: reportError,
    success,
    setSuccess: reportSuccess,
    withBusy,
    prepareLocalHost,
    markRestarting,
    onRegister,
    onLogin,
    onResetPassword,
  };
}
