import type { ReactNode } from "react";
import { FormDialogSection } from "../../../components/ui/FormDialogSection";

/** Card-style section inside the notification create/edit dialog. */
export function ActionFormSection({
  title,
  note,
  children,
  step,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  /** Optional 1-based step badge for visual hierarchy. */
  step?: number;
}) {
  return (
    <FormDialogSection title={title} note={note} step={step}>
      {children}
    </FormDialogSection>
  );
}
