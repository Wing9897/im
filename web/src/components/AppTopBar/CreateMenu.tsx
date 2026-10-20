import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useSimpleMode } from "../../context/SimpleModeContext";
import { withReturnTo } from "../../routing/returnTo";
import { Button } from "../ui";
import { surfaceOverlayHover60Class } from "../ui/controlStyles";

/** Top-bar create menu. Tasks and sources stay hidden in simple mode. */
export function CreateMenu() {
  const { t } = useTranslation("common");
  const { simpleMode } = useSimpleMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const back = `${location.pathname}${location.search}${location.hash}`;
  const onSourcesPage = location.pathname === "/sources";

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (run: () => void) => {
    setOpen(false);
    run();
  };

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    });
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        type="button"
        variant="primary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="topbar-create"
        onClick={() => setOpen((prev) => !prev)}
      >
        {t("createMenu.label")}
      </Button>
      {open ? (
        <ul
          role="menu"
          aria-label={t("createMenu.aria")}
          data-testid="topbar-create-menu"
          className="im-menu-surface absolute right-0 top-full z-[80] m-0 mt-1.5 min-w-[168px] list-none rounded-lg p-1"
        >
          <CreateItem
            testId="topbar-create-event"
            label={t("createMenu.event")}
            onClick={() => choose(() => setParam("event", "new"))}
          />
          <CreateItem
            testId="topbar-create-recurring"
            label={t("createMenu.recurring")}
            onClick={() => choose(() => setParam("event", "recurring"))}
          />
          <CreateItem
            testId="topbar-create-item"
            label={t("createMenu.item")}
            onClick={() => choose(() => navigate(withReturnTo("/items/new", back)))}
          />
          {simpleMode ? null : (
            <>
              <CreateItem
                testId="topbar-create-task"
                label={t("createMenu.task")}
                onClick={() => choose(() => navigate(withReturnTo("/tasks/new", back)))}
              />
              {onSourcesPage ? null : (
                <CreateItem
                  testId="topbar-create-source"
                  label={t("createMenu.source")}
                  onClick={() => choose(() => setParam("source", "new"))}
                />
              )}
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}

function CreateItem({
  testId,
  label,
  onClick,
}: {
  testId: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        className={`w-full cursor-pointer rounded-md border-0 bg-transparent px-sm py-1.5 text-left text-body text-text-primary transition-colors ${surfaceOverlayHover60Class}`}
        data-testid={testId}
        onClick={onClick}
      >
        {label}
      </button>
    </li>
  );
}
