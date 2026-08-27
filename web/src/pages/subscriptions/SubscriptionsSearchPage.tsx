import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addCalendarShareSubscription,
  fetchCalendarShareSearch,
  type CalendarShareSearchHit,
  type CalendarShareSubscription,
} from "../../api/calendarShare";
import { SettingsContentCard, SettingsFieldGroup } from "../../components/settings/SettingsFormLayout";
import { AlertBanner, Button, DataList, ListRow, ListRowMain, ListRowMeta, TextField } from "../../components/ui";
import { formHelpClass, sectionTitleClass } from "../../components/ui/pageTypography";
import { calendarShareKey } from "../../domain/calendarShare/subscribedCalendars";
import {
  invalidateCalendarShareCatalog,
  refreshCalendarShareCatalog,
  useCalendarShareCatalog,
} from "../../domain/calendarShare/useCalendarShareCatalog";
import { toErrorMessage } from "../../utils/errors";
import { SubscribePathForm } from "./SubscribePathForm";

function isSubscribed(
  items: readonly CalendarShareSubscription[],
  handle: string,
  slug: string,
): boolean {
  return items.some(
    (row) => row.handle.toLowerCase() === handle.toLowerCase() && row.slug === slug,
  );
}

/** Search public calendars and paste handle/slug. Events still render on Timeline. */
export function SubscriptionsSearchPage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CalendarShareSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const runSearch = useCallback(async (needle: string) => {
    setSearchBusy(true);
    setActionError(null);
    try {
      const payload = await fetchCalendarShareSearch(needle);
      setHits(payload.items);
      setSearched(true);
    } catch (err) {
      setActionError(toErrorMessage(err));
    } finally {
      setSearchBusy(false);
    }
  }, []);

  useEffect(() => {
    void runSearch("");
  }, [runSearch]);

  const onAdd = async (handle: string, slug: string) => {
    setAddBusy(true);
    setActionError(null);
    try {
      await addCalendarShareSubscription({ handle, slug });
      invalidateCalendarShareCatalog();
      await refreshCalendarShareCatalog();
    } catch (err) {
      setActionError(toErrorMessage(err));
    } finally {
      setAddBusy(false);
    }
  };

  const connected = catalog.session?.connected === true;
  const ownHandle = catalog.ownHandle;
  const error = actionError ?? catalog.error;

  return (
    <SettingsContentCard>
      <SettingsFieldGroup>
        <h2 className={sectionTitleClass}>{t("search.title")}</h2>
        <p className={`mb-0 ${formHelpClass}`}>{t("search.help")}</p>
        {connected ? null : (
          <AlertBanner variant="warning" role="status" className="mb-0 max-w-[56ch]">
            {t("needLogin")}{" "}
            <Link to="/account/identity" className="font-medium text-accent no-underline hover:underline">
              {t("loginLink")}
            </Link>
          </AlertBanner>
        )}

        <form
          className="flex flex-col gap-sm sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <div className="min-w-0 flex-1">
            <TextField
              id="subscriptions-search-query"
              data-testid="subscriptions-search-query"
              value={query}
              placeholder={t("search.queryPlaceholder")}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("search.queryPlaceholder")}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={searchBusy} data-testid="subscriptions-search-submit">
            {searchBusy ? t("search.searching") : t("search.submit")}
          </Button>
        </form>

        {error ? (
          <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
            {error}
          </p>
        ) : null}

        {searched && hits.length === 0 ? (
          <p className={`mb-0 ${formHelpClass}`} data-testid="subscriptions-search-empty">
            {t("search.noResults")}
          </p>
        ) : null}

        {hits.length > 0 ? (
          <DataList maxHeightClass="max-h-[40vh]" data-testid="subscriptions-search-results">
            {hits.map((row) => {
              const key = calendarShareKey(row.handle, row.slug);
              const already = isSubscribed(catalog.items, row.handle, row.slug);
              return (
                <ListRow key={key}>
                  <ListRowMain>
                    <span className="font-medium">{key}</span>
                  </ListRowMain>
                  <ListRowMeta>
                    {row.visibility === "busy" ? t("visibility.busy") : t("visibility.details")}
                  </ListRowMeta>
                  {already ? (
                    <span className="text-caption text-text-secondary">{t("search.already")}</span>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!connected || addBusy}
                      onClick={() => void onAdd(row.handle, row.slug)}
                      data-testid={`subscriptions-add-${key}`}
                    >
                      {t("search.add")}
                    </Button>
                  )}
                </ListRow>
              );
            })}
          </DataList>
        ) : null}

        <h3 className={sectionTitleClass}>{t("search.pathTitle")}</h3>
        <SubscribePathForm
          ownHandle={ownHandle}
          busy={addBusy}
          error={null}
          onSubmit={(handle, slug) => {
            void onAdd(handle, slug);
          }}
        />
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
