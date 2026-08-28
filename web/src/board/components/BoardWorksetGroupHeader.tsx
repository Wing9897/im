import { WorksetCoverThumb } from "../../components/WorksetCoverThumb";

type Props = {
  worksetId: string;
  title: string;
  cover?: string | null;
};

/** Compact workset section label for dashboard-family board widgets. */
export function BoardWorksetGroupHeader({ worksetId, title, cover }: Props) {
  return (
    <div
      className="board-widget-workset-group__header"
      data-testid={`board-workset-header-${worksetId}`}
    >
      <WorksetCoverThumb
        cover={cover}
        name={title}
        testId={`board-workset-cover-${worksetId}`}
      />
      <span className="board-widget-workset-group__title">{title}</span>
    </div>
  );
}
