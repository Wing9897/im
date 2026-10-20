/**
 * Item-linked one-off write body.
 *
 * Sends ``kind``, ``amount``, and ``direction``, and locks ``itemId`` to the
 * parent item. Timeline and schedule use ``submitStandardUserEvent`` instead.
 */

import type { UserEventFormValues } from "../timeline/userEventFormModel";
import { parseOptionalNumberInput } from "./itemInventoryDisplay";

export function linkedOneOffWriteParams(
  values: UserEventFormValues,
  itemId: string,
  worksetId: string,
  remindBeforeDays: number | null,
) {
  const isPurchase = values.calendarKind === "purchase_effective";
  const amount = isPurchase ? parseOptionalNumberInput(values.amountInput) : null;
  return {
    title: values.title,
    startTime: values.startTime,
    endTime: values.endTime || null,
    body: values.body,
    location: values.location,
    isAllDay: values.isAllDay,
    remindBeforeDays,
    itemId,
    worksetId,
    kind: values.calendarKind,
    amount,
    direction: amount == null ? null : values.direction,
    notifyPref: values.notifyPref,
  };
}
