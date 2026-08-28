/**
 * Workset card cover strip — upload / clear with account-avatar compression.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui";
import {
  normalizeWorksetCover,
  readWorksetCoverPick,
  resetWorksetCoverFileInput,
  resolveWorksetCoverSrc,
} from "../domain/worksets/worksetCover";

type Props = {
  cover: string;
  name: string;
  onPickFile: (file: File) => void | Promise<void>;
  onClear: () => void;
  disabled?: boolean;
};

export function WorksetCardCover({ cover, name, onPickFile, onClear, disabled = false }: Props) {
  const { t } = useTranslation("workset");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const pickerOpenRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const src = resolveWorksetCoverSrc(cover);
  const hasCustomCover = normalizeWorksetCover(cover) !== "";
  const interactionDisabled = disabled || processing;

  const restoreUploadFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (document.activeElement === fileInputRef.current) {
        uploadButtonRef.current?.focus();
      }
    });
  }, []);

  const endPickerSessionRef = useRef<() => void>(() => {});
  const onWindowFocusAfterPickerRef = useRef(() => {
    window.setTimeout(() => {
      if (!pickerOpenRef.current) return;
      endPickerSessionRef.current();
    }, 0);
  });

  endPickerSessionRef.current = () => {
    if (!pickerOpenRef.current) return;
    pickerOpenRef.current = false;
    window.removeEventListener("focus", onWindowFocusAfterPickerRef.current);
    restoreUploadFocus();
  };

  useEffect(() => {
    const onFocus = onWindowFocusAfterPickerRef.current;
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const openFilePicker = () => {
    if (interactionDisabled || pickerOpenRef.current) return;
    const input = fileInputRef.current;
    if (!input) return;
    pickerOpenRef.current = true;
    window.addEventListener("focus", onWindowFocusAfterPickerRef.current);
    input.click();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = readWorksetCoverPick(input.files);
    resetWorksetCoverFileInput(input);
    endPickerSessionRef.current();
    if (!file) return;

    setProcessing(true);
    void (async () => {
      try {
        await onPickFile(file);
      } catch {
        // Parent surfaces errors (toast) when needed.
      } finally {
        setProcessing(false);
      }
    })();
  };

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]"
      data-testid="workset-card-cover"
      data-processing={processing ? "true" : undefined}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={uploadButtonRef}
        type="button"
        disabled={interactionDisabled}
        className={[
          "group relative block w-full border-0 bg-transparent p-0",
          "aspect-[16/9] max-h-28",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
        aria-label={t("changeCoverAria", { name })}
        aria-busy={processing || undefined}
        data-testid="workset-card-cover-upload"
        onClick={openFilePicker}
      >
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          data-testid="workset-card-cover-preview"
        />
        <span
          className={[
            "pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-xs",
            "bg-black/50 py-1.5 text-[11px] font-medium text-white",
            "transition-colors group-hover:bg-black/60 group-focus-visible:bg-black/60",
          ].join(" ")}
          data-testid="workset-card-cover-upload-label"
          aria-hidden
        >
          {processing ? (
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          ) : (
            <ImagePlus size={14} strokeWidth={2} />
          )}
          {t("uploadCover")}
        </span>
      </button>
      {processing ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"
          data-testid="workset-card-cover-processing"
          aria-hidden
        >
          <Loader2 size={22} strokeWidth={2} className="animate-spin text-white" />
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        className="sr-only"
        data-testid="workset-card-cover-file"
        onChange={onFileChange}
      />
      {hasCustomCover ? (
        <div className="absolute right-xs top-xs">
          <Button
            type="button"
            variant="ghost"
            size="inline"
            className="!h-7 !min-h-7 bg-black/45 text-white hover:bg-black/55"
            disabled={interactionDisabled}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            data-testid="workset-card-cover-reset"
          >
            {t("resetCover")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
