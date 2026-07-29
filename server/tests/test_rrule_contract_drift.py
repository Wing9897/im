"""Static cross-layer guard for the RRULE and analysis-schedule contract."""

from __future__ import annotations

import ast
import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SUPPORTED_SCHEDULES = frozenset({"seconds_10", "hourly", "daily", "weekly", "custom_seconds"})

_CHECKED_CONTRACT_PATHS = (
    "server/api/routes/tasks.py",
    "server/scheduler/manager.py",
    "server/calendar/rrule.py",
    "web/src/types/tasks.ts",
    "web/src/pages/tasks/chat-editor/ChatCalendarFields.tsx",
    "README.md",
    "docs/ARCHITECTURE.md",
)

_AFFIRMATIVE_RRULE_ANALYSIS_CLAIMS = (
    re.compile(
        r"\bRRULE\b\s+(?:(?:can|will)\s+(?:be\s+used\s+to\s+)?|is\s+used\s+to\s+|supports?\s+|drives?\s+)?"
        r"(?:schedul\w*|trigger\w*|execut\w*|run\w*)\s+(?:\w+\s+){0,6}(?:AI|LLM|analysis)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:AI|LLM)\s+analysis\b\s+(?:is\s+)?(?:schedul\w*|trigger\w*|execut\w*|run\w*)"
        r"\s+(?:by|with|using|via)\s+(?:an?\s+)?RRULE\b",
        re.IGNORECASE,
    ),
    # Guard the former architecture wording: "each analysis task has its own
    # schedule (... or iCal RRULE)".
    re.compile(
        r"\b(?:AI|LLM|analysis)\s+tasks?\b[^\n.]{0,60}\b(?:has|have|uses?|supports?)\b"
        r"[^\n.]{0,60}\b(?:schedule|trigger|timer)\b[^\n.]{0,120}\bRRULE\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bRRULE\b\s+is\s+(?:an?\s+)?(?:AI|LLM|analysis)[^\n.]{0,30}\b(?:schedule|trigger)\b", re.IGNORECASE),
    re.compile(r"\bRRULE[- ]based\b[^\n.]{0,80}\b(?:AI|LLM|analysis)\b", re.IGNORECASE),
    re.compile(
        r"RRULE[^\n。！？]{0,80}(?:可|(?<!不)會|用來|用以|(?<!僅)用於|負責|支援)"
        r"[^\n。！？]{0,20}(?:排程|觸發|執行)[^\n。！？]{0,40}(?:AI|LLM|分析)"
    ),
    # Guard the former README wording: "排程 AI 分析 — 支援 RRULE 任務".
    re.compile(
        r"(?:排程|觸發|執行)[^\n。！？]{0,20}(?:AI|LLM)[^\n。！？]{0,10}分析"
        r"[^\n。！？]{0,80}(?:支援|使用|透過|包含)[^\n。！？]{0,40}RRULE",
        re.IGNORECASE,
    ),
)


def _read(relative_path: str) -> str:
    return (_REPO_ROOT / relative_path).read_text(encoding="utf-8")


def _location(path: Path, text: str, offset: int) -> str:
    try:
        display_path = path.relative_to(_REPO_ROOT).as_posix()
    except ValueError:
        display_path = path.as_posix()
    return f"{display_path}:{text.count(chr(10), 0, offset) + 1}"


def _find_rrule_analysis_conflicts(paths: tuple[Path, ...]) -> list[str]:
    conflicts: list[str] = []
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for pattern in _AFFIRMATIVE_RRULE_ANALYSIS_CLAIMS:
            for match in pattern.finditer(text):
                excerpt = " ".join(match.group(0).split())
                conflicts.append(f"{_location(path, text, match.start())}: {excerpt}")
    return sorted(set(conflicts))


_CALENDAR_ONLY_REQUIREMENTS = {
    "server/api/routes/task_helpers.py": (
        r"Recurring-only recurrence expanded at query time",
        r"never an AI analysis trigger",
    ),
    "server/scheduler/manager.py": (
        r"RRULE and event metadata are recurring-only",
        r"intentionally are not inputs",
    ),
    "server/calendar/rrule.py": (
        r"Recurring-only RRULE validation and query-time occurrence expansion",
        r"Recurring tasks never run the LLM and never create analysis scheduler jobs",
    ),
    "web/src/types/tasks.ts": (
        r"Recurring-only recurrence expanded at query time",
        r"never an AI analysis trigger",
    ),
    "web/src/pages/tasks/chat-editor/ChatCalendarFields.tsx": (r"tasks\.editor\.rruleHint",),
    "web/src/i18n/locales/zh-Hant/common.json": (
        r"RRULE 僅用於循環任務重複事件",
        r"不會觸發 AI 分析",
    ),
    "README.md": (
        r"循環任務",
        r"RRULE 僅於查詢時展開",
        r"不會觸發 AI 分析",
    ),
    "docs/ARCHITECTURE.md": (
        r"Recurring tasks do not create scheduler jobs or run LLM analysis",
        r"RRULE never triggers AI analysis",
    ),
}


def _python_string_collection(relative_path: str, variable_name: str) -> set[str]:
    tree = ast.parse(_read(relative_path), filename=relative_path)
    for node in tree.body:
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        if any(isinstance(target, ast.Name) and target.id == variable_name for target in targets):
            if node.value is None:
                continue
            value = ast.literal_eval(node.value)
            return {str(item) for item in value}
    raise AssertionError(f"{relative_path}: missing {variable_name}")


