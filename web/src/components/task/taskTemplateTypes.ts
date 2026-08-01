interface TemplateUsageEntry {
  useCount: number;
  lastUsedAt: string;
}

export type TemplateUsageMap = Record<string, TemplateUsageEntry>;
