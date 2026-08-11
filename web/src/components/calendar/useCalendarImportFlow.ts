/** State machine for Desktop raw-ICS preview → select → commit. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  commitCalendarImport,
  previewCalendarImport,
  type CalendarImportCommit,
  type CalendarImportPreview,
} from "../../api/calendarImports";
import { useToast } from "../../context/ToastContext";
import { emitResourceModified } from "../../domain/sse/resourceModified";
import {
  getElectronCalendarImport,
  type CalendarImportMessage,
  type CalendarImportPayload,
} from "../../electron/calendarImport";

export type CalendarImportFlow = {
  open: boolean;
  busy: boolean;
  error: string | null;
  payload: CalendarImportPayload | null;
  preview: CalendarImportPreview | null;
  selectedUids: ReadonlySet<string>;
  result: CalendarImportCommit | null;
  close: () => void;
  toggleSelection: (uid: string, selected: boolean) => void;
  selectAllImportable: () => void;
  clearSelection: () => void;
  submit: () => Promise<void>;
};

export function useCalendarImportFlow(): CalendarImportFlow {
  const { t } = useTranslation("timeline");
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CalendarImportPayload | null>(null);
  const [preview, setPreview] = useState<CalendarImportPreview | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CalendarImportCommit | null>(null);
  const requestSequence = useRef(0);

  const applyMessage = useCallback(
    (message: CalendarImportMessage) => {
      if (!message.ok) {
        showToast(message.error || t("calendarImport.importFailed"), "error");
        return;
      }
      const sequence = ++requestSequence.current;
      const nextPayload = message.payload;
      setPayload(nextPayload);
      setPreview(null);
      setResult(null);
      setSelectedUids(new Set());
      setError(null);
      setOpen(true);
      setBusy(true);
      void previewCalendarImport({
        content: nextPayload.content,
        sourceId: nextPayload.sourceId,
      })
        .then((nextPreview) => {
          if (sequence !== requestSequence.current) return;
          setPreview(nextPreview);
          setSelectedUids(
            new Set(
              nextPreview.items
                .filter((item) => item.supported)
                .map((item) => item.uid),
            ),
          );
        })
        .catch((previewError) => {
          if (sequence !== requestSequence.current) return;
          setError(
            previewError instanceof Error
              ? previewError.message
              : t("calendarImport.previewFailed"),
          );
        })
        .finally(() => {
          if (sequence === requestSequence.current) setBusy(false);
        });
    },
    [showToast, t],
  );

  useEffect(() => {
    const api = getElectronCalendarImport();
    if (!api) return;

    let cancelled = false;
    void api.getPending().then((pending) => {
      if (!cancelled && pending) applyMessage(pending);
    });
    const unsubscribe = api.onImport((message) => {
      applyMessage(message);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyMessage]);

  const close = useCallback(() => {
    if (busy) return;
    requestSequence.current += 1;
    setOpen(false);
    setPayload(null);
    setPreview(null);
    setResult(null);
    setSelectedUids(new Set());
    setError(null);
  }, [busy]);

  const toggleSelection = useCallback((uid: string, selected: boolean) => {
    setSelectedUids((current) => {
      const next = new Set(current);
      if (selected) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }, []);

  const selectAllImportable = useCallback(() => {
    if (!preview) return;
    setSelectedUids(
      new Set(preview.items.filter((item) => item.supported).map((item) => item.uid)),
    );
  }, [preview]);

  const clearSelection = useCallback(() => {
    setSelectedUids(new Set());
  }, []);

  const submit = useCallback(async () => {
    if (!payload || !preview) return;
    const selections = preview.items
      .filter((item) => item.supported && selectedUids.has(item.uid))
      .map((item) => ({ uid: item.uid, fingerprint: item.fingerprint }));
    if (selections.length === 0) {
      setError(t("calendarImport.selectAtLeastOne"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const committed = await commitCalendarImport({
        content: payload.content,
        sourceId: payload.sourceId,
        selections,
      });
      setResult(committed);
      const invalidatedTypes = new Set<string>();
      for (const item of committed.results) {
        if (item.action === "unchanged") continue;
        const resourceType =
          item.targetType === "recurring" ? "recurring" : "user_event";
        if (invalidatedTypes.has(resourceType)) continue;
        invalidatedTypes.add(resourceType);
        emitResourceModified({
          resourceType,
          resourceId: item.targetId,
          action: item.action === "updated" ? "updated" : "created",
        });
      }
      showToast(
        t("calendarImport.importSaved", { count: committed.committedCount }),
        "success",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("calendarImport.commitFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [payload, preview, selectedUids, showToast, t]);

  return {
    open,
    busy,
    error,
    payload,
    preview,
    selectedUids,
    result,
    close,
    toggleSelection,
    selectAllImportable,
    clearSelection,
    submit,
  };
}
