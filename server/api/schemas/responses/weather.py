"""Weather forecast response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WeatherDailyResponse(BaseModel):
    time: list[str] = Field(default_factory=list)
    weather_code: list[int] = Field(default_factory=list)
    temperature_2m_max: list[float] = Field(default_factory=list)
    temperature_2m_min: list[float] = Field(default_factory=list)


class WeatherForecastResponse(BaseModel):
    daily: WeatherDailyResponse
