import { useRef, type ReactNode } from "react";
import { useRevealScrollbarOnScroll } from "../../hooks/useRevealScrollbarOnScroll";

/** Scroll region with auto-hidden scrollbar (reveal on hover / scroll). */
export function SourceScrollBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useRevealScrollbarOnScroll(scrollRef);

  return (
    <div
      ref={scrollRef}
      className={["im-auto-scrollbar min-h-0 flex-1 overflow-y-auto", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
