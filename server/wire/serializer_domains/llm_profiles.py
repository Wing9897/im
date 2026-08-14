"""Wire serializers for LLM profiles and staff instances."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from server.secrets import MASKED_SECRET, unprotect_text


def serialize_llm_staff_instance(row: Mapping[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": row["id"],
        "staffClass": row.get("staff_class") or "",
        "profileId": row.get("profile_id") or "",
        "displayName": row.get("display_name"),
        "isActive": bool(row.get("is_active", 1)),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
    if "profile_name" in row:
        payload["profileName"] = row.get("profile_name") or ""
    if "profile_provider" in row:
        payload["profileProvider"] = row.get("profile_provider") or ""
    if "profile_model" in row:
        payload["profileModel"] = row.get("profile_model") or ""
    return payload


def serialize_llm_profile(
    row: Mapping[str, Any],
    staff_rows: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    api_key = unprotect_text(row.get("api_key") or "")
    brave_key = unprotect_text(row.get("brave_search_api_key") or "")
    staff = [serialize_llm_staff_instance(s) for s in (staff_rows or ())]
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "provider": row.get("provider") or "ollama",
        "baseUrl": row.get("base_url") or "",
        "model": row.get("model") or "",
        "apiKey": MASKED_SECRET if api_key else "",
        "thinkingEnabled": bool(int(row.get("thinking_enabled") or 0)),
        "jsonMode": row.get("json_mode") or "disabled",
        "webSearchEnabled": bool(int(row.get("web_search_enabled") or 0)),
        "webSearchProvider": row.get("web_search_provider") or "auto",
        "braveSearchApiKey": MASKED_SECRET if brave_key else "",
        "staffClasses": sorted({str(s.get("staff_class") or "") for s in (staff_rows or ()) if s.get("staff_class")}),
        "staffInstances": staff,
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