def _scheduler_schedule_types() -> set[str]:
    relative_path = "server/scheduler/manager.py"
    tree = ast.parse(_read(relative_path), filename=relative_path)
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "schedule_trigger")
    return {
        str(node.comparators[0].value)
        for node in ast.walk(function)
        if isinstance(node, ast.Compare)
        and isinstance(node.left, ast.Name)
        and node.left.id == "schedule_type"
        and len(node.ops) == 1
        and isinstance(node.ops[0], ast.Eq)
        and len(node.comparators) == 1
        and isinstance(node.comparators[0], ast.Constant)
        and isinstance(node.comparators[0].value, str)
    }


def _frontend_schedule_type_union() -> set[str]:
    relative_path = "web/src/types/taskFormFields.ts"
    match = re.search(r"export type ScheduleType\s*=\s*(?P<body>[^;]+);", _read(relative_path))
    assert match is not None, f"{relative_path}: missing ScheduleType union"
    return set(re.findall(r"[\"\']([a-z0-9_]+)[\"\']", match.group("body")))


def _frontend_schedule_types() -> set[str]:
    """UI schedule options after i18n: typed list, labels via ``tasks.schedule.types.*``."""
    relative_path = "web/src/pages/tasks/ScheduleInput.tsx"
    match = re.search(
        r"const SCHEDULE_TYPES:\s*ScheduleType\[\]\s*=\s*\[(?P<body>.*?)\]",
        _read(relative_path),
        re.DOTALL,
    )
    assert match is not None, f"{relative_path}: missing SCHEDULE_TYPES"
    return set(re.findall(r"[\"\']([a-z0-9_]+)[\"\']", match.group("body")))


def _architecture_schedule_types() -> set[str]:
    relative_path = "docs/ARCHITECTURE.md"
    match = re.search(r"each non-recurring analysis task uses one of (?P<values>[^\n]+)", _read(relative_path))
    assert match is not None, f"{relative_path}: missing Supported Schedule declaration"
    return set(re.findall(r"`([a-z0-9_]+)`", match.group("values")))


def test_rrule_analysis_capability_claims_do_not_drift() -> None:
    paths = tuple(_REPO_ROOT / relative_path for relative_path in _CHECKED_CONTRACT_PATHS)
    conflicts = _find_rrule_analysis_conflicts(paths)

    assert not conflicts, "Conflicting RRULE analysis-scheduling claims:\n" + "\n".join(conflicts)


def test_rrule_calendar_only_wording_is_present_across_layers() -> None:
    missing: list[str] = []
    for relative_path, required_patterns in _CALENDAR_ONLY_REQUIREMENTS.items():
        text = _read(relative_path)
        for pattern in required_patterns:
            if re.search(pattern, text, re.IGNORECASE | re.DOTALL) is None:
                missing.append(f"{relative_path}: missing recurring-only contract /{pattern}/")

    assert not missing, "RRULE recurring-only wording drift:\n" + "\n".join(missing)


def test_supported_schedule_vocabulary_is_consistent_across_layers() -> None:
    actual_by_location = {
        "server/api/routes/task_helpers.py:ALLOWED_SCHEDULE_TYPES": _python_string_collection(
            "server/api/routes/task_helpers.py", "ALLOWED_SCHEDULE_TYPES"
        ),
        "server/scheduler/manager.py:schedule_trigger": _scheduler_schedule_types(),
        "web/src/types/taskFormFields.ts:ScheduleType": _frontend_schedule_type_union(),
        "web/src/pages/tasks/ScheduleInput.tsx:SCHEDULE_TYPES": _frontend_schedule_types(),
        "docs/ARCHITECTURE.md:Scheduler": _architecture_schedule_types(),
    }
    drift = [
        f"{location}: expected {sorted(_SUPPORTED_SCHEDULES)}, found {sorted(actual)}"
        for location, actual in actual_by_location.items()
        if actual != _SUPPORTED_SCHEDULES
    ]

    readme = _read("README.md")
    readme_terms = ("10 秒", "每小時", "每日", "每週", "自訂秒數")
    missing_readme_terms = [term for term in readme_terms if term not in readme]
    if missing_readme_terms:
        drift.append(f"README.md: missing Supported Schedule wording {missing_readme_terms}")

    assert not drift, "Supported Schedule vocabulary drift:\n" + "\n".join(drift)


def test_rrule_conflict_report_detects_known_claims_and_names_file_and_line(tmp_path: Path) -> None:
    conflicting = tmp_path / "technical-contract.md"
    known_conflicting_claims = (
        "RRULE schedules AI analysis.",
        "Each analysis task has its own schedule (seconds, hourly, or iCal RRULE).",
        "排程 AI 分析 — 支援 RRULE 任務。",
    )

    for claim in known_conflicting_claims:
        conflicting.write_text(f"safe heading\n{claim}\n", encoding="utf-8")

        conflicts = _find_rrule_analysis_conflicts((conflicting,))

        assert conflicts, f"detector missed known conflicting claim: {claim}"
        expected_location = f"{conflicting.as_posix()}:2:"
        assert all(conflict.startswith(expected_location) for conflict in conflicts), conflicts
