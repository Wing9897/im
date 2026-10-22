"""Version-controlled system / schema prompt texts (not user task templates).

Task ``promptTemplate`` values live in SQLite ``analysis_tasks``.
Assembly stays in ``server.analyzer.prompt``, ``server.agent.runtime``,
and ``server.analyzer.engine``. Import texts from ``analysis`` or ``assistant``.
``clock`` and ``locale`` stay deep imports.
"""
