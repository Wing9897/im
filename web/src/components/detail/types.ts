export interface DetailField {
  label: string;
  value: string;
  /** `metric` = stat highlight; `wide` = full-width tile for long/multi-line text. */
  variant?: "default" | "metric" | "wide";
  /**
   * Field is rendered by a dedicated dialog section (hero / title / tag list /
   * error banner), so generic meta grids must skip it.
   */
  standalone?: boolean;
}
