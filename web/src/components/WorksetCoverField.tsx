/**
 * Workset cover strip with API persistence (catalog cards + workspace header).
 */

import { useTranslation } from "react-i18next";

import { updateWorkset } from "../api/worksets";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import { useToast } from "../context/ToastContext";
import {
  compressWorksetCoverToDataUrl,
  normalizeWorksetCover,
} from "../domain/worksets/worksetCover";
import { toError } from "../utils/errors";
import { WorksetCardCover } from "./WorksetCardCover";

type Props = {
  worksetId: string;
  cover: string;
  name: string;
};

export function WorksetCoverField({ worksetId, cover, name }: Props) {
  const { t } = useTranslation("account");
  const { refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const normalizedCover = normalizeWorksetCover(cover);

  const persistCover = async (next: string) => {
    try {
      await updateWorkset(worksetId, { cover: next.trim() });
      await refreshWorksets();
    } catch (error) {
      showToast(toError(error).message, "error");
      throw error;
    }
  };

  const onCoverFile = async (file: File) => {
    try {
      const dataUrl = await compressWorksetCoverToDataUrl(file);
      await persistCover(dataUrl);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      showToast(
        code === "too_large" ? t("avatarTooLarge") : t("avatarReadFailed"),
        "error",
      );
    }
  };

  return (
    <WorksetCardCover
      cover={normalizedCover}
      name={name}
      onPickFile={onCoverFile}
      onClear={() => void persistCover("")}
    />
  );
}
