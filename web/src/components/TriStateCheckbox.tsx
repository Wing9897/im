/**
 * Checkbox that can be checked, unchecked, or indeterminate.
 */

import { useEffect, useRef } from "react";

import type { TriCheckState } from "../domain/tasks/sourceFilterDialogDraft";

type TriStateCheckboxProps = {
  state: TriCheckState;
  testId: string;
  onChange: () => void;
  disabled?: boolean;
};

export function TriStateCheckbox({ state, testId, onChange, disabled }: TriStateCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === "indeterminate";
    }
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "checked"}
      disabled={disabled}
      data-testid={testId}
      onChange={onChange}
    />
  );
}
