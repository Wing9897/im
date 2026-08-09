/**
 * Read-only system / agent mechanism cards on the tasks dashboard.
 */

import type { CSSProperties } from "react";
import { SystemInfoTaskCard } from "../../../components/SystemInfoTaskCard";
import { TaskGrid } from "../../../components/TaskGrid";
import { captionClass, sectionTitleClass } from "../../../components/ui";
import type { SystemTaskInfo } from "../../../domain/tasks/systemTaskCatalog";

interface DashboardSystemTasksSectionProps {
  catalog: SystemTaskInfo[];
  title: string;
  subtitle: string;
}

export function DashboardSystemTasksSection({
  catalog,
  title,
  subtitle,
}: DashboardSystemTasksSectionProps) {
  return (
    <section className="mt-lg" data-testid="system-tasks-section" aria-label={title}>
      <h2 className={sectionTitleClass}>{title}</h2>
      <p className={`${captionClass} mt-xs mb-md`}>{subtitle}</p>
      <TaskGrid>
        {catalog.map((item, index) => (
          <div
            key={item.id}
            className="im-enter-rise"
            style={{ "--i": Math.min(index, 8) } as CSSProperties}
          >
            <SystemInfoTaskCard item={item} />
          </div>
        ))}
      </TaskGrid>
    </section>
  );
}
