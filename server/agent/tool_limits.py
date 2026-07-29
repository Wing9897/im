"""Result-size policy for local Agent tools.

Calendar intentionally permits larger pages because window queries are also
used for schedule reconciliation. Message and intelligence searches return
compact evidence for an LLM context and therefore share a lower cap. Keep
schema ``maximum`` values and handler clamps pointed at these constants.
"""

CALENDAR_DEFAULT_LIST_LIMIT = 20
CALENDAR_DEFAULT_WINDOW_LIMIT = 50
CALENDAR_RESULT_HARD_CAP = 100

MESSAGES_DEFAULT_RESULT_LIMIT = 20
MESSAGES_RESULT_HARD_CAP = 50

INTELLIGENCE_DEFAULT_RESULT_LIMIT = 20
INTELLIGENCE_RESULT_HARD_CAP = 50
