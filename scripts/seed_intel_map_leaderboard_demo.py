"""Seed intelligence-map + leaderboard screenshot fixtures.

Prefix: ``[intel-demo]`` on event titles / task names (easy to spot and delete).
Writes the live app SQLite (Windows: ``%APPDATA%\\Intelligence Monitor\\intelligence_monitor.db``).
Server may be running — SQLite writes are OK.

Coords live on ``analysis_events.latitude`` / ``longitude`` (not JSON).
Map ``GET /api/v1/results/events?hasCoords=true`` requires both columns non-null
(and the UI skips 0,0 Null Island). Leaderboard is ``trending_topics`` on
``analysis_mode=leaderboard`` tasks — not derived from intel events.

  uv run python scripts/seed_intel_map_leaderboard_demo.py
  uv run python scripts/seed_intel_map_leaderboard_demo.py --clean   # remove prior [intel-demo] then re-seed
"""

from __future__ import annotations

import hashlib
import json
from argparse import Namespace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TypedDict

from _seed_common import (
    ensure_completed_batch,
    ensure_intel_task,
    ensure_llm_profile,
    insert_analysis_event,
    run_seed_cli,
)

from server.db.database import Database
from server.domain.analysis_modes import INTEL_EVENT_MODE, LEADERBOARD_MODE
from server.util import utc_now_iso

PREFIX = "[intel-demo]"
IDP = "intel-demo"


class EventSpec(TypedDict):
    id: str
    title: str
    body: str
    start: str | None
    end: str | None
    location: str
    lat: float | None
    lon: float | None
    source_index: int | None


SOURCE_ID = f"{IDP}-rss"
RSS_FEED_URL = "https://demo.local/intelligence-monitor/intel-map-leaderboard.xml"
LLM_PROFILE_ID = f"{IDP}-llm"
INTEL_TASK_ID = f"{IDP}-intel"
LB_HOT_TASK_ID = f"{IDP}-lb-hot"
LB_HEAT_TASK_ID = f"{IDP}-lb-heat"
INTEL_BATCH_ID = f"{IDP}-intel-batch"
LB_HOT_BATCH_ID = f"{IDP}-lb-hot-batch"
LB_HEAT_BATCH_ID = f"{IDP}-lb-heat-batch"

# Real-ish city centres; jittered per event so markers do not stack.
_CLUSTERS: dict[str, tuple[float, float, str]] = {
    "hk": (22.3193, 114.1694, "香港"),
    "tw": (25.0330, 121.5654, "台北"),
    "jp": (35.6762, 139.6503, "東京"),
    "sg": (1.3521, 103.8198, "新加坡"),
    "kr": (37.5665, 126.9780, "首爾"),
    "osaka": (34.6937, 135.5023, "大阪"),
    "khh": (22.6273, 120.3014, "高雄"),
}


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _jitter(lat: float, lon: float, seed: str, *, scale: float = 0.035) -> tuple[float, float]:
    digest = hashlib.sha256(seed.encode()).digest()
    dlat = (digest[0] / 255.0 - 0.5) * scale
    dlon = (digest[1] / 255.0 - 0.5) * scale
    return round(lat + dlat, 5), round(lon + dlon, 5)


