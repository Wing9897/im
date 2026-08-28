"""Stable public facade for snake_case DB row → camelCase wire serializers.

Implementations are grouped by domain under ``serializer_domains``; callers
continue importing from this module so route/service boundaries stay stable.
"""

from server.wire.serializer_domains.calendar import (
    serialize_analysis_event,
    serialize_dismissal,
    serialize_importance,
    serialize_trending_topic,
    serialize_user_event,
)
from server.wire.serializer_domains.calendar_share import (
    serialize_calendar_share_event,
    serialize_catalog_wire_fields,
)
from server.wire.serializer_domains.items import (
    serialize_item,
    serialize_item_category,
)
from server.wire.serializer_domains.llm_profiles import (
    serialize_llm_profile,
    serialize_llm_staff_instance,
)
from server.wire.serializer_domains.operations import (
    parse_tool_call_entries,
    serialize_action,
    serialize_action_trigger_history,
    serialize_activity_span,
    serialize_agent_tick_in_flight,
    serialize_agent_tick_log_entry,
    serialize_app_log,
    serialize_batch_tool_calls,
    serialize_queue_batch,
)
from server.wire.serializer_domains.recurring import serialize_recurring_series
from server.wire.serializer_domains.sources import (
    channel_key,
    serialize_channel,
    serialize_channel_ref,
    serialize_message,
    serialize_source,
)
from server.wire.serializer_domains.tasks import serialize_task
from server.wire.serializer_domains.worksets import serialize_workset

__all__ = [
    "channel_key",
    "parse_tool_call_entries",
    "serialize_action",
    "serialize_action_trigger_history",
    "serialize_activity_span",
    "serialize_analysis_event",
    "serialize_app_log",
    "serialize_batch_tool_calls",
    "serialize_calendar_share_event",
    "serialize_catalog_wire_fields",
    "serialize_channel",
    "serialize_channel_ref",
    "serialize_dismissal",
    "serialize_importance",
    "serialize_item",
    "serialize_item_category",
    "serialize_llm_profile",
    "serialize_llm_staff_instance",
    "serialize_message",
    "serialize_agent_tick_in_flight",
    "serialize_agent_tick_log_entry",
    "serialize_queue_batch",
    "serialize_recurring_series",
    "serialize_source",
    "serialize_task",
    "serialize_trending_topic",
    "serialize_user_event",
    "serialize_workset",
]
