import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import { isOwnCalendarHandle, parseCalendarSharePath } from "../../domain/calendarShare/subscribedCalendars";

type Props = {
  ownHandle: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (handle: string, slug: string) => void;
};

/** Paste `handle/slug` to subscribe; rejects the signed-in calendar-share handle. */
export function SubscribePathForm({ ownHandle, busy = false, error, onSubmit }: Props) {
  const { t } = useTranslation("subscriptions");
  const [path, setPath] = useState("");
  const parsed = parseCalendarSharePath(path);
  const own = parsed ? isOwnCalendarHandle(parsed.handle, ownHandle) : false;
  const invalid = path.trim().length > 0 && (parsed === null || own);

  const submit = () => {
    if (!parsed || own || busy) return;
    onSubmit(parsed.handle, parsed.slug);
  };

  return (
    <div className="flex flex-col gap-sm">
      <p className={`mt-0 ${formHelpClass}`}>{t("search.pathHelp")}</p>
      <TextField
        id="subscribe-path"
        data-testid="subscribe-path"
        value={path}
        disabled={busy}
        placeholder={t("search.pathPlaceholder")}
        onChange={(event) => setPath(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
      />
      {invalid ? (
        <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
          {own ? t("search.rejectOwn") : t("search.invalidPath")}
        </p>
      ) : null}
      {error ? (
        <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="primary"
          disabled={busy || !parsed || own}
          onClick={submit}
          data-testid="subscribe-path-submit"
        >
          {busy ? t("search.adding") : t("search.add")}
        </Button>
      </div>
    </div>
  );
}
