"""Action configuration request models."""

from pydantic import BaseModel, ConfigDict

from server.domain.action_types import ActionTypeWire


class ActionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    actionType: ActionTypeWire
    configuration: str
    triggerConditions: str | None = None
