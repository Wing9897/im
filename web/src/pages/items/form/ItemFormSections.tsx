import { useTranslation } from "react-i18next";

import { TextArea } from "../../../components/ui";
import { cardBodyClass } from "../../../components/ui/pageTypography";
import { ItemFormCvSection } from "./ItemFormCvSection";

type NotesProps = {
  notes: string;
  saving: boolean;
  onNotesChange: (value: string) => void;
};

export function ItemFormNotesSection({ notes, saving, onNotesChange }: NotesProps) {
  const { t } = useTranslation("items");
  return (
    <ItemFormCvSection
      title={t("sectionNotes")}
      testId="item-form-notes"
      ariaLabel={t("sectionNotes")}
    >
      <TextArea
        id="item-notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={saving}
        rows={5}
        className={`min-h-[7.5rem] w-full ${cardBodyClass}`}
        aria-label={t("notes")}
      />
    </ItemFormCvSection>
  );
}
