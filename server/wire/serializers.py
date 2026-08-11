"""Stable public facade for snake_case DB row → camelCase wire serializers.

Implementations are grouped by domain under ``serializer_domains``; callers
continue importing from this module so route/service boundaries stay stable.
"""

from server.wire.serializer_domains.calendar import (
    serialize_analysis_event,
    serialize_trending_topic,
    serialize_user_event,
)
from server.wire.serializer_domains.items import (
    serialize_item,
    serialize_item_category,
)
from server.wire.serializer_domains.operations import (
    serialize_action,
    serialize_action_trigger_history,
    serialize_activity_span,
    serialize_agent_tick_in_flight,
    serialize_agent_tick_log_entry,
    serialize_app_log,
    serialize_batch_tool_calls,
    serialize_queue_batch,
)
from server.wire.serializer_domains.sources import (
    channel_key,
    serialize_channel,
    serialize_channel_ref,
    serialize_message,
    serialize_source,
)
from server.wire.serializer_domains.recurring import serialize_recurring_series
from server.wire.serializer_domains.tasks import (
    serialize_task,
    serialize_task_for_agent,
    serialize_task_schedule,
    serialize_workset,
)

__all__ = [
    "channel_key",
    "serialize_action",
    "serialize_action_trigger_history",
    "serialize_activity_span",
    "serialize_analysis_event",
    "serialize_app_log",
    "serialize_batch_tool_calls",
    "serialize_channel",
    "serialize_channel_ref",
    "serialize_item",
    "serialize_item_category",
    "serialize_message",
    "serialize_agent_tick_in_flight",
    "serialize_agent_tick_log_entry",
    "serialize_queue_batch",
    "serialize_recurring_series",
    "serialize_source",
    "serialize_task",
    "serialize_task_for_agent",
    "serialize_task_schedule",
    "serialize_trending_topic",
    "serialize_user_event",
    "serialize_workset",
]
