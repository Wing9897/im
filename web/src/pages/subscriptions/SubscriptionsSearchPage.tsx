import { Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError } from "../../api/parseApiError";
import {
  addCalendarShareSubscription,
  fetchCalendarShareSearch,
  type CalendarShareSearchHit,
  type CalendarShareSubscription,
} from "../../api/calendarShare";
import { Badge, Button, OpsControlBar, TextField } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  isCalendarShareNotFound,
  isOwnCalendarHandle,
  looksLikeCalendarSharePath,
  parseCalendarSharePath,
  subscribeCalendarIdentity,
  subscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";
import { isSearchGrantHit, searchHitToneKey } from "../../domain/calendarShare/listingVisibility";
import {
  invalidateCalendarShareCatalog,
  useCalendarShareCatalog,
} from "../../domain/calendarShare/useCalendarShareCatalog";
import { toErrorMessage } from "../../utils/errors";
import {
  SubscriptionCalendarCard,
  visibilityAccentClass,
  visibilityBadgeTone,
} from "./SubscriptionCalendarCard";
import { SubscriptionsCardSection, SubscriptionsPageChrome } from "./SubscriptionsPageChrome";

function isSubscribed(
  items: readonly CalendarShareSubscription[],
  handle: string,
  slug: string,
): boolean {
  return items.some(
    (row) => row.handle.toLowerCase() === handle.toLowerCase() && row.slug === slug,
  );
}

function subscribeFailureMessage(error: unknown, noGrant: string, rejectOwn: string): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) return noGrant;
    if (error.status === 422 && /own calendar/i.test(error.message)) return rejectOwn;
  }
  return toErrorMessage(error);
}

