import type { ComponentType } from "react";
import type { SourceTabKey } from "../../../types/sources";

/** Frontend counterpart to backend adapter_factory — one plugin per source platform. */
export interface SourcePlatformPlugin {
  id: SourceTabKey;
  /** Tab panel for SourceManagementPage (list + add forms). */
  Tab: ComponentType;
}