async def _clean(db: Database) -> None:
    """Remove only this script's namespace (not unrelated user data)."""
    like_id = f"{IDP}-%"
    like_title = f"{PREFIX}%"
    task_ids = (INTEL_TASK_ID, LB_HOT_TASK_ID, LB_HEAT_TASK_ID)

    for table in ("timeline_importance", "timeline_dismissals"):
        await db.execute(f"DELETE FROM {table} WHERE event_id LIKE ?", (like_id,))
        await db.execute(
            f"DELETE FROM {table} WHERE event_id IN (SELECT id FROM analysis_events WHERE id LIKE ?)",
            (like_id,),
        )

    await db.execute("DELETE FROM topic_messages WHERE topic_id LIKE ?", (like_id,))
    await db.execute("DELETE FROM trending_topics WHERE id LIKE ?", (like_id,))
    await db.execute("DELETE FROM trending_topics WHERE task_id IN (?, ?)", (LB_HOT_TASK_ID, LB_HEAT_TASK_ID))
    await db.execute("DELETE FROM analysis_markers WHERE task_id IN (?, ?, ?)", task_ids)
    await db.execute("DELETE FROM analysis_events WHERE id LIKE ?", (like_id,))
    await db.execute("DELETE FROM analysis_events WHERE title LIKE ?", (like_title,))
    await db.execute(
        "DELETE FROM analysis_batches WHERE id IN (?, ?, ?)",
        (INTEL_BATCH_ID, LB_HOT_BATCH_ID, LB_HEAT_BATCH_ID),
    )
    await db.execute("DELETE FROM analysis_batches WHERE task_id IN (?, ?, ?)", task_ids)
    await db.execute("DELETE FROM task_channels WHERE task_id IN (?, ?, ?)", task_ids)
    for tid in task_ids:
        await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (tid,))
    await db.execute("DELETE FROM llm_profiles WHERE id = ?", (LLM_PROFILE_ID,))
    await db.execute("DELETE FROM messages WHERE id LIKE ?", (like_id,))
    await db.execute("DELETE FROM source_channels WHERE source_id = ?", (SOURCE_ID,))
    await db.execute("DELETE FROM sources WHERE id = ?", (SOURCE_ID,))
    await db.execute(
        "DELETE FROM channels WHERE platform = 'rss' AND platform_id = ?",
        (RSS_FEED_URL,),
    )


async def _ensure_source_and_messages(db: Database, now: str, now_dt: datetime) -> list[str]:
    source = await db.fetch_one("SELECT id FROM sources WHERE id = ?", (SOURCE_ID,))
    if not source:
        creds = json.dumps({"feed_url": RSS_FEED_URL, "poll_interval_seconds": 3600})
        await db.execute(
            "INSERT INTO sources (id, platform, name, status, credentials, "
            "last_connected_at, created_at, updated_at) VALUES (?, 'rss', ?, 'disconnected', ?, NULL, ?, ?)",
            (SOURCE_ID, f"{PREFIX} RSS 示範來源", creds, now, now),
        )
    channel = await db.fetch_one(
        "SELECT platform FROM channels WHERE platform = 'rss' AND platform_id = ?",
        (RSS_FEED_URL,),
    )
    if not channel:
        await db.execute(
            "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES ('rss', ?, ?, ?)",
            (RSS_FEED_URL, f"{PREFIX} 示範頻道", now),
        )
    link = await db.fetch_one(
        "SELECT source_id FROM source_channels WHERE source_id = ? AND platform = 'rss' AND platform_id = ?",
        (SOURCE_ID, RSS_FEED_URL),
    )
    if not link:
        await db.execute(
            "INSERT INTO source_channels (source_id, platform, platform_id) VALUES (?, 'rss', ?)",
            (SOURCE_ID, RSS_FEED_URL),
        )

    messages = [
        (
            f"{IDP}-msg-1",
            "港島論壇轉述今晚維港兩岸有臨時集會傳聞，尚未有官方確認。",
            now_dt - timedelta(hours=3),
        ),
        (
            f"{IDP}-msg-2",
            "台北信義區捷運出口人流異常，討論區把「快閃快閃」貼到熱門。",
            now_dt - timedelta(hours=5),
        ),
        (
            f"{IDP}-msg-3",
            "東京澀谷交叉口晚間封路演習，地方媒體說是交通局預演。",
            now_dt - timedelta(hours=8),
        ),
        (
            f"{IDP}-msg-4",
            "新加坡濱海灣煙火彩排改期，票務群組轉發官方 PDF。",
            now_dt - timedelta(days=2, hours=4),
        ),
        (
            f"{IDP}-msg-5",
            "首爾漢江公園週末市集攤位加倍，社群標籤開始刷屏。",
            now_dt - timedelta(days=4),
        ),
        (
            f"{IDP}-msg-6",
            "高雄港區夜間施工公告延長，在地社團在問噪音時段。",
            now_dt - timedelta(days=9),
        ),
        (
            f"{IDP}-msg-7",
            "大阪萬博週邊接駁巴士加班，旅客抱怨地圖標記對不上。",
            now_dt - timedelta(days=14),
        ),
        (
            f"{IDP}-msg-8",
            "線上論壇流傳一份無來源簡報，標題很大、座標全空。",
            now_dt - timedelta(days=1, hours=2),
        ),
    ]
    message_ids: list[str] = []
    for index, (message_id, content, ts) in enumerate(messages, start=1):
        message_ids.append(message_id)
        exists = await db.fetch_one("SELECT id FROM messages WHERE id = ?", (message_id,))
        if exists:
            continue
        await db.execute(
            "INSERT INTO messages (id, source_id, platform, platform_id, "
            "platform_message_id, sender_id, sender_name, content, timestamp, "
            "raw_data, created_at) VALUES (?, ?, 'rss', ?, ?, 'intel-demo-sender', ?, ?, ?, NULL, ?)",
            (
                message_id,
                SOURCE_ID,
                RSS_FEED_URL,
                f"intel-demo-pmid-{index}",
                f"{PREFIX} 示範記者 {index}",
                content,
                _iso(ts),
                now,
            ),
        )
    return message_ids


