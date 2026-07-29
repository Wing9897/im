import {
  detailMetricsLabelClass,
  detailMetricsRowClass,
  detailMetricsTileClass,
  detailMetricsValueClass,
} from "../classes";

export interface DetailMetric {
  label: string;
  value: string;
}

export function DetailMetricsRow({ metrics }: { metrics: DetailMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className={detailMetricsRowClass} data-testid="detail-metrics-row">
      {metrics.map((metric) => (
        <div key={metric.label} className={detailMetricsTileClass} data-testid="detail-metrics-tile">
          <div className={detailMetricsLabelClass}>{metric.label}</div>
          <div className={detailMetricsValueClass}>{metric.value || "—"}</div>
        </div>
      ))}
    </div>
  );
}
