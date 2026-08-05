import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackableItem } from "../../api/items";

const navigate = vi.fn();
const setSearchParams = vi.fn();
let params = new URLSearchParams();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [params, setSearchParams],
}));

const { useItemsDeepLinks } = await import("./useItemsDeepLinks");

const item: TrackableItem = {
  id: "item-1",
  title: "Passport",
  worksetId: "ws-1",
  categoryId: "documents",
  purchasedAt: null,
  expiresAt: null,
  remindBeforeDays: 7,
  notes: "",
  status: "active",
  attributes: {},
  createdAt: null,
  updatedAt: null,
};

function Harness({
  listLayer,
  setEditing,
  setCreateWorksetId,
}: {
  listLayer: boolean;
  setEditing: React.Dispatch<React.SetStateAction<TrackableItem | null | "new">>;
  setCreateWorksetId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  useItemsDeepLinks({
    loading: false,
    items: [item],
    listLayer,
    setEditing,
    setCreateWorksetId,
  });
  return null;
}

describe("useItemsDeepLinks", () => {
  let container: HTMLDivElement;
  let root: Root;
  const setEditing = vi.fn();
  const setCreateWorksetId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens a workset-prefilled create dialog and consumes its query", () => {
    params = new URLSearchParams("new=1&worksetId=ws-1");
    act(() => {
      root.render(
        <Harness
          listLayer={false}
          setEditing={setEditing}
          setCreateWorksetId={setCreateWorksetId}
        />,
      );
    });

    expect(setCreateWorksetId).toHaveBeenCalledWith("ws-1");
    expect(setEditing).toHaveBeenCalledWith("new");
    expect(setSearchParams).toHaveBeenCalledWith(new URLSearchParams(), { replace: true });
  });

  it("routes an item link into its category before opening the editor", () => {
    params = new URLSearchParams("itemId=item-1&itemDateKind=expires");
    act(() => {
      root.render(
        <Harness
          listLayer={false}
          setEditing={setEditing}
          setCreateWorksetId={setCreateWorksetId}
        />,
      );
    });

    expect(navigate).toHaveBeenCalledWith(
      "/items/category/documents?itemId=item-1&itemDateKind=expires",
      { replace: true },
    );
    expect(setEditing).not.toHaveBeenCalled();
  });
});