/** Search public calendars and paste handle/slug. Events still render on Timeline. */
export function SubscriptionsSearchPage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [recommended, setRecommended] = useState<CalendarShareSearchHit[]>([]);
  const [hits, setHits] = useState<CalendarShareSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchBusy, setSearchBusy] = useState(true);
  const [addBusy, setAddBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const loadRecommended = useCallback(async () => {
    setSearchBusy(true);
    try {
      const payload = await fetchCalendarShareSearch("");
      setRecommended(payload.items ?? []);
      setHits([]);
      setSearched(false);
      setCommittedQuery("");
      setSearchError(null);
    } catch (err) {
      if (isCalendarShareNotFound(err)) {
        setRecommended([]);
        setSearchError(null);
      } else {
        setSearchError(toErrorMessage(err));
      }
    } finally {
      setSearchBusy(false);
    }
  }, []);

  const runSearch = useCallback(async (needle: string) => {
    setSearchBusy(true);
    setSearchError(null);
    try {
      const payload = await fetchCalendarShareSearch(needle);
      setHits(payload.items ?? []);
      setSearched(true);
      setCommittedQuery(needle);
    } catch (err) {
      if (isCalendarShareNotFound(err)) {
        setHits([]);
        setSearched(true);
        setSearchError(null);
      } else {
        setSearchError(toErrorMessage(err));
      }
    } finally {
      setSearchBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommended();
  }, [loadRecommended]);

  const onAdd = async (handle: string, slug: string, clearQuery = false) => {
    setAddBusy(true);
    setFieldError(null);
    try {
      await addCalendarShareSubscription({ handle, slug });
      await invalidateCalendarShareCatalog();
      if (clearQuery) setQuery("");
    } catch (err) {
      setFieldError(subscribeFailureMessage(err, t("search.noGrant"), t("search.rejectOwn")));
    } finally {
      setAddBusy(false);
    }
  };

  const status = subscribePageStatus({
    loading: catalog.loading,
    connected: catalog.session?.connected,
    unreachable: catalog.unreachable,
  });
  const canMutate = status === "ok";
  const ownHandle = catalog.ownHandle;
  const chromeError = searchError ?? (status === "ok" ? catalog.error : null);
  const pathMode = looksLikeCalendarSharePath(query);
  const parsed = pathMode ? parseCalendarSharePath(query) : null;
  const own = parsed ? isOwnCalendarHandle(parsed.handle, ownHandle) : false;
  const filtering = committedQuery.length > 0 && !pathMode;
  const rows = filtering ? hits : recommended;
  const listLoading = filtering ? !searched : searchBusy && recommended.length === 0;
  const listTestId = filtering ? "subscriptions-search-results" : "subscriptions-search-recommended";
  const emptyTestId = filtering ? "subscriptions-search-empty" : "subscriptions-search-recommended-empty";
  const empty = filtering ? t("search.noResults") : t("search.recommendedEmpty");
  const fieldMessage = own
    ? t("search.rejectOwn")
    : pathMode && query.trim() && parsed === null
      ? t("search.invalidPath")
      : fieldError;
  const showPathHint = !fieldMessage;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const needle = query.trim();
    if (looksLikeCalendarSharePath(needle)) {
      if (!parsed || own || !canMutate) return;
      void onAdd(parsed.handle, parsed.slug, true);
      return;
    }
    if (!needle) {
      void loadRecommended();
      return;
    }
    void runSearch(needle);
  };

  const renderHit = (row: CalendarShareSearchHit) => {
    const identity = subscribeCalendarIdentity(row);
    const already = isSubscribed(catalog.items, row.handle, row.slug);
    const grantHit = isSearchGrantHit(row);
    const tone = searchHitToneKey(row);
    const badgeLabel = grantHit
      ? tone === "busy"
        ? t("published.form.grantVisibilityBusy")
        : t("published.form.grantVisibilityDetails")
      : t(`visibility.${tone}`);
    return (
      <SubscriptionCalendarCard
        key={identity.key}
        title={identity.label}
        emoji={identity.emoji}
        description={row.description}
        accentClass={visibilityAccentClass(tone)}
        data-testid={`subscriptions-search-card-${identity.key}`}
        badge={
          <Badge tone={visibilityBadgeTone(tone)} data-testid={`subscriptions-search-visibility-${identity.key}`}>
            {badgeLabel}
          </Badge>
        }
        actions={
          already ? (
            <span className="text-caption text-text-secondary">{t("search.already")}</span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canMutate || addBusy}
              onClick={() => void onAdd(row.handle, row.slug)}
              data-testid={`subscriptions-add-${identity.key}`}
            >
              {t("search.add")}
            </Button>
          )
        }
      />
    );
  };

  const submitDisabled = pathMode
    ? addBusy || !canMutate || !parsed || own
    : searchBusy;

  return (
    <SubscriptionsPageChrome status={status} error={chromeError}>
      <div className="flex flex-col gap-sm">
        <OpsControlBar ariaLabel={t("tabs.search")} data-testid="subscriptions-search-toolbar" className="!mb-0 flex-wrap">
          <form className="flex min-w-0 flex-1 flex-wrap items-center gap-sm" onSubmit={onSubmit}>
            <div className="min-w-[10rem] flex-1">
              <TextField
                id="subscriptions-search-query"
                data-testid="subscriptions-search-query"
                value={query}
                placeholder={t("search.queryPlaceholder")}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFieldError(null);
                }}
                aria-label={t("search.queryPlaceholder")}
              />
            </div>
            <Button
              type="submit"
              variant={pathMode ? "primary" : "secondary"}
              disabled={submitDisabled}
              data-testid="subscriptions-search-submit"
            >
              {pathMode ? null : <Search size={16} strokeWidth={2} aria-hidden />}
              {pathMode
                ? addBusy
                  ? t("search.adding")
                  : t("search.add")
                : searchBusy
                  ? t("search.searching")
                  : t("search.submit")}
            </Button>
          </form>
        </OpsControlBar>
        {fieldMessage ? (
          <p className={`mb-0 ${formHelpClass} text-error`} role="alert" data-testid="subscriptions-search-hint">
            {fieldMessage}
          </p>
        ) : showPathHint ? (
          <p className={`mb-0 ${formHelpClass}`} data-testid="subscriptions-search-hint">
            {t("search.pathHint")}
          </p>
        ) : null}
      </div>

      {pathMode ? null : (
        <SubscriptionsCardSection
          status={status}
          loading={listLoading}
          hasItems={rows.length > 0}
          empty={<p className={`mb-0 ${formHelpClass}`}>{empty}</p>}
          emptyTestId={emptyTestId}
          listTestId={listTestId}
        >
          {rows.map(renderHit)}
        </SubscriptionsCardSection>
      )}
    </SubscriptionsPageChrome>
  );
}
