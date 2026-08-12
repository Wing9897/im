import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { UserEventFormValues } from "../../domain/timeline/userEventFormModel";
import { FieldLabel, SegmentedControl, TextField } from "../ui";

type UserEventDialogFinanceFieldsProps = {
  values: UserEventFormValues;
  setValues: Dispatch<SetStateAction<UserEventFormValues>>;
};

/** Amount + expense/income direction (purchase_effective calendars). */
export function UserEventDialogFinanceFields({
  values,
  setValues,
}: UserEventDialogFinanceFieldsProps) {
  const { t } = useTranslation("timeline");

  return (
    <div className="flex flex-col gap-sm" data-testid="user-event-finance-fields">
      <div className="flex flex-wrap items-end gap-sm">
        <div className="flex min-w-[7rem] flex-1 flex-col gap-xs">
          <FieldLabel className="mb-0" htmlFor="user-event-amount">
            {t("userEvent.amount")}
          </FieldLabel>
          <div className="relative w-full">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-sm z-[1] flex items-center text-body text-text-secondary"
            >
              $
            </span>
            <TextField
              id="user-event-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={values.amountInput}
              placeholder={t("userEvent.amountPlaceholder")}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, amountInput: event.target.value }))
              }
              className="w-full pl-6"
              data-testid="user-event-amount-input"
            />
          </div>
        </div>
        <div className="flex min-w-[8rem] flex-col gap-xs" data-testid="user-event-direction">
          <FieldLabel className="mb-0">{t("userEvent.direction")}</FieldLabel>
          <SegmentedControl
            items={[
              { id: "expense", label: t("userEvent.directionExpense") },
              { id: "income", label: t("userEvent.directionIncome") },
            ]}
            value={values.direction}
            onChange={(direction) =>
              setValues((prev) => ({
                ...prev,
                direction: direction === "income" ? "income" : "expense",
              }))
            }
            ariaLabel={t("userEvent.directionAria")}
            layout="inline"
          />
        </div>
      </div>
      <p className="m-0 text-caption text-text-muted">{t("userEvent.amountHint")}</p>
    </div>
  );
}
