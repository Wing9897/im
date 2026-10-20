import type { ComponentType } from "react";
import type { SourceTabKey } from "../../../types/sources";

/** Query keys for the platform tab and HTTP sub-mode. The drawer uses its own names. */
export type SourcePlatformTabProps = {
  tabParam?: "tab" | "sourceTab";
  modeParam?: "mode" | "sourceMode";
};

/** Frontend counterpart to backend adapter_factory — one plugin per source platform. */
export interface SourcePlatformPlugin {
  id: SourceTabKey;
  /** Tab panel for SourceManagementPage (list + add forms). */
  Tab: ComponentType<SourcePlatformTabProps>;
}
