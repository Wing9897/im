// ============================================================
// RecurrenceRuleEditor — visual RFC 5545 recurrence editor
// ============================================================
//
// A structured visual editor (Requirement 8.1) bound to a `RecurrenceConfig`.
// It renders dropdowns / multi-selects for frequency, interval, days of week
// (BYDAY), days of month (BYMONTHDAY), ordinal day-of-week (e.g. "last Friday"),
// and the end condition (never / until date / after N occurrences).
//
// The editor serializes the current configuration to an RRULE string via
// `buildRRule` and emits it through `onChange` on every change (Requirement
// 8.2). When initialized from (or re-synced to) an existing RRULE string, it
// calls `parseRRule` to populate the controls (Requirement 8.3 / 7.4).

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SurfaceCard } from "../ui/SurfaceCard";
import { sectionTitleClass } from "../ui/pageTypography";
import { buildRRule, WEEKDAY_CODES } from "../../utils/rrule";
import { validateRRuleConfig, type RRuleValidationErrors } from "../../utils/rruleValidation";
import type {
  RecurrenceConfig,
  RecurrenceEndType,
  RecurrenceFreq,
  WeekdayCode,
} from "../../types/calendar";
import {
  toConfig,
  valueKey,
  dateInputToUntil,
  defaultUntil,
  sortMonthDays,
  deriveMonthlyMode,
} from "../../domain/tasks/recurrenceRuleUtils";
import type { MonthlyMode } from "../../domain/tasks/recurrenceRuleUtils";
import { FrequencySelector } from "./FrequencySelector";
import { WeekdaySelector } from "./WeekdaySelector";
import { MonthlyModeSelector } from "./MonthlyModeSelector";
import { UntilCountSelector } from "./UntilCountSelector";

// ── Styles ─────────────────────────────────────────────────────────────────────

const errorTextClass = "mt-xs text-[11px] text-error";

function ValidationHint({ errors }: { errors: RRuleValidationErrors }) {
  const messages = [errors.freq, errors.byDay, errors.byMonthDay].filter(Boolean);
  if (messages.length === 0) return null;
  return (
    <div role="alert">
      {messages.map((message) => (
        <div key={message} className={errorTextClass}>{message}</div>
      ))}
    </div>
  );
}

interface RecurrenceRuleEditorProps {
  value: string;
  onChange: (rrule: string, config: RecurrenceConfig) => void;
  disabled?: boolean;
}

export function RecurrenceRuleEditor({
  value,
  onChange,
  disabled,
}: RecurrenceRuleEditorProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<RecurrenceConfig>(() => toConfig(value));
  // Track the last incoming value we synced from so we only reset on a genuine
  // external change (e.g. opening a different task for editing) rather than on
  // the value the parent echoes back from our own onChange.
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    const incoming = valueKey(value);
    if (lastSyncedRef.current === null) {
      lastSyncedRef.current = incoming;
      return;
    }
    if (incoming !== lastSyncedRef.current) {
      lastSyncedRef.current = incoming;
      setConfig(toConfig(value));
    }
  }, [value]);

  const emit = (next: RecurrenceConfig) => {
    setConfig(next);
    const rrule = buildRRule(next);
    lastSyncedRef.current = rrule;
    onChange(rrule, next);
  };

  const update = (patch: Partial<RecurrenceConfig>) => emit({ ...config, ...patch });

  // ── Change handlers ──────────────────────────────────────────────────────

  const handleFreqChange = (freq: RecurrenceFreq) => {
    emit({
      ...config,
      freq,
      byDay: freq === "weekly" ? config.byDay : [],
      byMonthDay: [],
      ordinal: null,
      byMonth: freq === "yearly" ? config.byMonth : [],
    });
  };

  const handleIntervalChange = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    const clamped = Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), 999);
    update({ interval: clamped });
  };

  const toggleWeekday = (day: WeekdayCode) => {
    const set = new Set(config.byDay);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    update({ byDay: WEEKDAY_CODES.filter((d) => set.has(d)) });
  };

  const setMonthlyMode = (mode: MonthlyMode) => {
    if (mode === "monthday") {
      emit({ ...config, ordinal: null, byDay: [] });
    } else {
      emit({
        ...config,
        byMonthDay: [],
        ordinal: config.ordinal ?? 1,
        byDay: config.byDay.length > 0 ? [config.byDay[0]] : ["MO"],
      });
    }
  };

  const toggleMonthDay = (day: number) => {
    const set = new Set(config.byMonthDay);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    update({ byMonthDay: sortMonthDays([...set]) });
  };

  const handleOrdinalChange = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) update({ ordinal: n });
  };

  const handleOrdinalWeekday = (day: WeekdayCode) => update({ byDay: [day] });

  const handleEndType = (type: RecurrenceEndType) => {
    if (type === "until") {
      emit({
        ...config,
        end: { type, until: config.end.until ?? defaultUntil(), count: null },
      });
    } else if (type === "count") {
      emit({
        ...config,
        end: { type, until: null, count: config.end.count ?? 10 },
      });
    } else {
      emit({ ...config, end: { type, until: null, count: null } });
    }
  };

  const handleUntilChange = (date: string) =>
    update({ end: { type: "until", until: dateInputToUntil(date), count: null } });

  const handleCountChange = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    const clamped = Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), 9999);
    update({ end: { type: "count", until: null, count: clamped } });
  };

  const monthlyMode = deriveMonthlyMode(config);
  const ordinalWeekday: WeekdayCode = config.byDay[0] ?? "MO";
  const validationErrors = validateRRuleConfig(config).errors;

  return (
    <SurfaceCard density="field" className="mt-md flex flex-col gap-lg">
      <div className={sectionTitleClass}>{t("tasks.recurrence.sectionTitle")}</div>

      <div className="flex flex-wrap items-end gap-md">
        <FrequencySelector
          freq={config.freq}
          interval={config.interval}
          onFreqChange={handleFreqChange}
          onIntervalChange={handleIntervalChange}
          disabled={disabled}
        />
      </div>

      {config.freq === "weekly" && (
        <WeekdaySelector
          byDay={config.byDay}
          onToggle={toggleWeekday}
          disabled={disabled}
        />
      )}

      {config.freq === "monthly" && (
        <MonthlyModeSelector
          monthlyMode={monthlyMode}
          byMonthDay={config.byMonthDay}
          ordinal={config.ordinal ?? null}
          ordinalWeekday={ordinalWeekday}
          onSetMode={setMonthlyMode}
          onToggleMonthDay={toggleMonthDay}
          onOrdinalChange={handleOrdinalChange}
          onOrdinalWeekday={handleOrdinalWeekday}
          disabled={disabled}
        />
      )}

      <div className="flex flex-wrap items-end gap-md">
        <UntilCountSelector
          end={config.end}
          onEndTypeChange={handleEndType}
          onUntilChange={handleUntilChange}
          onCountChange={handleCountChange}
          disabled={disabled}
        />
      </div>

      <ValidationHint errors={validationErrors} />
      <div className="break-all font-mono text-[11px] text-text-muted">
        {t("tasks.recurrence.rrulePreview", { value: buildRRule(config) })}
      </div>
    </SurfaceCard>
  );
}
