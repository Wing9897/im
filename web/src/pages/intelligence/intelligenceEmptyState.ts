import type { TFunction } from "i18next";
import i18n from "../../i18n";

interface IntelligenceEmptyFilters {
  intelligenceTasksCount: number;
  hasActiveFilters: boolean;
  hasSearchFilter: boolean;
  hasTimeFilter: boolean;
}

export interface IntelligenceEmptyCopy {
  title: string;
  description: string;
  hint: string;
  showClearFilters: boolean;
  showGoToTasks: boolean;
}

type Translate = TFunction | typeof i18n.t;

function intelligenceT(key: string, t?: Translate): string {
  if (t) return String(t(key));
  return String(i18n.t(`intelligence:${key}`));
}

export function getIntelligenceEmptyCopy(
  filters: IntelligenceEmptyFilters,
  t?: Translate,
): IntelligenceEmptyCopy {
  const filteredTitle =
    filters.hasSearchFilter && filters.hasTimeFilter
      ? intelligenceT("empty.filteredBothTitle", t)
      : filters.hasSearchFilter
        ? intelligenceT("empty.filteredSearchTitle", t)
        : intelligenceT("empty.filteredTimeTitle", t);
  const filteredDescription =
    filters.hasSearchFilter && filters.hasTimeFilter
      ? intelligenceT("empty.filteredBothDescription", t)
      : filters.hasSearchFilter
        ? intelligenceT("empty.filteredSearchDescription", t)
        : intelligenceT("empty.filteredTimeDescription", t);

  if (filters.intelligenceTasksCount === 0) {
    return {
      title: intelligenceT("empty.noTasksTitle", t),
      description: intelligenceT("empty.noTasksDescription", t),
      hint: intelligenceT("empty.noTasksHint", t),
      showClearFilters: false,
      showGoToTasks: true,
    };
  }

  if (filters.hasActiveFilters) {
    return {
      title: filteredTitle,
      description: filteredDescription,
      hint: intelligenceT("empty.filteredHint", t),
      showClearFilters: true,
      showGoToTasks: false,
    };
  }

  return {
    title: intelligenceT("empty.noneTitle", t),
    description: intelligenceT("empty.noneDescription", t),
    hint: intelligenceT("empty.noneHint", t),
    showClearFilters: false,
    showGoToTasks: false,
  };
}
