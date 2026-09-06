/** Product mark from the public logo. Empty alt when the name sits beside it. */
export const PRODUCT_MARK_SRC = "/logo.png?v=ffb6ddd7";

type ProductMarkProps = {
  sizePx?: number;
  className?: string;
  alt?: string;
};

export function ProductMark({
  sizePx = 22,
  className = "",
  alt = "",
}: ProductMarkProps) {
  return (
    <img
      src={PRODUCT_MARK_SRC}
      alt={alt}
      width={sizePx}
      height={sizePx}
      className={["shrink-0 object-contain", className].filter(Boolean).join(" ")}
      draggable={false}
      data-testid="product-mark"
    />
  );
}
