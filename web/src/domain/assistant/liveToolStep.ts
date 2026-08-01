import type { AgentToolCallSummary } from "../../api/agent";

/** In-progress / completed tool step shown while the agent loop runs. */
export type LiveToolStep = AgentToolCallSummary & {
  status: "running" | "done";
};
