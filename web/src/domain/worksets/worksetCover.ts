/**
 * Workset cover image: resize/compress + default calendar placeholder.
 */

import { compressAvatarToDataUrl } from "../aiStaff/assistantIdentity";
import calendarPlaceholderUrl from "../../assets/worksets/calendar-placeholder.svg";

export const WORKSET_COVER_MAX_EDGE_PX = 640;
export const WORKSET_COVER_MAX_DATA_URL_CHARS = 200 * 1024;

export const DEFAULT_WORKSET_COVER_URL = calendarPlaceholderUrl;

export function normalizeWorksetCover(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export function resolveWorksetCoverSrc(cover: string | null | undefined): string {
  const cleaned = normalizeWorksetCover(cover);
  return cleaned || DEFAULT_WORKSET_COVER_URL;
}

/** Selected file from a cover `<input type="file">`, or null when empty / cancelled. */
export function readWorksetCoverPick(files: FileList | null | undefined): File | null {
  return files?.[0] ?? null;
}

/** Reset native value so picking the same file again still emits `change`. */
export function resetWorksetCoverFileInput(input: HTMLInputElement): void {
  input.value = "";
}

export async function compressWorksetCoverToDataUrl(file: File): Promise<string> {
  return compressAvatarToDataUrl(file, {
    maxEdge: WORKSET_COVER_MAX_EDGE_PX,
    maxDataUrlChars: WORKSET_COVER_MAX_DATA_URL_CHARS,
  });
}