async def _ensure_tasks(db: Database) -> None:
    await ensure_intel_task(
        db,
        task_id=INTEL_TASK_ID,
        name=f"{PREFIX} 情報事件任務",
        llm_profile_id=LLM_PROFILE_ID,
        analysis_mode=INTEL_EVENT_MODE,
        description="dev seed — inactive so dummy LLM is never ticked",
        is_active=0,
    )
    await ensure_intel_task(
        db,
        task_id=LB_HOT_TASK_ID,
        name=f"{PREFIX} 熱門話題排行",
        llm_profile_id=LLM_PROFILE_ID,
        analysis_mode=LEADERBOARD_MODE,
        description="dev seed — inactive; trending_topics pre-inserted",
        is_active=0,
    )
    await ensure_intel_task(
        db,
        task_id=LB_HEAT_TASK_ID,
        name=f"{PREFIX} 討論熱度",
        llm_profile_id=LLM_PROFILE_ID,
        analysis_mode=LEADERBOARD_MODE,
        description="dev seed — inactive; trending_topics pre-inserted",
        is_active=0,
    )
    for task_id in (INTEL_TASK_ID, LB_HOT_TASK_ID, LB_HEAT_TASK_ID):
        bound = await db.fetch_one(
            "SELECT task_id FROM task_channels WHERE task_id = ? AND platform = 'rss' AND platform_id = ?",
            (task_id, RSS_FEED_URL),
        )
        if not bound:
            await db.execute(
                "INSERT INTO task_channels (task_id, platform, platform_id) VALUES (?, 'rss', ?)",
                (task_id, RSS_FEED_URL),
            )


def _geo_event(
    *,
    slug: str,
    title: str,
    body: str,
    cluster: str,
    start: datetime,
    hours: float = 1.5,
    location: str | None = None,
    source_index: int | None = None,
) -> EventSpec:
    lat0, lon0, city = _CLUSTERS[cluster]
    lat, lon = _jitter(lat0, lon0, slug)
    return {
        "id": f"{IDP}-ae-{slug}",
        "title": f"{PREFIX} {title}",
        "body": body,
        "start": _iso(start),
        "end": _iso(start + timedelta(hours=hours)),
        "location": location or city,
        "lat": lat,
        "lon": lon,
        "source_index": source_index,
    }


