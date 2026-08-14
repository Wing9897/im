# Desktop ICS import

One-shot `.ics` file / `intelligencemonitor://calendar/import` deep-link import for the Desktop shell. The end-to-end flow (OS association → Electron IPC → `/api/v1/calendar/imports/preview` → `/commit`) is summarized in [`ARCHITECTURE.md` Desktop Shell](ARCHITECTURE.md#desktop-shell-desktop); the desktop shell contains no calendar business parser — RFC 5545 interpretation, preview diffs, UID idempotency, and the transaction live in the Python server.

## ICS import support and limits

| Topic | Behavior |
|-------|----------|
| Input bounds | UTF-8 only; maximum **2 MiB** and **2,000 VEVENTs**. Desktop checks bytes before IPC and while downloading; server rechecks both limits. |
| Supported input | Multi-event VCALENDAR; escaped／folded text; UTC, floating DATE-TIME, IANA `TZID`, embedded `VTIMEZONE`, `VALUE=DATE` all-day and multi-day events, `DTEND`／`DURATION`; RRULE `DAILY`／`WEEKLY`／`MONTHLY`／`YEARLY` with `INTERVAL`／`BYDAY`／`BYMONTHDAY`／`BYMONTH`／`COUNT` or `UNTIL`; `EXDATE` and `RDATE` date/date-time values. |
| Persistence | No RRULE → `user_events(origin='ics')`; RRULE → standalone `recurring_schedules` series. UTC instants are persisted for timed values; original local anchor, TZID／VTIMEZONE, all-day dates, exceptions, UID, source, and fingerprint are retained where recurrence expansion needs them. |
| Idempotency | `(ics_source, ics_uid)` is unique per target table. Preview reports create/update/unchanged and field diffs; commit reparses and verifies each preview fingerprint. Updates preserve the existing event/task id; all selected writes share one SQLite transaction. |
| Explicitly unsupported | `RECURRENCE-ID` override instances, duplicate supported UIDs in one file, missing UID, PERIOD-valued RDATE/EXDATE, mixed DATE/DATE-TIME boundaries, unsupported RRULE components/frequencies. They remain visible with warnings and cannot be selected; they are never silently imported. |
| Floating time | Interpreted in the **server host system timezone** and shown with a warning. Desktop-host mode normally matches the user's machine; remote-server mode may not. |
| External sync | One-shot import only. No subscription refresh, webcal, CalDAV, provider OAuth, attendee updates, alarm import, or bidirectional synchronization. |

## Remote URL policy

Remote `url=` deep links accept only public HTTP(S) targets. Electron resolves the hostname, rejects credentials and any private／loopback／link-local／reserved address (including IPv4-mapped IPv6), pins the validated address for the connection, and repeats validation after every redirect. Downloads allow at most 3 redirects, have a 20-second total/idle timeout, and enforce the 2 MiB limit from both `Content-Length` and streamed bytes. This deliberately prevents calendar links from probing localhost, LAN services, or cloud metadata endpoints.
