import type { ReactNode } from "react";
import {
  sourceBoardClass,
  sourceBoardFormClass,
  sourceBoardListClass,
} from "./sourceBoardClasses";

/** Shared two-column Sources board shell (sticky form + list). */
export function SourceBoardShell({
  form,
  list,
}: {
  form: ReactNode;
  list: ReactNode;
}) {
  return (
    <div className={sourceBoardClass}>
      <aside className={sourceBoardFormClass}>{form}</aside>
      <div className={sourceBoardListClass}>{list}</div>
    </div>
  );
}