def _plain_event(
    *,
    slug: str,
    title: str,
    body: str,
    start: datetime | None,
    hours: float = 1.0,
    location: str = "N/A",
    source_index: int | None = None,
) -> EventSpec:
    spec: EventSpec = {
        "id": f"{IDP}-ae-{slug}",
        "title": f"{PREFIX} {title}",
        "body": body,
        "start": _iso(start) if start is not None else None,
        "end": _iso(start + timedelta(hours=hours)) if start is not None else None,
        "location": location,
        "lat": None,
        "lon": None,
        "source_index": source_index,
    }
    return spec


def _event_specs(now_dt: datetime) -> list[EventSpec]:
    """Mix of geo clusters (live ±12h + 7–30d) and list-only rows without coords."""
    return [
        # ── live map default (±12h) — all major clusters ──
        _geo_event(
            slug="hk-harbour-now",
            title="維港兩岸臨時集會傳聞",
            body="示範座標：香港中環／維港一帶。未證實，僅供地圖聚類。",
            cluster="hk",
            start=now_dt - timedelta(hours=2),
            location="中環海濱",
            source_index=0,
        ),
        _geo_event(
            slug="hk-lan-kwai",
            title="蘭桂坊封路演習通知",
            body="示範座標：香港島，與維港點略為錯開。",
            cluster="hk",
            start=now_dt - timedelta(hours=5),
            location="蘭桂坊",
        ),
        _geo_event(
            slug="tw-xinyi-now",
            title="信義區捷運出口人流異常",
            body="示範座標：台北信義。社群熱度上升，官方尚未說明。",
            cluster="tw",
            start=now_dt - timedelta(hours=3),
            location="台北信義",
            source_index=1,
        ),
        _geo_event(
            slug="tw-datong",
            title="大稻埕河岸市集加開夜場",
            body="示範座標：台北市區第二點。",
            cluster="tw",
            start=now_dt - timedelta(hours=7),
            location="大稻埕",
        ),
        _geo_event(
            slug="jp-shibuya-now",
            title="澀谷交叉口夜間封路預演",
            body="示範座標：東京澀谷。交通局演習，不是突發事件。",
            cluster="jp",
            start=now_dt - timedelta(hours=4),
            location="澀谷",
            source_index=2,
        ),
        _geo_event(
            slug="jp-odaiba",
            title="台場觀景平台人潮預告",
            body="示範座標：東京灣岸，與澀谷分開。",
            cluster="jp",
            start=now_dt - timedelta(hours=9),
            location="台場",
        ),
        _geo_event(
            slug="sg-marina-now",
            title="濱海灣彩排改期公告",
            body="示範座標：新加坡濱海灣。",
            cluster="sg",
            start=now_dt - timedelta(hours=6),
            location="濱海灣",
            source_index=3,
        ),
        _geo_event(
            slug="kr-hangang-now",
            title="漢江公園週末市集加倍",
            body="示範座標：首爾漢江。",
            cluster="kr",
            start=now_dt - timedelta(hours=1, minutes=20),
            location="漢江公園",
            source_index=4,
        ),
        _geo_event(
            slug="osaka-expo-now",
            title="萬博週邊接駁加班",
            body="示範座標：大阪。接駁巴士與地圖標記對不上的客訴。",
            cluster="osaka",
            start=now_dt - timedelta(hours=10),
            location="夢洲週邊",
        ),
        _geo_event(
            slug="khh-harbour-now",
            title="高雄港區夜間施工延長",
            body="示範座標：高雄港。在地社團在問噪音時段。",
            cluster="khh",
            start=now_dt - timedelta(hours=8),
            location="高雄港",
            source_index=5,
        ),
        # ── 12–72h (map live window option 72h) ──
        _geo_event(
            slug="hk-adm-yesterday",
            title="金鐘行人通道臨時改道",
            body="示範座標：香港金鐘。昨日交通調整。",
            cluster="hk",
            start=now_dt - timedelta(hours=20),
            location="金鐘",
        ),
        _geo_event(
            slug="tw-nangang-yday",
            title="南港展覽館進場人流高峰",
            body="示範座標：台北南港。",
            cluster="tw",
            start=now_dt - timedelta(hours=30),
            location="南港",
        ),
        _geo_event(
            slug="jp-shinjuku-yday",
            title="新宿西口廣場快閃演出",
            body="示範座標：東京新宿。",
            cluster="jp",
            start=now_dt - timedelta(hours=40),
            location="新宿",
        ),
        _geo_event(
            slug="sg-orchard-yday",
            title="烏節路周末封街市集",
            body="示範座標：新加坡烏節路。",
            cluster="sg",
            start=now_dt - timedelta(hours=50),
            location="烏節路",
        ),
        # ── 3–28 days (list 7d / 30d + map scrub) ──
        _geo_event(
            slug="hk-wk-forum",
            title="灣仔論壇三日場次",
            body="示範座標：香港灣仔。落在近一週。",
            cluster="hk",
            start=now_dt - timedelta(days=3, hours=6),
            hours=8,
            location="灣仔會展",
        ),
        _geo_event(
            slug="tw-wk-songshan",
            title="松山文創快閃展覽",
            body="示範座標：台北松山。",
            cluster="tw",
            start=now_dt - timedelta(days=5, hours=2),
            hours=6,
            location="松山文創園區",
        ),
        _geo_event(
            slug="jp-wk-akihabara",
            title="秋葉原新產品路演",
            body="示範座標：東京秋葉原。",
            cluster="jp",
            start=now_dt - timedelta(days=6, hours=4),
            location="秋葉原",
        ),
        _geo_event(
            slug="kr-wk-gangnam",
            title="江南COEX週邊交通管制",
            body="示範座標：首爾江南。",
            cluster="kr",
            start=now_dt - timedelta(days=8),
            location="江南",
        ),
        _geo_event(
            slug="sg-mo-cbd",
            title="CBD 午間疏散演習紀錄",
            body="示範座標：新加坡市區。落在近一個月。",
            cluster="sg",
            start=now_dt - timedelta(days=12, hours=3),
            location="萊佛士坊",
        ),
        _geo_event(
            slug="osaka-mo-namba",
            title="難波車站出口改道公告",
            body="示範座標：大阪難波。",
            cluster="osaka",
            start=now_dt - timedelta(days=16),
            location="難波",
            source_index=6,
        ),
        _geo_event(
            slug="khh-mo-zuoying",
            title="左營高鐵站接駁延誤",
            body="示範座標：高雄左營。",
            cluster="khh",
            start=now_dt - timedelta(days=21, hours=5),
            location="左營",
        ),
        _geo_event(
            slug="tw-mo-taoyuan",
            title="桃園機場捷運尖峰加班",
            body="示範座標：台北盆地外圍（略偏桃園方向的第二群）。",
            cluster="tw",
            start=now_dt - timedelta(days=26),
            location="桃園機場捷運",
        ),
        # ── no coords: list/card still useful; map hasCoords filter drops these ──
        _plain_event(
            slug="online-brief",
            title="線上簡報流傳（無座標）",
            body="location=線上，latitude/longitude 為空。應出現在情報列表，不上地圖。",
            start=now_dt - timedelta(hours=4),
            location="線上",
            source_index=7,
        ),
        _plain_event(
            slug="unlocated-rumour",
            title="來源未標地點的論壇閒聊",
            body="沒有 geocode。列表頁應仍看得到。",
            start=now_dt - timedelta(hours=11),
            location="未標地點",
        ),
        _plain_event(
            slug="na-today",
            title="僅文字摘要的政策討論",
            body="location=N/A，無 lat/lng。",
            start=now_dt - timedelta(hours=1),
            location="N/A",
        ),
        _plain_event(
            slug="untimed-no-geo",
            title="無時間且無座標的發現",
            body="start_time=NULL。情報列表（analyzed_at）可見；日曆格與地圖時間軸不一定收入。",
            start=None,
            location="N/A",
        ),
        _plain_event(
            slug="week-no-geo",
            title="週報整理（無座標）",
            body="近一週的列表列。",
            start=now_dt - timedelta(days=4, hours=8),
            location="",
        ),
        _plain_event(
            slug="month-no-geo",
            title="月報附錄（無座標）",
            body="近一個月的列表列，方便 30d 篩選。",
            start=now_dt - timedelta(days=18),
            location="不詳",
        ),
    ]


