import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
} from "../../context/MonitorModeContext";
import { WeatherBoardWidget } from "./WeatherBoardWidget";

vi.mock("../../api/config", () => ({
  fetchSystemSettings: vi.fn(async () => ({ weatherLocation: "臺北" })),
}));

vi.mock("../../api/weather", () => ({
  fetchWeatherForecast: vi.fn(async () => ({
    daily: {
      time: [
        "2026-07-22",
        "2026-07-23",
        "2026-07-24",
        "2026-07-25",
        "2026-07-26",
        "2026-07-27",
        "2026-07-28",
      ],
      weather_code: [0, 1, 2, 3, 61, 71, 95],
      temperature_2m_max: [32, 31, 30, 29, 28, 27, 26],
      temperature_2m_min: [25, 24, 23, 22, 21, 20, 19],
    },
  })),
}));

vi.mock("../../hooks/useErrorToast", () => ({
  useErrorToast: vi.fn(),
}));

function waitForSelector(container: HTMLElement, selector: string, timeoutMs = 2000) {
  const started = Date.now();
  return new Promise<Element>((resolve, reject) => {
    const tick = () => {
      const el = container.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${selector}`));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

describe("WeatherBoardWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  it("renders today plus a wrap forecast of the next six days", async () => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          createElement(
            MonitorModeProvider,
            null,
            createElement(WeatherBoardWidget, { active: true }),
          ),
        ),
      );
    });

    await waitForSelector(container, '[data-testid="board-weather-forecast"]');

    expect(container.querySelector('[data-testid="board-weather-today"]')).toBeTruthy();
    const forecast = container.querySelector(
      '[data-testid="board-weather-forecast"]',
    ) as HTMLElement;
    expect(forecast.classList.contains("board-weather__forecast")).toBe(true);
    expect(forecast.querySelectorAll(".board-weather__day")).toHaveLength(6);
  });
});
