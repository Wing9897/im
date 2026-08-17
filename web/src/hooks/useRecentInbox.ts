import { useEffect, useState } from "react";
import {
  RECENT_INBOX_CHANGED_EVENT,
  RECENT_INBOX_OPEN_EVENT,
  clearRecentInbox,
  dismissRecentInboxEntry,
  isRecentInboxOpen,
  loadRecentInbox,
  setRecentInboxOpen,
  unreadRecentInboxCount,
  type RecentInboxEntry,
} from "../domain/notify/recentInbox";

export function useRecentInbox() {
  const [entries, setEntries] = useState<RecentInboxEntry[]>(() => loadRecentInbox());
  const [unread, setUnread] = useState(() => unreadRecentInboxCount());
  const [open, setOpen] = useState(() => isRecentInboxOpen());

  useEffect(() => {
    const sync = () => {
      setEntries(loadRecentInbox());
      setUnread(unreadRecentInboxCount());
      setOpen(isRecentInboxOpen());
    };
    window.addEventListener(RECENT_INBOX_CHANGED_EVENT, sync);
    window.addEventListener(RECENT_INBOX_OPEN_EVENT, sync);
    return () => {
      window.removeEventListener(RECENT_INBOX_CHANGED_EVENT, sync);
      window.removeEventListener(RECENT_INBOX_OPEN_EVENT, sync);
    };
  }, []);

  return {
    entries,
    unread,
    open,
    setOpen: setRecentInboxOpen,
    dismissEntry: dismissRecentInboxEntry,
    clearAll: clearRecentInbox,
  };
}
