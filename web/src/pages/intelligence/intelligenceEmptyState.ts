import type { TFunction } from "i18next";
import i18n from "../../i18n";

interface IntelligenceEmptyFilters {
  intelligenceTasksCount: number;
  hasActiveFilters: boolean;
  hasSearchFilter: boolean;
  hasTimeFilter: boolean;
  hasSourceFilter: boolean;
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

function filteredEmptyKeys(filters: IntelligenceEmptyFilters): {
  titleKey: string;
  descriptionKey: string;
} {
  const { hasSearchFilter, hasTimeFilter, hasSourceFilter } = filters;
  const activeCount =
    Number(hasSearchFilter) + Number(hasTimeFilter) + Number(hasSourceFilter);

  if (activeCount >= 2) {
    return {
      titleKey: "empty.filteredBothTitle",
      descriptionKey: "empty.filteredBothDescription",
    };
  }
  if (hasSearchFilter) {
    return {
      titleKey: "empty.filteredSearchTitle",
      descriptionKey: "empty.filteredSearchDescription",
    };
  }
  if (hasTimeFilter) {
    return {
      titleKey: "empty.filteredTimeTitle",
      descriptionKey: "empty.filteredTimeDescription",
    };
  }
  return {
    titleKey: "empty.filteredSourceTitle",
    descriptionKey: "empty.filteredSourceDescription",
  };
}

export function getIntelligenceEmptyCopy(
  filters: IntelligenceEmptyFilters,
  t?: Translate,
): IntelligenceEmptyCopy {
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
    const keys = filteredEmptyKeys(filters);
    return {
      title: intelligenceT(keys.titleKey, t),
      description: intelligenceT(keys.descriptionKey, t),
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
