import { useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import {
  FOCAL_REFRESH_HOUR_OPTIONS,
  advanceAndMaterializeFocal,
  applyBgImage,
  loadBgForTheme,
  loadBgOpacity,
  loadFocalCache,
  parseFocalRefreshHours,
  parseThemeBgMode,
  refreshFocalBackground,
  resolveThemeBgMode,
  saveFocalRefreshHours,
  saveThemeBgMode,
  storageBgKey,
  storageBgOpacityKey,
  type FocalCacheEntry,
  type FocalRefreshHours,
  type ThemeBgMode,
} from "../../../styles/themeData";
import {
  AlertBanner,
  Button,
  FieldLabel,
  MenuSelect,
  PercentSlider,
} from "../../ui";
import { formHelpClass } from "../../ui/pageTypography";
import { MAX_BG_SIZE } from "../ThemePickerSections";

type ThemeBackgroundSectionProps = {
  themeId: string;
  bgMode: ThemeBgMode;
  bgUrl: string | null;
  bgOpacity: number;
  bgError: string | null;
  focalMeta: FocalCacheEntry | null;
  focalLoading: boolean;
  focalRefreshing: boolean;
  focalRefreshHours: FocalRefreshHours;
  setBgMode: Dispatch<SetStateAction<ThemeBgMode>>;
  setBgUrl: Dispatch<SetStateAction<string | null>>;
  setBgOpacity: Dispatch<SetStateAction<number>>;
  setBgError: Dispatch<SetStateAction<string | null>>;
  setFocalMeta: Dispatch<SetStateAction<FocalCacheEntry | null>>;
  setFocalLoading: Dispatch<SetStateAction<boolean>>;
  setFocalRefreshing: Dispatch<SetStateAction<boolean>>;
  setFocalRefreshHours: Dispatch<SetStateAction<FocalRefreshHours>>;
};

/** Custom / focal background controls for ThemePersonalizationPanel. */
export function ThemeBackgroundSection({
  themeId,
  bgMode,
  bgUrl,
  bgOpacity,
  bgError,
  focalMeta,
  focalLoading,
  focalRefreshing,
  focalRefreshHours,
  setBgMode,
  setBgUrl,
  setBgOpacity,
  setBgError,
  setFocalMeta,
  setFocalLoading,
  setFocalRefreshing,
  setFocalRefreshHours,
}: ThemeBackgroundSectionProps) {
  const { t } = useTranslation("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgModeOptions = [
    { value: "none", label: t("theme.bgModeNone") },
    { value: "custom", label: t("theme.bgModeCustom") },
    { value: "focal", label: t("theme.bgModeFocal") },
  ];

  const focalIntervalOptions = FOCAL_REFRESH_HOUR_OPTIONS.map((hours) => ({
    value: String(hours),
    label:
      hours === 0
        ? t("theme.focalRefreshOff")
        : t("theme.focalRefreshHours", { count: hours }),
  }));

  const applyFocalEntry = (applyUrl: string | null) => {
    if (!applyUrl) return;
    applyBgImage(applyUrl, loadBgOpacity(themeId), "focal");
  };

  const handleFocalRefresh = () => {
    setBgError(null);
    setFocalRefreshing(true);
    void advanceAndMaterializeFocal()
      .then(({ entry, applyUrl }) => {
        setFocalRefreshing(false);
        setFocalLoading(false);
        if (entry) {
          setFocalMeta(entry);
          applyFocalEntry(applyUrl);
          return;
        }
        if (!loadFocalCache()) {
          setBgError(t("theme.focalFetchFailed"));
        }
      })
      .catch(() => {
        setFocalRefreshing(false);
        setBgError(t("theme.focalFetchFailed"));
      });
  };

  // Keep credits / preview in sync when this theme already uses focal.
  useEffect(() => {
    if (resolveThemeBgMode(themeId) !== "focal") return;
    let cancelled = false;
    loadBgForTheme(themeId);
    void refreshFocalBackground().then((entry) => {
      if (cancelled) return;
      setFocalLoading(false);
      if (entry) {
        setFocalMeta(entry);
        setBgError(null);
        return;
      }
      const fallback = loadFocalCache();
      if (fallback) {
        setFocalMeta(fallback);
      } else {
        setBgError(t("theme.focalFetchFailed"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [themeId, t, setBgError, setFocalLoading, setFocalMeta]);

  const handleBgModeChange = (value: string) => {
    const mode = parseThemeBgMode(value) ?? "none";
    setBgError(null);
    setBgMode(mode);
    saveThemeBgMode(themeId, mode);
    if (mode === "custom") {
      setBgUrl(localStorage.getItem(storageBgKey(themeId)));
      setFocalLoading(false);
      loadBgForTheme(themeId);
      return;
    }
    if (mode === "none") {
      setFocalLoading(false);
      loadBgForTheme(themeId);
      return;
    }
    // focal — apply cache / proxy bytes via loadBgForTheme, refresh credits
    const cache = loadFocalCache();
    setFocalMeta(cache);
    setFocalLoading(!cache);
    loadBgForTheme(themeId);
    void refreshFocalBackground().then((entry) => {
      setFocalLoading(false);
      if (entry) {
        setFocalMeta(entry);
        setBgError(null);
      } else if (!loadFocalCache()) {
        setBgError(t("theme.focalFetchFailed"));
      }
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BG_SIZE) {
      setBgError(t("theme.bgTooLarge"));
      e.target.value = "";
      return;
    }
    setBgError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem(storageBgKey(themeId), dataUrl);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "QuotaExceededError") {
          setBgError(t("theme.bgQuotaExceeded"));
          return;
        }
        throw err;
      }
      setBgUrl(dataUrl);
      setBgMode("custom");
      saveThemeBgMode(themeId, "custom");
      applyBgImage(dataUrl, bgOpacity, "custom");
    };
    reader.onerror = () => setBgError(t("theme.bgReadFailed"));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeBg = () => {
    localStorage.removeItem(storageBgKey(themeId));
    localStorage.removeItem(storageBgOpacityKey(themeId));
    setBgUrl(null);
    setBgOpacity(0.3);
    setBgError(null);
    setBgMode("none");
    saveThemeBgMode(themeId, "none");
    applyBgImage(null, 0, "none");
  };

  const previewUrl =
    bgMode === "custom"
      ? bgUrl
      : bgMode === "focal"
        ? (focalMeta?.imageUrl ?? null)
        : null;

  return (
    <div className="flex min-w-0 flex-col gap-md">
      <div className="flex min-w-0 flex-col gap-xs">
        <div className="flex min-w-0 items-center gap-md">
          <FieldLabel className="mb-0 min-w-0 flex-1" htmlFor="theme-bg-mode">
            {t("theme.bgImageLabel")}
          </FieldLabel>
          <div className="w-[12rem] max-w-full shrink-0">
            <MenuSelect
              id="theme-bg-mode"
              data-testid="theme-bg-mode"
              variant="field"
              value={bgMode}
              options={bgModeOptions}
              aria-label={t("theme.bgModeLabel")}
              onChange={handleBgModeChange}
            />
          </div>
        </div>
        <p className={formHelpClass}>{t("theme.bgImageHelp")}</p>
      </div>
      <p className={formHelpClass}>
        {bgMode === "focal" ? t("theme.bgModeFocalHelp") : t("theme.bgModeHelp")}
      </p>

      {bgMode === "custom" ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex min-w-0 flex-wrap items-center gap-sm">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("theme.chooseImage")}
            </Button>
            {bgUrl ? (
              <Button variant="danger" size="sm" onClick={removeBg}>
                {t("theme.removeImage")}
              </Button>
            ) : (
              <span className="text-caption text-text-muted">{t("theme.bgImageNone")}</span>
            )}
          </div>
        </>
      ) : null}

      {bgMode === "focal" ? (
        <div className="flex min-w-0 flex-col gap-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-sm">
            <Button
              variant="secondary"
              size="sm"
              data-testid="theme-focal-refresh"
              disabled={focalRefreshing}
              onClick={handleFocalRefresh}
            >
              {focalRefreshing ? t("theme.focalRefreshing") : t("theme.focalRefresh")}
            </Button>
            <MenuSelect
              id="theme-focal-refresh-hours"
              data-testid="theme-focal-refresh-hours"
              variant="field"
              value={String(focalRefreshHours)}
              options={focalIntervalOptions}
              aria-label={t("theme.focalRefreshIntervalLabel")}
              onChange={(value) => {
                const hours = parseFocalRefreshHours(value);
                saveFocalRefreshHours(hours);
                setFocalRefreshHours(hours);
              }}
            />
          </div>
          <p className={formHelpClass}>{t("theme.focalRefreshHelp")}</p>
          {focalLoading && !focalMeta ? (
            <p className="text-caption text-text-muted">{t("theme.focalLoading")}</p>
          ) : null}
          {focalMeta?.title || focalMeta?.copyright ? (
            <p className="text-caption text-text-secondary" data-testid="theme-focal-credit">
              {focalMeta.title || focalMeta.copyright}
              {focalMeta.title && focalMeta.copyright && focalMeta.title !== focalMeta.copyright
                ? ` — ${focalMeta.copyright}`
                : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {bgError ? (
        <AlertBanner variant="error" className="mb-0 text-xs">
          {bgError}
        </AlertBanner>
      ) : null}

      {previewUrl ? (
        /* Same frosted panel as color rows — not a solid beige island over photo BG. */
        <div className="im-surface-panel flex min-w-0 flex-col gap-sm rounded-lg border border-surface-border p-md sm:flex-row sm:items-start sm:gap-lg">
          <img
            src={previewUrl}
            alt={t("theme.bgPreviewAlt")}
            referrerPolicy="no-referrer"
            className="h-[88px] w-[140px] shrink-0 rounded-md border border-surface-border object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-xs">
            <label
              htmlFor="theme-bg-opacity"
              className="text-caption font-medium text-text-secondary"
            >
              {t("theme.opacity")}
            </label>
            <PercentSlider
              id="theme-bg-opacity"
              data-testid="theme-bg-opacity"
              aria-label={t("theme.opacity")}
              min={0.05}
              max={0.6}
              value={bgOpacity}
              onChange={(val) => {
                setBgOpacity(val);
                localStorage.setItem(storageBgOpacityKey(themeId), String(val));
                applyBgImage(previewUrl, val, bgMode === "focal" ? "focal" : "custom");
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
