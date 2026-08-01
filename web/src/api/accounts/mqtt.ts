/** MQTT broker source management. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type { AddMqttBrokerResponse, MqttBrokerInfo, MqttBrokerPatch } from "../../types";

type MqttBrokerBody = components["schemas"]["MqttBrokerBody"];

/** Creates a new MQTT broker source. */
export function createMqttBroker(
  params: MqttBrokerBody,
): Promise<AddMqttBrokerResponse> {
  return apiClient.post<AddMqttBrokerResponse>("/api/v1/accounts/mqtt", params);
}

/** Updates an existing MQTT broker and reconnects. */
export function updateMqttBroker(
  accountId: string,
  params: MqttBrokerPatch,
): Promise<AddMqttBrokerResponse> {
  return apiClient.patch<AddMqttBrokerResponse>(
    `/api/v1/accounts/mqtt/${accountId}`,
    params,
  );
}

/** Fetches all registered MQTT broker sources. */
export function listMqttBrokers(): Promise<MqttBrokerInfo[]> {
  return apiClient.get<MqttBrokerInfo[]>("/api/v1/accounts/mqtt");
}
