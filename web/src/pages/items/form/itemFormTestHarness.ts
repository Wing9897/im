import { act, createElement, createRef } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, vi } from "vitest";

import type { TrackableItem } from "../../../api/items";
import { makeItemFormPassportItem, makeTrackableItem } from "../../../test/fixtures/trackableItem";
import { ItemForm, type ItemFormHandle } from "./ItemForm";
import {
  ITEM_FORM_TEST_CATEGORIES,
  ITEM_FORM_TEST_WORKSETS,
} from "./itemFormTestFixtures";
import {
  createUserEvent,
  listItems,
  listRecurringSeries,
  listUserEventsPage,
  showToast,
  updateUserEvent,
} from "./itemFormTestMocks";

export { makeItemFormPassportItem as makeItem, makeTrackableItem };
export { ITEM_FORM_TEST_CATEGORIES as CATEGORIES, ITEM_FORM_TEST_WORKSETS as WORKSETS };
export {
  createUserEvent,
  deleteUserEvent,
  deleteRecurringSeries,
  listItems,
  listRecurringSeries,
  listUserEventsPage,
  showToast,
  updateUserEvent,
} from "./itemFormTestMocks";

export function resetItemFormTestMocks(): void {
  showToast.mockReset();
  listUserEventsPage.mockReset();
  listUserEventsPage.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
  listRecurringSeries.mockReset();
  listRecurringSeries.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
  updateUserEvent.mockReset();
  updateUserEvent.mockResolvedValue({});
  createUserEvent.mockReset();
  createUserEvent.mockResolvedValue({});
  listItems.mockReset();
  listItems.mockResolvedValue([
    makeTrackableItem({
      id: "item-42",
      title: "Passport",
      categoryId: null,
    }),
  ]);
}

export function createItemFormRenderer(root: Root) {
  return async function renderForm(opts?: {
    item?: TrackableItem | null;
    initialCategoryId?: string | null;
    worksets?: typeof ITEM_FORM_TEST_WORKSETS;
    onSave?: (draft: unknown) => Promise<void>;
  }) {
    const onSave = opts?.onSave ?? vi.fn(() => Promise.resolve(undefined));
    const formRef = createRef<ItemFormHandle>();
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(ItemForm, {
            ref: formRef,
            item: opts?.item === undefined ? makeItemFormPassportItem() : opts.item,
            categories: ITEM_FORM_TEST_CATEGORIES,
            worksets: opts?.worksets ?? ITEM_FORM_TEST_WORKSETS,
            categoryLabel: (category) => category?.name ?? "none",
            initialCategoryId: opts?.initialCategoryId ?? null,
            onSave,
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return { onSave, formRef };
  };
}

export function categorySelectTrigger(): HTMLButtonElement {
  const el = document.querySelector(
    '[data-testid="item-form-category-select-value"]',
  );
  expect(el).toBeTruthy();
  return el as HTMLButtonElement;
}

export function pickCategory(categoryId: string): void {
  const trigger = categorySelectTrigger();
  act(() => {
    trigger.click();
  });
  const option = document.querySelector(
    `[data-testid="item-form-category-select-option-${categoryId}"]`,
  );
  expect(option).toBeTruthy();
  act(() => {
    (option as HTMLElement).click();
  });
}


export function cleanupItemFormDialogs(): void {
  document.querySelectorAll('[role="dialog"]').forEach((node) => node.remove());
}

export function commitItemTitle(value: string): void {
  let title = document.getElementById("item-title") as HTMLInputElement | null;
  if (!title) {
    const editBtn = document.querySelector(
      '[data-testid="item-form-cv-title-edit"]',
    ) as HTMLButtonElement;
    act(() => {
      editBtn.click();
    });
    title = document.getElementById("item-title") as HTMLInputElement;
  }
  expect(title).toBeTruthy();

  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(
      title,
      value,
    );
    title.dispatchEvent(new Event("input", { bubbles: true }));
    if (document.querySelector('[data-testid="item-form-cv-title-edit"]')) {
      title.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    }
  });
}

export async function flushDeferredEmojiGrid(): Promise<void> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (document.querySelector('[data-testid="emoji-option-🍎"]')) return;
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
  }
  throw new Error("emoji picker grid did not mount");
}

export async function waitForEmojiDialogDismiss(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!document.querySelector('[data-testid="emoji-picker-field-dialog"]')) return;
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 20);
      });
    });
  }
  throw new Error("emoji picker dialog did not dismiss");
}
