"""Shared authoritative clock block for assistant + analysis prompts."""

from __future__ import annotations

from datetime import UTC, datetime

from server.time_iso import to_iso_z

ASSISTANT_CLOCK_NOTE = "本輪對話開始時由本機系統時鐘注入一次；同對話後續輪次沿用此時刻，不每句重取"

ANALYSIS_CLOCK_NOTE = (
    "本輪分析開始時由本機系統時鐘注入一次；"
    "相對日期／時間優先以訊息行首 [time=...] 為錨點換算，缺省或需對照「現在」時再用此刻"
)


def current_time_prompt_block(
    now: datetime | None = None,
    *,
    authority_note: str = ASSISTANT_CLOCK_NOTE,
) -> str:
    """Authoritative clock from the host system timezone."""
    if now is None:
        local = datetime.now().astimezone()
    else:
        aware = now if now.tzinfo is not None else now.replace(tzinfo=UTC)
        local = aware.astimezone()
    utc = local.astimezone(UTC)
    weekday_zh = ("一", "二", "三", "四", "五", "六", "日")[local.weekday()]
    tz_label = local.tzname() or local.strftime("%Z") or "local"
    offset = local.strftime("%z")
    offset_pretty = f"{offset[:3]}:{offset[3:]}" if len(offset) == 5 else offset
    return (
        f"\n當前時間（權威，{authority_note}）：\n"
        f"- UTC：{to_iso_z(utc)}\n"
        f"- 系統本地（{tz_label}，UTC{offset_pretty}）："
        f"{local.strftime('%Y-%m-%dT%H:%M:%S')}{offset_pretty}（週{weekday_zh}）\n"
    )
