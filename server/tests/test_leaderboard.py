"""Leaderboard: merge ranking, Top-10 cap, prompt context, topic_messages replace."""

from __future__ import annotations

import json

import pytest

from server.analyzer.leaderboard import load_leaderboard_context, merge_leaderboard
from server.analyzer.prompt import (
    build_analysis_prompt,
    build_json_instruction,
    build_leaderboard_context_block,
)
from server.scheduler.result_store import store_results
from server.tests import seed
from server.util import new_id, utc_now_iso

# --- pure merge (score rank) -------------------------------------------------


def test_merge_ranks_by_score_not_ai_rank():
    existing = [{"topic": f"t{i}", "score": 0.9 - i * 0.05, "summary": None} for i in range(10)]
    updates = [{"topic": "D", "score": 0.95, "summary": "d", "rank": 99}]

    result = merge_leaderboard(existing, updates)

    assert len(result) == 10
    assert result[0]["topic"] == "D"
    assert result[0]["rank"] == 1
    assert result[0]["score"] == 0.95
    assert "t9" not in {entry["topic"] for entry in result}


def test_merge_updates_existing_topic_score():
    existing = [
        {"topic": "A", "score": 0.9, "summary": "old"},
        {"topic": "B", "score": 0.5, "summary": "b"},
    ]
    updates = [{"topic": "A", "score": 0.2, "summary": "new"}]

    result = merge_leaderboard(existing, updates)

    assert [entry["topic"] for entry in result] == ["B", "A"]
    assert result[1]["summary"] == "new"


def test_merge_keeps_unmentioned_existing_topics():
    existing = [
        {"topic": "A", "score": 0.9, "summary": "a"},
        {"topic": "B", "score": 0.8, "summary": "b"},
    ]
    updates = [{"topic": "C", "score": 0.85, "summary": "c"}]

    result = merge_leaderboard(existing, updates)

    assert {entry["topic"] for entry in result} == {"A", "B", "C"}


def test_merge_caps_at_ten():
    existing = [{"topic": f"t{i}", "score": 1 - i * 0.01, "summary": None} for i in range(10)]
    updates = [{"topic": "new", "score": 0.5, "summary": None}]

    result = merge_leaderboard(existing, updates)

    assert len(result) == 10
    assert "new" not in {entry["topic"] for entry in result}


# --- DB Top-10 cap -----------------------------------------------------------


@pytest.fixture
async def db(app):
    return app.state.db


async def _insert_leaderboard_task(db, *, task_id: str, batch_id: str) -> dict:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_type, "
        "schedule_value, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, 'leaderboard', '24h', 1, 1, 'seconds_10', '10', ?, ?)",
        (task_id, "Cap Test", "desc", "分析", now, now),
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, created_at, updated_at, completed_at) "
        "VALUES (?, ?, 1, 'completed', 0, 0, NULL, ?, ?, ?)",
        (batch_id, task_id, now, now, now),
    )
    row = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))
    assert row is not None
    return dict(row)


async def test_load_leaderboard_context_returns_only_ranked_top10(db):
    task_id = new_id()
    batch_id = new_id()
    task = await _insert_leaderboard_task(db, task_id=task_id, batch_id=batch_id)
    now = utc_now_iso()

    for rank in range(1, 13):
        await db.execute(
            "INSERT INTO trending_topics "
            "(id, task_id, version, batch_id, rank, topic_name, score, summary, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                new_id(),
                task_id,
                1,
                batch_id,
                rank if rank <= 10 else None,
                f"topic-{rank}",
                1.0 - rank * 0.01,
                "s",
                now,
                now,
            ),
        )

    context = await load_leaderboard_context(db, task)
    assert len(context) == 10
    assert context[0]["topic"] == "topic-1"
    assert "rank" not in context[0]
    assert "score" in context[0]


async def test_store_prunes_off_board_topics(db):
    task_id = new_id()
    seed_batch_id = new_id()
    update_batch_id = new_id()
    task = await _insert_leaderboard_task(db, task_id=task_id, batch_id=seed_batch_id)
    now = utc_now_iso()

    for index in range(12):
        await db.execute(
            "INSERT INTO trending_topics "
            "(id, task_id, version, batch_id, rank, topic_name, score, summary, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                new_id(),
                task_id,
                1,
                seed_batch_id,
                index + 1 if index < 10 else None,
                f"legacy-{index}",
                0.5,
                "old",
                now,
                now,
            ),
        )

    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, created_at, updated_at, completed_at) "
        "VALUES (?, ?, 1, 'completed', 0, 0, NULL, ?, ?, ?)",
        (update_batch_id, task_id, now, now, now),
    )

    async with db.transaction() as conn:
        await store_results(
            conn,
            task=task,
            batch_id=update_batch_id,
            items=[{"topic": "new-hot", "score": 0.99, "summary": "fresh"}],
            channel_names=[],
        )

    rows = await db.fetch_all(
        "SELECT topic_name, rank FROM trending_topics WHERE task_id = ? AND version = 1 ORDER BY rank ASC",
        (task_id,),
    )
    names = {row["topic_name"] for row in rows}
    assert len(rows) == 10
    assert "new-hot" in names
    assert all(row["rank"] is not None for row in rows)
    assert "legacy-10" not in names
    assert "legacy-11" not in names


