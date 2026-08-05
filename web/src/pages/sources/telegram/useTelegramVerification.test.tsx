import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submitTelegram2fa = vi.fn();
const submitTelegramCode = vi.fn();
const waitTelegramQrLogin = vi.fn();

vi.mock("../../../api/sources", () => ({
  submitTelegram2fa: (...args: unknown[]) => submitTelegram2fa(...args),
  submitTelegramCode: (...args: unknown[]) => submitTelegramCode(...args),
  waitTelegramQrLogin: (...args: unknown[]) => waitTelegramQrLogin(...args),
}));

const { useTelegramVerification } = await import("./useTelegramVerification");
type Verification = ReturnType<typeof useTelegramVerification>;

let latest: Verification;

function Harness({
  clearForm,
  fetchSources,
}: {
  clearForm: () => void;
  fetchSources: () => Promise<void>;
}) {
  latest = useTelegramVerification({
    clearAddTelegramSourceForm: clearForm,
    fetchSources,
  });
  return null;
}

describe("useTelegramVerification", () => {
  let container: HTMLDivElement;
  let root: Root;
  const clearForm = vi.fn();
  const fetchSources = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness clearForm={clearForm} fetchSources={fetchSources} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("moves a scanned QR login into the 2FA step", async () => {
    waitTelegramQrLogin.mockResolvedValue({
      nextStep: "2fa_required",
      pendingLoginStage: "2fa_required",
    });

    await act(async () => {
      latest.startVerification({
        sourceId: "telegram-1",
        step: "qr_required",
        qrUrl: "tg://login?token=abc",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(waitTelegramQrLogin).toHaveBeenCalledWith("telegram-1", {
      timeoutSeconds: 20,
    });
    expect(latest.verifyStep).toBe("2fa_required");
    expect(latest.qrUrl).toBeNull();
    expect(latest.qrWaiting).toBe(false);
  });

  it("submits trimmed 2FA credentials and refreshes the source list", async () => {
    submitTelegram2fa.mockResolvedValue({ nextStep: "connected" });
    act(() => {
      latest.startVerification({
        sourceId: "telegram-2",
        step: "2fa_required",
        pendingLoginStage: "2fa_required",
        phoneCodeHash: "hash-1",
      });
      latest.setVerifyPassword("  secret  ");
    });

    await act(async () => {
      await latest.handleSubmit2fa();
    });

    expect(submitTelegram2fa).toHaveBeenCalledWith("telegram-2", {
      password: "secret",
      pendingLoginStage: "2fa_required",
      phoneCodeHash: "hash-1",
    });
    expect(fetchSources).toHaveBeenCalledOnce();
    expect(clearForm).toHaveBeenCalledOnce();
    expect(latest.verifyStep).toBeNull();
  });
});
