import {
  detailMetaGridClass,
  detailMetaGridItemClass,
  detailMetaGridItemWideClass,
  detailMetaGridLabelClass,
  detailMetaGridValueClass,
} from "../classes";

export interface DetailMetaItem {
  label: string;
  value: string;
  wide?: boolean;
}

export function DetailMetaGrid({ items }: { items: DetailMetaItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className={detailMetaGridClass}>
      {items.map((item) => {
        const className = item.wide
          ? `${detailMetaGridItemClass} ${detailMetaGridItemWideClass}`
          : detailMetaGridItemClass;

        return (
          <div key={item.label} className={className}>
            <div className={detailMetaGridLabelClass}>{item.label}</div>
            <div className={detailMetaGridValueClass}>{item.value || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}
