/** Shared Tailwind page shell layout — spacing from tailwind.css @theme tokens. */
const pageShellLayoutClass =
  "flex min-h-full w-full flex-col gap-md px-page-x py-md max-[780px]:px-sm max-[780px]:py-sm";

export const pageShellRootClass = `mx-auto ${pageShellLayoutClass}`;

/** Opacity fade-in for content panes (respects reduced-motion via data-allow-opacity-transition). */
export const contentFadeClass = "im-content-fade opacity-100";
