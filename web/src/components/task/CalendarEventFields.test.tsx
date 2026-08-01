import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarEventFields } from "./CalendarEventFields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderFields(props: Partial<Parameters<typeof CalendarEventFields>[0]> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <CalendarEventFields
        name="Night shift"
        onNameChange={() => {}}
        eventStartTime="22:00"
        onEventStartTimeChange={() => {}}
        eventEndTime="06:00"
        onEventEndTimeChange={() => {}}
        eventIsAllDay={false}
        onEventIsAllDayChange={() => {}}
        eventLocation=""
        onEventLocationChange={() => {}}
        eventDescription=""
        onEventDescriptionChange={() => {}}
        {...props}
      />,
    );
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("CalendarEventFields", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows overnight hint when end clock is before start", () => {
    const { container, root } = renderFields();
    const hint = container.querySelector('[data-testid="calendar-event-overnight-hint"]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("tasks.calendarFields.overnightHint");
    cleanup(root, container);
  });

  it("hides overnight hint for same-day ranges", () => {
    const { container, root } = renderFields({
      eventStartTime: "09:00",
      eventEndTime: "10:00",
    });
    expect(container.querySelector('[data-testid="calendar-event-overnight-hint"]')).toBeNull();
    cleanup(root, container);
  });

  it("hides overnight hint when all-day", () => {
    const { container, root } = renderFields({ eventIsAllDay: true });
    expect(container.querySelector('[data-testid="calendar-event-overnight-hint"]')).toBeNull();
    cleanup(root, container);
  });
});
