"""Action configuration request models."""

from pydantic import BaseModel, ConfigDict


class ActionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    actionType: str
    configuration: str
    triggerConditions: str | None = None
