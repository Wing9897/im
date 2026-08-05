export type { DetailField } from "./types";
export { SelectableSurface, stopSelectableActivation } from "./SelectableSurface";
export { useDetailSelection } from "./useDetailSelection";
export { DetailDialogShell } from "./shell/DetailDialogShell";
export type { DetailDialogShellProps, DetailDialogVariant } from "./shell/DetailDialogShell";
export { DetailPresentationShell } from "./shell/DetailPresentationShell";
export type {
  DetailPresentation,
  DetailPresentationShellProps,
} from "./shell/DetailPresentationShell";
export { SourceDetailDialogLayout } from "./shell/SourceDetailDialogLayout";
export { DetailPreviewPanel } from "./shell/DetailPreviewPanel";
export { MasterDetailSplit } from "./shell/MasterDetailSplit";
export { DetailMetricsRow } from "./atoms/DetailMetricsRow";
export type { DetailMetric } from "./atoms/DetailMetricsRow";
export { DetailMetaGrid } from "./atoms/DetailMetaGrid";
export type { DetailMetaItem } from "./atoms/DetailMetaGrid";
export { DetailTagList } from "./atoms/DetailTagList";

export {
  buildSourceDetailFields,
  buildDiscordBotDetailFields,
  buildEmailMailboxDetailFields,
  buildHttpSourceDetailFields,
  buildMqttBrokerDetailFields,
  buildRssFeedDetailFields,
} from "./builders/sourceDetailFields";
export {
  buildChannelNameById,
  resolveChannelLabel,
} from "./builders/taskDetailFields";
export { buildActionDetailFields } from "./builders/actionDetailFields";
