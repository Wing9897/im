import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/ToastContext";
import { useMonitorMode } from "../context/MonitorModeContext";
import {
  addWidget,
  exportBoardConfig,
  hydrateBoardPrefs,
  importBoardConfig,
  resetBoardConfig,
} from "./boardLayoutStore";
import { BoardCanvas } from "./BoardCanvas";
import { BoardChrome } from "./BoardChrome";
import { useBoardFullscreen } from "./useBoardFullscreen";
import type { BoardConfig, BoardEditMode, BoardWidgetType } from "./types";

interface BoardRootProps {
  onImmersiveChange?: (immersive: boolean) => void;
}

export function BoardRoot({ onImmersiveChange }: BoardRootProps) {
  const { t } = useTranslation("common");
  const { monitorMode } = useMonitorMode();
  const toast = useToast();
  const [config, setConfig] = useState<BoardConfig | null>(null);
  const [editMode, setEditMode] = useState<BoardEditMode>("view");
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  /** Bumped on reset so BoardCanvas + Rnd remount with fresh geometry. */
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const { containerRef, isFullscreen, toggleFullscreen } =
    useBoardFullscreen(onImmersiveChange);

  useEffect(() => {
    let cancelled = false;
    void hydrateBoardPrefs().then((hydrated) => {
      if (!cancelled) {
        setConfig(hydrated);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddWidget = useCallback((type: BoardWidgetType) => {
    setConfig((current) => (current ? addWidget(current, type) : current));
  }, []);

  const handleResetLayout = useCallback(() => {
    setMaximizedId(null);
    setConfig(resetBoardConfig());
    setCanvasEpoch((epoch) => epoch + 1);
  }, []);

  const handleExportLayout = useCallback(() => {
    if (!config) return;
    const blob = new Blob([exportBoardConfig(config)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "intelligencemonitor-board-layout.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast?.showToast(t("board:shell.exported"), "success");
  }, [config, t, toast]);

  const handleImportLayout = useCallback(
    async (file: File) => {
      try {
        const imported = importBoardConfig(await file.text());
        setMaximizedId(null);
        setConfig(imported);
        setCanvasEpoch((epoch) => epoch + 1);
        toast?.showToast(t("board:shell.imported"), "success");
      } catch (error) {
        toast?.showToast(
          error instanceof Error ? error.message : t("board:shell.importFailed"),
          "error",
        );
      }
    },
    [t, toast],
  );

  // Leaving canvas while system-fullscreen: exit FS so shell chrome can return.
  useEffect(() => {
    if (monitorMode === "canvas") {
      return;
    }
    const el = containerRef.current;
    if (el && document.fullscreenElement === el) {
      void document.exitFullscreen();
    }
  }, [monitorMode, containerRef]);

  if (!config) {
    return (
      <div
        ref={containerRef}
        className="board-root im-fs-atmosphere"
        data-testid="board-root"
        data-board-hydrating="true"
      />
    );
  }

  return (
    <div ref={containerRef} className="board-root im-fs-atmosphere" data-testid="board-root">
      <BoardCanvas
        key={canvasEpoch}
        config={config}
        editMode={editMode}
        maximizedId={maximizedId}
        onConfigChange={setConfig}
        onMaximize={setMaximizedId}
        chrome={
          <BoardChrome
            editMode={editMode}
            isFullscreen={isFullscreen}
            onEditModeChange={setEditMode}
            onAddWidget={handleAddWidget}
            onResetLayout={handleResetLayout}
            onExportLayout={handleExportLayout}
            onImportLayout={handleImportLayout}
            onToggleFullscreen={() => void toggleFullscreen()}
          />
        }
      />
    </div>
  );
}
