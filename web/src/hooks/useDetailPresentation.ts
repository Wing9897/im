import { useMediaQuery } from "./useMediaQuery";

export type DetailPresentationMode = "inline" | "drawer";

/** Wide screens use inline master–detail; narrower screens keep the right drawer. */
const DETAIL_SPLIT_MEDIA_QUERY = "(min-width: 1100px)";

export function useDetailPresentation(): DetailPresentationMode {
  const wide = useMediaQuery(DETAIL_SPLIT_MEDIA_QUERY);
  return wide ? "inline" : "drawer";
}
