import type { ReactNode } from "react";
import { formHelpClass, pageTitleClass } from "../ui/pageTypography";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../settings/SettingsFormLayout";
import { LanguageSwitcher } from "../settings/LanguageSwitcher";

interface AuthSetupShellProps {
  /** Root test id (e.g. first-run-wizard / session-reauth-wizard). */
  testId: string;
  title: string;
  intro: string;
  /** Optional progress rail / extra header content under the intro. */
  headerExtra?: ReactNode;
  children: ReactNode;
  restarting?: boolean;
  restartingLabel?: string;
  error?: string | null;
  success?: string | null;
  /** Slightly narrower card for login; register may pass false. */
  narrow?: boolean;
}

/**
 * Shared full-screen chrome for register / login setup.
 * Soft background, language select (card top-right), centered form column.
 */
export function AuthSetupShell({
  testId,
  title,
  intro,
  headerExtra,
  children,
  restarting,
  restartingLabel,
  error,
  success,
  narrow = false,
}: AuthSetupShellProps) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-y-auto px-page-x py-xl text-text-primary max-[780px]:px-sm max-[780px]:py-lg"
      data-testid={testId}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-surface-base"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 100%, color-mix(in srgb, var(--surface-card) 65%, transparent), transparent 50%)",
        }}
        aria-hidden="true"
      />

      <div
        className={[
          "relative z-[1] w-full im-enter-rise",
          narrow ? "max-w-[420px]" : "max-w-[480px]",
        ].join(" ")}
      >
        <div className="relative">
          <SettingsContentCard>
            <SettingsFieldGroup>
              <div className="flex justify-end">
                <LanguageSwitcher variant="compact" />
              </div>

              <header className="flex flex-col items-center gap-xs px-sm text-center">
                <h1 className={`${pageTitleClass} m-0`}>{title}</h1>
                <p className={`mb-0 ${formHelpClass} mx-auto max-w-[36ch] text-center`}>
                  {intro}
                </p>
              </header>

              {headerExtra ? (
                <div className="flex w-full justify-center">{headerExtra}</div>
              ) : null}

              {restarting && restartingLabel ? (
                <p
                  className={`mb-0 text-center ${formHelpClass}`}
                  data-testid="setup-restarting"
                >
                  {restartingLabel}
                </p>
              ) : null}

              <div className="w-full">{children}</div>

              {success ? (
                <p
                  className={`mb-0 text-center ${formHelpClass} text-accent`}
                  role="status"
                  data-testid="setup-success"
                >
                  {success}
                </p>
              ) : null}
              {error ? (
                <p
                  className={`mb-0 text-center ${formHelpClass} text-error`}
                  role="alert"
                  data-testid="setup-error"
                >
                  {error}
                </p>
              ) : null}
            </SettingsFieldGroup>
          </SettingsContentCard>
        </div>
      </div>
    </div>
  );
}