async def _insert_topics(
    db: Database,
    *,
    task_id: str,
    batch_id: str,
    now: str,
    rows: list[tuple[int, str, float, str]],
    message_ids: list[str],
    link_first: int,
) -> int:
    count = 0
    for rank, name, score, summary in rows:
        topic_id = f"{IDP}-topic-{task_id.split('-')[-1]}-{rank}"
        await db.execute(
            "INSERT INTO trending_topics (id, task_id, version, batch_id, rank, "
            "topic_name, score, summary, created_at, updated_at) "
            "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)",
            (topic_id, task_id, batch_id, rank, name, score, summary, now, now),
        )
        count += 1
        if rank <= link_first and rank - 1 < len(message_ids):
            await db.execute(
                "INSERT OR IGNORE INTO topic_messages (topic_id, message_id) VALUES (?, ?)",
                (topic_id, message_ids[rank - 1]),
            )
            if rank <= 3 and rank + 3 < len(message_ids):
                await db.execute(
                    "INSERT OR IGNORE INTO topic_messages (topic_id, message_id) VALUES (?, ?)",
                    (topic_id, message_ids[rank + 3]),
                )
    return count


async def seed(db: Database) -> dict[str, int]:
    await _clean(db)
    now = utc_now_iso()
    now_dt = datetime.now(UTC)

    await ensure_llm_profile(
        db,
        profile_id=LLM_PROFILE_ID,
        name=f"{PREFIX} seed profile (unused)",
        model="intel-demo-unused",
        provider="ollama",
    )
    message_ids = await _ensure_source_and_messages(db, now, now_dt)
    await _ensure_tasks(db)

    await ensure_completed_batch(
        db,
        batch_id=INTEL_BATCH_ID,
        task_id=INTEL_TASK_ID,
        message_count=8,
        created_at=now,
        updated_at=now,
        completed_at=now,
    )
    await ensure_completed_batch(
        db,
        batch_id=LB_HOT_BATCH_ID,
        task_id=LB_HOT_TASK_ID,
        message_count=8,
        created_at=now,
        updated_at=now,
        completed_at=now,
    )
    await ensure_completed_batch(
        db,
        batch_id=LB_HEAT_BATCH_ID,
        task_id=LB_HEAT_TASK_ID,
        message_count=6,
        created_at=now,
        updated_at=now,
        completed_at=now,
    )

    geo = 0
    plain = 0
    for spec in _event_specs(now_dt):
        source_index = spec["source_index"]
        source_message_id = message_ids[source_index] if source_index is not None else None
        await insert_analysis_event(
            db,
            event_id=str(spec["id"]),
            task_id=INTEL_TASK_ID,
            batch_id=INTEL_BATCH_ID,
            title=str(spec["title"]),
            body=str(spec["body"]),
            start=spec["start"],
            end=spec["end"],
            location=spec["location"],
            lat=spec["lat"],
            lon=spec["lon"],
            source_message_id=source_message_id,
            channel_names=[f"{PREFIX} 示範頻道"],
        )
        if spec["lat"] is not None:
            geo += 1
        else:
            plain += 1

    hot_topics: list[tuple[int, str, float, str]] = [
        (1, "維港集會傳聞", 96.4, "香港島沿岸討論量急升；官方尚未證實。示範資料。"),
        (2, "信義人流異常", 88.1, "台北信義捷運出口短訊與短影音同步增溫。"),
        (3, "澀谷封路預演", 81.7, "東京交通局夜間演習被當成突發事件轉傳。"),
        (4, "濱海灣改期", 74.2, "新加坡煙火彩排改期 PDF 在票務群組擴散。"),
        (5, "漢江週末市集", 69.5, "首爾漢江公園攤位加倍，標籤刷屏。"),
        (6, "萬博接駁加班", 61.0, "大阪夢洲接駁與地圖標記不一致的客訴。"),
        (7, "高雄港夜間施工", 54.8, "噪音時段詢問集中在在地社團。"),
        (8, "金鐘行人改道", 48.3, "金鐘臨時改道，通勤討論回溫。"),
        (9, "南港進場高峰", 42.6, "展覽進場時段捷運人流預警。"),
        (10, "烏節路封街", 37.1, "週末市集封街時程在旅客群組流傳。"),
    ]
    heat_topics: list[tuple[int, str, float, str]] = [
        (1, "快閃標籤對戰", 91.2, "各地「快閃」標籤互相引用，熱度高於事件本身。"),
        (2, "地圖標記打卡", 79.4, "使用者回報地圖釘與實際出入口不符。"),
        (3, "無來源簡報", 70.8, "一份無作者簡報在論壇置頂，座標欄全空。"),
        (4, "接駁誤點抱怨", 63.5, "跨城接駁延誤的情緒帖多於官方公告。"),
        (5, "夜間噪音時段", 55.9, "港區施工時段詢問形成穩定討論串。"),
        (6, "票務 PDF 真偽", 49.0, "改期公告截圖被質疑是否官方。"),
        (7, "封路演習誤讀", 41.7, "演習文案被截成突發快訊。"),
        (8, "週報整理帖", 33.4, "無座標週報在列表頁仍有閱讀量。"),
    ]
    topics = await _insert_topics(
        db,
        task_id=LB_HOT_TASK_ID,
        batch_id=LB_HOT_BATCH_ID,
        now=now,
        rows=hot_topics,
        message_ids=message_ids,
        link_first=5,
    )
    topics += await _insert_topics(
        db,
        task_id=LB_HEAT_TASK_ID,
        batch_id=LB_HEAT_BATCH_ID,
        now=now,
        rows=heat_topics,
        message_ids=message_ids,
        link_first=4,
    )

    return {
        "analysis_events_with_coords": geo,
        "analysis_events_without_coords": plain,
        "analysis_events": geo + plain,
        "trending_topics": topics,
        "messages": len(message_ids),
        "leaderboard_tasks": 2,
        "intel_tasks": 1,
    }


async def _cli(db: Database, args: Namespace, path: Path) -> None:
    if args.clean:
        await _clean(db)
        print(f"Cleaned prior {PREFIX} fixtures")
    counts = await seed(db)
    print(f"DB: {path}")
    print("Seeded:", json.dumps(counts, ensure_ascii=False, indent=2))
    print()
    print("UI pages:")
    print("  /intelligence  — 地圖（hasCoords）看 HK / TW / JP / SG / KR 等聚類；")
    print("                   預設 Live ±12h 已有座標事件；列表切 7d／30d 看完整窗。")
    print("                   標題 [intel-demo]；無座標列仍在列表／卡片。")
    print("  /leaderboard   — 兩個排行榜任務（熱門話題排行、討論熱度），可點列看關聯訊息。")
    print()
    print("Tasks are is_active=0 so the dummy LLM profile is never scheduled.")
    print("Cleanup: uv run python scripts/seed_intel_map_leaderboard_demo.py --clean")


if __name__ == "__main__":
    run_seed_cli(
        description=__doc__,
        prefix=PREFIX,
        run=_cli,
        utf8=True,
        warn_missing_db=True,
    )
