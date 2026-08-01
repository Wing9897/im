import {
  detailContentSectionClass,
  detailContentSectionTitleClass,
  detailTagListClass,
  detailTagListTagClass,
} from "../classes";

export function DetailTagList({ tags, title }: { tags: string[]; title?: string }) {
  if (tags.length === 0) return null;

  return (
    <div className={detailContentSectionClass}>
      {title ? <div className={detailContentSectionTitleClass}>{title}</div> : null}
      <div className={detailTagListClass}>
        {tags.map((tag) => (
          <span key={tag} className={detailTagListTagClass}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
