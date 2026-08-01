import { useCallback, useEffect, useState } from "react";
import type {
  Action,
  ActionType,
} from "../../../types";
import {
  applyActionTypeSwitch,
  formStateFromAction,
  nextHeaderId,
} from "../useActionTypeHandlers";
import { useActionFormSubmit } from "./useActionFormSubmit";

// ── Header entry for HTTP Webhook ─────────────────────

export interface HeaderEntry {
  id: string;
  key: string;
  value: string;
}

// ── Form State ────────────────────────────────────────

export interface ActionFormState {
  // Common fields
  name: string;
  actionType: ActionType | null;
  scoreThreshold: string;
  taskId: string;

  // Telegram-specific
  botToken: string;
  chatId: string;

  // Discord-specific
  discordWebhookUrl: string;

  // HTTP Webhook-specific
  httpUrl: string;
  httpMethod: "POST" | "PUT";
  httpHeaders: HeaderEntry[];
  httpIncludeRawData: boolean;

  // MQTT-specific
  mqttBrokerUrl: string;
  mqttTopic: string;
  mqttUsername: string;
  mqttPassword: string;
  mqttQos: 0 | 1 | 2;
}

export const emptyFormState: ActionFormState = {
  name: "",
  actionType: null,
  scoreThreshold: "",
  taskId: "",

  botToken: "",
  chatId: "",

  discordWebhookUrl: "",

  httpUrl: "",
  httpMethod: "POST",
  httpHeaders: [{ id: nextHeaderId(), key: "", value: "" }],
  httpIncludeRawData: false,

  mqttBrokerUrl: "",
  mqttTopic: "",
  mqttUsername: "",
  mqttPassword: "",
  mqttQos: 0,
};

export function useActionFormDialog({
  open,
  editAction,
  onClose,
  onSaved,
}: {
  open: boolean;
  editAction: Action | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ActionFormState>(emptyFormState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { submitting, error, handleSubmit, clearError } = useActionFormSubmit({
    form,
    editAction,
    onClose,
    onSaved,
    setFieldErrors,
  });

  useEffect(() => {
    if (open) {
      setForm(editAction ? formStateFromAction(editAction, emptyFormState) : emptyFormState);
      setFieldErrors({});
      clearError();
    }
  }, [open, editAction, clearError]);

  const handleChange = useCallback(
    (field: keyof ActionFormState, value: string | boolean | number | HeaderEntry[]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear the specific field error when user edits it
      setFieldErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      clearError();
    },
    [clearError],
  );

  const handleChannelChange = useCallback(
    (newType: ActionType) => {
      setForm((prev) => applyActionTypeSwitch(prev, newType));
      setFieldErrors({});
      clearError();
    },
    [clearError],
  );

  return {
    form,
    fieldErrors,
    submitting,
    error,
    handleChange,
    handleChannelChange,
    handleSubmit,
  };
}
