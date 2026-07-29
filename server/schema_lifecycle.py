"""Runtime schema upgrade gate (backup → migrate → validate → start collectors).

On failure after a successful file backup, the live DB is automatically restored
so the next attempt starts from the pre-upgrade snapshot.

A stable ``*.bak-v{from}-to-v{to}-baseline.db`` survives process restarts so a
crash mid-migrate can still restore the good pre-upgrade file on the next try.

A ``*.upgrade-verify-v{to}.json`` marker stores the pre-upgrade snapshot so a
crash after ``user_version`` stamp but before validation can still be caught
on the next startup.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

from server.db.backup import (
    cleanup_old_upgrade_backups,
    ensure_upgrade_baseline,
    find_upgrade_baseline,
    restore_database_from_backup,
)
from server.db.database import Database, SchemaBaselineError
from server.db.migrations import (
    CURRENT_SCHEMA_VERSION,
    SCHEMA_SEMVER,
    SchemaEvolutionError,
    inspect_schema,
    migration_pending,
    run_registered_step_validates,
)
from server.db.post_migration_validate import (
    PostMigrationValidationError,
    assert_live_integrity,
    assert_post_migration_data,
    capture_pre_migration_snapshot,
)
from server.db.upgrade_marker import (
    clear_upgrade_verify_marker,
    read_upgrade_verify_marker,
    snapshot_from_marker,
    write_upgrade_verify_marker,
)
from server.schema_progress import SchemaProgress

logger = logging.getLogger(__name__)

SchemaState = str  # ready | needs_upgrade | migrating | failed

__all__ = [
    "SchemaLifecycle",
    "SchemaState",
]


@dataclass
class SchemaLifecycle:
    """Tracks whether the DB needs a stop-the-world schema upgrade."""

    db: Database
    required_version: int = CURRENT_SCHEMA_VERSION
    state: SchemaState = "ready"
    current_version: int = CURRENT_SCHEMA_VERSION
    backup_path: str | None = None
    error: str | None = None
    restored_from_backup: bool = False
    progress: SchemaProgress = field(default_factory=SchemaProgress)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _finish_runtime: Optional[Callable[[], Awaitable[None]]] = None

    @property
    def runtime_ready(self) -> bool:
        return self.state == "ready"

    def snapshot(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "runtimeReady": self.runtime_ready,
            "schemaVersion": self.current_version,
            "requiredSchemaVersion": self.required_version,
            "schemaSemver": SCHEMA_SEMVER,
            "backupPath": self.backup_path,
            "error": self.error,
            "restoredFromBackup": self.restored_from_backup,
            "progress": {
                "phase": self.progress.phase,
                "percent": self.progress.percent,
                "message": self.progress.message,
            },
        }

    def _set_progress(self, phase: str, percent: int, message_key: str) -> None:
        """Set progress using stable ``message_key`` values (UI-localized)."""
        self.progress = SchemaProgress(phase=phase, percent=percent, message=message_key)

    def _resolve_baseline_path(self, source_version: int | None = None) -> str | None:
        version = source_version if source_version is not None else self.current_version
        found = find_upgrade_baseline(
            self.db.path,
            from_version=version,
            to_version=self.required_version,
        )
        return found or self.backup_path

    async def classify(self) -> None:
        fingerprint = await inspect_schema(self.db.conn)
        self.current_version = fingerprint.version
        if migration_pending(fingerprint.version):
            self.state = "needs_upgrade"
            self.backup_path = self._resolve_baseline_path(fingerprint.version)
            if not self.error:
                self._set_progress("awaiting_confirmation", 0, "needs_upgrade")
        else:
            self.state = "ready"
            self.error = None
            self.restored_from_backup = False
            self._set_progress("ready", 100, "up_to_date")

    async def heal_half_migrated_if_needed(self) -> None:
        """Restore baseline when needs_upgrade and marker+baseline both exist."""
        if self.state != "needs_upgrade":
            return
        marker = read_upgrade_verify_marker(self.db.path, self.required_version)
        if marker is None:
            return
        baseline = marker.get("baselinePath")
        if not isinstance(baseline, str) or not baseline:
            baseline = self._resolve_baseline_path()
        if not baseline or not Path(baseline).exists():
            return

        self.backup_path = baseline
        if not self.error:
            self.error = "half-migration detected; restored from baseline backup"
        try:
            await self._restore_live_from_backup(reason="half_migration")
            if self.state == "needs_upgrade":
                self._set_progress("awaiting_confirmation", 0, "healed_half_migration")
            logger.warning(
                "Auto-healed half-migration from baseline at startup (backup=%s)",
                self.backup_path,
            )
        except Exception as exc:  # noqa: BLE001
            self.state = "failed"
            self.restored_from_backup = False
            self.error = f"half-migration auto-restore failed: {exc}"
            self._set_progress("failed", 0, "half_migration_restore_failed")
            logger.exception("Startup auto-heal restore failed")

    def bind_finish_runtime(self, callback: Callable[[], Awaitable[None]]) -> None:
        self._finish_runtime = callback

    async def verify_after_stamp_or_ready(self) -> None:
        """Close the stamp→validate crash window and run cheap live checks."""
        marker = read_upgrade_verify_marker(self.db.path, self.required_version)
        if marker is not None:
            before = snapshot_from_marker(marker)
            baseline = marker.get("baselinePath")
            if isinstance(baseline, str) and baseline:
                self.backup_path = baseline
            if before is None:
                self.error = "upgrade verify marker is corrupt"
                if self.backup_path:
                    await self._restore_live_from_backup(reason="marker_corrupt")
                else:
                    self.state = "failed"
                    self._set_progress("failed", 0, "marker_corrupt")
                return
            try:
                await assert_post_migration_data(self.db.conn, before)
                from_version = int(marker.get("fromVersion", before.schema_version))
                await run_registered_step_validates(
                    self.db.conn,
                    from_version=from_version,
                    to_version=self.required_version,
                )
            except (PostMigrationValidationError, ValueError, TypeError) as exc:
                self.error = str(exc)
                logger.exception("Post-stamp startup validation failed")
                if self.backup_path:
                    await self._restore_live_from_backup(reason="startup_validate_failed")
                else:
                    self.state = "failed"
                    self._set_progress("failed", 0, "startup_validate_failed")
                return
            clear_upgrade_verify_marker(self.db.path, self.required_version)
            cleanup_old_upgrade_backups(self.db.path)
            logger.info("Cleared pending upgrade verify marker after startup check")

        try:
            await assert_live_integrity(self.db.conn)
        except PostMigrationValidationError as exc:
            self.state = "failed"
            self.error = str(exc)
            self._set_progress("failed", 0, "integrity_failed")
            logger.exception("Live integrity check failed on startup")
            return

        if self.state != "failed":
            self.state = "ready"
            self.error = None
            self.restored_from_backup = False
            self._set_progress("ready", 100, "up_to_date")

    async def _restore_live_from_backup(self, *, reason: str) -> None:
        """Close DB, overwrite live file from ``backup_path``, reopen + reclassify.

        ``reason`` is a stable log/tag key (not user-facing prose).
        """
        restore_from = self.backup_path or self._resolve_baseline_path()
        if not restore_from:
            raise RuntimeError("No backup path available for restore")
        self.backup_path = restore_from
        self._set_progress("restore", 5, "restoring")
        await self.db.close()
        restore_database_from_backup(self.db.path, restore_from)
        await self.db.connect()
        clear_upgrade_verify_marker(self.db.path, self.required_version)
        last_error = self.error
        await self.classify()
        self.error = last_error
        self.restored_from_backup = True
        if self.state == "needs_upgrade":
            self._set_progress("awaiting_confirmation", 0, "restored_retry")
        logger.warning(
            "Restored DB from backup after upgrade failure (%s); state=%s backup=%s",
            reason,
            self.state,
            self.backup_path,
        )

    async def _restore_baseline_before_attempt(self) -> dict[str, Any] | None:
        """Restore to baseline when one exists. Returns snapshot on hard failure."""
        self.backup_path = self._resolve_baseline_path()
        if self.state == "failed" and not self.backup_path:
            self._set_progress("failed", 0, "failed_no_backup")
            return self.snapshot()
        if not self.backup_path:
            return None
        try:
            if self.state == "failed":
                self.error = self.error or "previous upgrade failed"
            await self._restore_live_from_backup(
                reason="before_upgrade" if self.state != "failed" else "before_retry",
            )
            return None
        except Exception as restore_exc:  # noqa: BLE001
            self.state = "failed"
            self.restored_from_backup = False
            self.error = (
                f"{self.error}; restore before upgrade failed: {restore_exc}"
                if self.error
                else f"restore before upgrade failed: {restore_exc}"
            )
            self._set_progress("failed", 0, "cannot_restore")
            logger.exception("Restore before upgrade failed")
            return self.snapshot()

    async def run_upgrade(self) -> dict[str, Any]:
        async with self._lock:
            if self.state in ("ready", "migrating"):
                return self.snapshot()

            early = await self._restore_baseline_before_attempt()
            if early is not None:
                return early

            self.state = "migrating"
            prior_error = self.error
            self.error = None
            self.restored_from_backup = False
            source_version = self.current_version
            try:
                self._set_progress("snapshot", 5, "snapshotting")
                before = await capture_pre_migration_snapshot(self.db.conn)

                self._set_progress("backup", 15, "backing_up")
                try:
                    await self.db.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                    await self.db.conn.commit()
                except Exception as exc:  # noqa: BLE001 — backup still attempted
                    logger.warning("WAL checkpoint before backup failed: %s", exc)

                await self.db.close()
                try:
                    self.backup_path = ensure_upgrade_baseline(
                        self.db.path,
                        from_version=source_version,
                        to_version=self.required_version,
                    )
                finally:
                    await self.db.connect()

                if self.backup_path is None and self.db.path not in ("", ":memory:"):
                    raise RuntimeError("Database backup failed (file missing or unreadable)")

                # :memory: skips marker I/O; empty baseline is only used on that path.
                write_upgrade_verify_marker(
                    self.db.path,
                    from_version=source_version,
                    to_version=self.required_version,
                    baseline_path=self.backup_path or "",
                    snapshot=before,
                )

                self._set_progress("migrate", 40, "migrating")
                await self.db.ensure_schema()
                fingerprint = await inspect_schema(self.db.conn)
                self.current_version = fingerprint.version

                self._set_progress("validate", 70, "validating")
                await assert_post_migration_data(self.db.conn, before)
                clear_upgrade_verify_marker(self.db.path, self.required_version)
                cleanup_old_upgrade_backups(self.db.path)

                self._set_progress("runtime", 90, "starting_runtime")
                if self._finish_runtime is not None:
                    await self._finish_runtime()

                self.state = "ready"
                self.error = None
                self.restored_from_backup = False
                self._set_progress("ready", 100, "upgrade_complete")
                logger.info(
                    "Schema upgrade complete (v%s→v%s); backup=%s",
                    source_version,
                    self.current_version,
                    self.backup_path,
                )
            except (
                SchemaEvolutionError,
                SchemaBaselineError,
                PostMigrationValidationError,
                Exception,
            ) as exc:
                self.error = str(exc)
                logger.exception("Schema upgrade failed")
                if self.backup_path:
                    try:
                        await self._restore_live_from_backup(reason="upgrade_failed")
                        return self.snapshot()
                    except Exception as restore_exc:  # noqa: BLE001
                        self.state = "failed"
                        self.restored_from_backup = False
                        self.error = f"{exc}; auto-restore failed: {restore_exc}"
                        self._set_progress("failed", 0, "failed_auto_restore")
                        logger.exception("Auto-restore after upgrade failure also failed")
                        return self.snapshot()

                clear_upgrade_verify_marker(self.db.path, self.required_version)
                self.state = "failed"
                self.restored_from_backup = False
                self.error = self.error or prior_error
                self._set_progress("failed", 0, "upgrade_failed")
            return self.snapshot()
