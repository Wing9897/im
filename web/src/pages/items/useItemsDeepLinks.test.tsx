import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackableItem } from "../../api/items";

const navigate = vi.fn();
const setSearchParams = vi.fn();
let params = new URLSearchParams();
let routeCategoryId: string | undefined;

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [params, setSearchParams],
  useParams: () => ({ categoryId: routeCategoryId }),
}));

const { useItemsDeepLinks } = await import("./useItemsDeepLinks");

const item: TrackableItem = {
  id: "item-1",
  title: "Passport",
  worksetId: "ws-1",
  categoryId: "documents",
  expiresAt: null,
  remindBeforeDays: 7,
  notes: "",
  status: "active",
  createdAt: null,
  updatedAt: null,
};

function Harness({ listLayer }: { listLayer: boolean }) {
  useItemsDeepLinks({
    loading: false,
    items: [item],
    listLayer,
  });
  return null;
}

describe("useItemsDeepLinks", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams();
    routeCategoryId = undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("redirects workset-prefilled create query to /items/new", () => {
    params = new URLSearchParams("new=1&worksetId=ws-1");
    act(() => {
      root.render(<Harness listLayer={false} />);
    });

    expect(navigate).toHaveBeenCalledWith("/items/new?worksetId=ws-1", { replace: true });
    expect(setSearchParams).toHaveBeenCalledWith(new URLSearchParams(), { replace: true });
  });

  it("routes an item link into its category and strips legacy itemDateKind", () => {
    params = new URLSearchParams("itemId=item-1&itemDateKind=expires");
    act(() => {
      root.render(<Harness listLayer={false} />);
    });

    expect(navigate).toHaveBeenCalledWith(
      "/items/category/documents?itemId=item-1",
      { replace: true },
    );
  });

  it("opens edit page with origin category when itemId is present on list layer", () => {
    routeCategoryId = "documents";
    params = new URLSearchParams("itemId=item-1");
    act(() => {
      root.render(<Harness listLayer={true} />);
    });

    expect(navigate).toHaveBeenCalledWith(
      "/items/item-1/edit?categoryId=documents",
      { replace: true },
    );
  });

  it("falls back to item category when list route id is missing", () => {
    routeCategoryId = undefined;
    params = new URLSearchParams("itemId=item-1");
    act(() => {
      root.render(<Harness listLayer={true} />);
    });

    expect(navigate).toHaveBeenCalledWith(
      "/items/item-1/edit?categoryId=documents",
      { replace: true },
    );
  });
});
