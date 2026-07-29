"""Version-aware JOIN fragments for result tables."""


def task_version_join(result_alias: str, result_task_col: str = "task_id") -> str:
    """JOIN clause tying a result row to the task's current version."""
    return f"JOIN analysis_tasks at ON at.id = {result_alias}.{result_task_col} AND {result_alias}.version = at.version"


def version_matched_batch_on(batch_alias: str = "b", task_alias: str = "t") -> str:
    """ON clause matching a batch row to its task's current version (for LEFT JOIN)."""
    return f"{batch_alias}.task_id = {task_alias}.id AND {batch_alias}.version = {task_alias}.version"
