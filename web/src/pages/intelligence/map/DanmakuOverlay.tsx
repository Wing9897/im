import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent, Message } from "../../../types";
import {
  EVENT_PANEL_MAX_HEIGHT,
  EVENT_PANEL_MIN_HEIGHT,
  LIVE_INFO_PANEL_MAX_HEIGHT,
  LIVE_INFO_PANEL_MIN_HEIGHT,
} from "./mapViewHelpers";
import {
  mapDanmakuContentClass,
  mapDanmakuItemClass,
  mapDanmakuPanelClass,
  mapDanmakuTitleClass,
  mapLiveInfoContentClass,
  mapLiveInfoItemClass,
  mapLiveInfoPanelClass,
  mapLiveInfoTitleClass,
  mapLiveInfoTransientContainerClass,
  mapLiveInfoTransientItemClass,
  mapTransientContainerClass,
  mapTransientItemClass,
  mapTransientItemsColumnClass,
  mapTransientPanelRowClass,
} from "./mapViewClasses";
import { PanelSpine } from "./PanelSpine";
import { ResizablePersistentPanel } from "./DanmakuResizablePanel";
import {
  useSkipFirstEffect,
  useTransientMessages,
  type TransientMsg,
} from "./useTransientMessages";

function formatLiveInfoTitle(message: Message, fallback: string) {
  return message.channelName ?? message.senderName ?? message.platform ?? fallback;
}

interface EventDanmakuPersistentProps {
  items: AnalysisEvent[];
  height: number;
  onHeightChange: (height: number) => void;
}

export function EventDanmakuPersistent({
  items,
  height,
  onHeightChange,
}: EventDanmakuPersistentProps) {
  const { t } = useTranslation("intelligence");
  if (items.length === 0) return null;
  return (
    <ResizablePersistentPanel
      panelClassName={mapDanmakuPanelClass}
      height={height}
      minHeight={EVENT_PANEL_MIN_HEIGHT}
      maxHeight={EVENT_PANEL_MAX_HEIGHT}
      onHeightChange={onHeightChange}
      resizeFrom="top"
      spineVariant="event"
      panelLabel={t("map.panelEvent")}
    >
      {items.map((item) => (
        <div key={item.id} className={mapDanmakuItemClass}>
          <div className={mapDanmakuTitleClass}>{item.title}</div>
          <div className={mapDanmakuContentClass}>{item.body}</div>
        </div>
      ))}
    </ResizablePersistentPanel>
  );
}

interface EventDanmakuTransientProps {
  filteredItems: AnalysisEvent[];
  newItemIds: Set<string>;
}

export function EventDanmakuTransient({ filteredItems, newItemIds }: EventDanmakuTransientProps) {
  const { t } = useTranslation("intelligence");
  const { msgs, setMsgs } = useTransientMessages();

  useSkipFirstEffect(() => {
    if (newItemIds.size === 0) return;
    const now = Date.now();
    const nm: TransientMsg[] = [];
    for (const item of filteredItems) {
      if (newItemIds.has(item.id)) {
        nm.push({
          id: `${item.id}-${now}`,
          title: item.title,
          content: item.body,
          addedAt: now,
        });
      }
    }
    if (nm.length > 0) setMsgs((prev) => [...prev, ...nm].slice(-3));
  }, [newItemIds, filteredItems, setMsgs]);

  if (msgs.length === 0) return null;
  return (
    <div className={mapTransientContainerClass}>
      <div className={mapTransientPanelRowClass}>
        <PanelSpine variant="event" label={t("map.panelEvent")} />
        <div className={mapTransientItemsColumnClass}>
          {msgs.map((m) => (
            <div key={m.id} className={mapTransientItemClass}>
              <div className={mapDanmakuTitleClass}>{m.title}</div>
              <div className={mapDanmakuContentClass}>{m.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LiveInfoDanmakuPersistentProps {
  messages: Message[];
  height: number;
  onHeightChange: (height: number) => void;
}

export function LiveInfoDanmakuPersistent({
  messages,
  height,
  onHeightChange,
}: LiveInfoDanmakuPersistentProps) {
  const { t } = useTranslation("intelligence");
  return (
    <ResizablePersistentPanel
      panelClassName={mapLiveInfoPanelClass}
      height={height}
      minHeight={LIVE_INFO_PANEL_MIN_HEIGHT}
      maxHeight={LIVE_INFO_PANEL_MAX_HEIGHT}
      onHeightChange={onHeightChange}
      resizeFrom="bottom"
      spineVariant="live"
      panelLabel={t("map.panelLive")}
    >
      {messages.length === 0 ? (
        <div className={mapLiveInfoItemClass}>
          <div className={mapLiveInfoTitleClass}>{t("map.liveInfoDefaultTitle")}</div>
          <div className={mapLiveInfoContentClass}>{t("map.liveInfoEmpty")}</div>
        </div>
      ) : (
        messages.map((message) => (
          <div key={message.id} className={mapLiveInfoItemClass}>
            <div className={mapLiveInfoTitleClass}>
              {formatLiveInfoTitle(message, t("map.liveInfoDefaultTitle"))}
            </div>
            <div className={mapLiveInfoContentClass}>{message.content}</div>
          </div>
        ))
      )}
    </ResizablePersistentPanel>
  );
}

interface LiveInfoDanmakuTransientProps {
  messages: Message[];
}

export function LiveInfoDanmakuTransient({ messages }: LiveInfoDanmakuTransientProps) {
  const { t } = useTranslation("intelligence");
  const { msgs, setMsgs } = useTransientMessages();
  const liveInfoDefaultTitle = t("map.liveInfoDefaultTitle");

  useEffect(() => {
    if (messages.length === 0) return;
    const now = Date.now();
    const next = messages.map((message) => ({
      id: `${message.id}-${now}`,
      title: formatLiveInfoTitle(message, liveInfoDefaultTitle),
      content: message.content,
      addedAt: now,
    }));
    setMsgs((prev) => [...prev, ...next].slice(-4));
  }, [messages, setMsgs, liveInfoDefaultTitle]);

  if (msgs.length === 0) return null;
  return (
    <div className={mapLiveInfoTransientContainerClass}>
      <div className={mapTransientPanelRowClass}>
        <PanelSpine variant="live" label={t("map.panelLive")} />
        <div className={mapTransientItemsColumnClass}>
          {msgs.map((message) => (
            <div key={message.id} className={mapLiveInfoTransientItemClass}>
              <div className={mapLiveInfoTitleClass}>{message.title}</div>
              <div className={mapLiveInfoContentClass}>{message.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
