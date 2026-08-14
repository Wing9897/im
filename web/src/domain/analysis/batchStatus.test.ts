import { beforeEach, describe, expect, it } from "vitest";
import {
  batchStatusLabel,
  batchStatusTone,
} from "./batchStatus";
import type { ProcessingBatchInfo } from "../../types";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";

function batch(partial: Partial<ProcessingBatchInfo>): ProcessingBatchInfo {
  return {
    batchId: "b1",
    taskId: "t1",
    taskName: "任務",
    status: "processing",
    messageCount: 1,
    retryCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    ...partial,
  };
}

describe("batchStatus helpers", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("maps error / pending / processing to danger / warning / info", () => {
    expect(batchStatusTone(batch({ errorMessage: "fail" }))).toBe("danger");
    expect(batchStatusTone(batch({ status: "pending" }))).toBe("warning");
    expect(batchStatusTone(batch({ status: "processing" }))).toBe("info");
  });

  it("labels match queue / dashboard copy", () => {
    expect(batchStatusLabel(batch({ errorMessage: "fail" }))).toBe(
      String(i18n.t("board:queue.attention")),
    );
    expect(batchStatusLabel(batch({ status: "pending" }))).toBe(
      String(i18n.t("board:queue.retryPending")),
    );
    expect(batchStatusLabel(batch({ status: "processing" }))).toBe(
      String(i18n.t("board:queue.processingBadge")),
    );
  });
});