async def test_store_keeps_only_top10_when_board_full(db):
    """11th topic from a new batch displaces the lowest scorer on a full board."""
    task_id = new_id()
    batch_id = new_id()
    task = await _insert_leaderboard_task(db, task_id=task_id, batch_id=batch_id)
    now = utc_now_iso()

    for index in range(10):
        await db.execute(
            "INSERT INTO trending_topics "
            "(id, task_id, version, batch_id, rank, topic_name, score, summary, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                new_id(),
                task_id,
                1,
                batch_id,
                index + 1,
                f"hold-{index}",
                0.9 - index * 0.05,
                "hold",
                now,
                now,
            ),
        )

    update_batch = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, created_at, updated_at, completed_at) "
        "VALUES (?, ?, 1, 'completed', 0, 0, NULL, ?, ?, ?)",
        (update_batch, task_id, now, now, now),
    )

    async with db.transaction() as conn:
        await store_results(
            conn,
            task=task,
            batch_id=update_batch,
            items=[{"topic": "hot-new", "score": 0.99, "summary": "winner"}],
            channel_names=[],
        )

    rows = await db.fetch_all(
        "SELECT topic_name FROM trending_topics WHERE task_id = ? ORDER BY rank ASC",
        (task_id,),
    )
    assert len(rows) == 10
    names = [row["topic_name"] for row in rows]
    assert "hot-new" in names
    assert "hold-9" not in names


# --- prompt / context --------------------------------------------------------


def test_leaderboard_json_instruction_omits_rank():
    instruction = build_json_instruction("leaderboard")
    assert "不要輸出 rank" in instruction
    assert '"rank"' not in instruction or "不要輸出 rank" in instruction


def test_leaderboard_context_block_has_no_rank_keys():
    rows = [
        {"topic": "A", "score": 0.9, "summary": "alpha"},
        {"topic": "B", "score": 0.5, "summary": None},
    ]
    block = build_leaderboard_context_block(rows)
    assert "無需 rank" in block
    payload = block.split("：\n", 1)[-1].strip()
    parsed = json.loads(payload)
    assert len(parsed) == 2
    assert "rank" not in parsed[0]
    assert parsed[0]["topic"] == "A"


def test_analysis_strategy_mode_changes_system_prompt():
    prompt = build_analysis_prompt(
        prompt_template="Analyze",
        analysis_mode="event",
        primary_messages=[{"id": "m1", "content": "evidence"}],
        max_tokens=1000,
        strategy_mode="conservative",
    )
    assert "Analysis strategy: conservative" in prompt.system_prompt
    assert "禁止推測" in prompt.system_prompt


@pytest.mark.asyncio
async def test_load_leaderboard_context_excludes_rank(app):
    db = app.state.db
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (seed.TASK_LEADERBOARD,))
    assert task is not None
    context = await load_leaderboard_context(db, dict(task))
    assert len(context) >= 1
    for row in context:
        assert "rank" not in row
        assert "topic" in row
        assert "score" in row


# --- topic_messages replace --------------------------------------------------


async def test_topic_messages_replace_on_related_update(db):
    """New related_message_ids replace prior links for the same topic."""
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (seed.TASK_LEADERBOARD,))
    assert task is not None
    task = dict(task)
    batch_id = seed.BATCH_LEADERBOARD

    async with db.transaction() as conn:
        await store_results(
            conn,
            task=task,
            batch_id=batch_id,
            items=[
                {
                    "topic": "地震討論",
                    "score": 0.9,
                    "summary": "first",
                    "related_message_ids": ["msg-1"],
                }
            ],
            channel_names=[],
        )

    links_after_first = await _message_ids_for_topic(db, "地震討論")
    assert links_after_first == {"msg-1"}

    second_batch_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, created_at, updated_at, completed_at) VALUES (?, ?, 1, 'completed', 1, 0, ?, ?, ?)",
        (second_batch_id, seed.TASK_LEADERBOARD, now, now, now),
    )

    async with db.transaction() as conn:
        await store_results(
            conn,
            task=task,
            batch_id=second_batch_id,
            items=[
                {
                    "topic": "地震討論",
                    "score": 0.95,
                    "summary": "second",
                    "related_message_ids": ["msg-2"],
                }
            ],
            channel_names=[],
        )

    links_after_second = await _message_ids_for_topic(db, "地震討論")
    assert links_after_second == {"msg-2"}


async def _message_ids_for_topic(db, topic_name: str) -> set[str]:
    rows = await db.fetch_all(
        "SELECT tm.message_id FROM topic_messages tm "
        "JOIN trending_topics tt ON tt.id = tm.topic_id "
        "WHERE tt.topic_name = ?",
        (topic_name,),
    )
    return {str(row["message_id"]) for row in rows}
