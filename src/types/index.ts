export type { AgentDefinition, CrossReviewDef } from "./agent.js";
export type { PhaseContext, AgentExecutionResult, LogEntry } from "./engine.js";

export interface OrchestratorDefinition {
  name: string;
  description: string;
  teamComposition: string[];
  phaseAssignment: PhaseAssignment[];
  artifacts: ArtifactDefinition[];
  executionFlow: string;
}

export interface PhaseAssignment {
  phase: number;
  agents: string[];
  executionMode: "solo" | "turn";
}

export interface ArtifactDefinition {
  path: string;
  assignee: string;
  description: string;
}

export interface RunMeta {
  id: string;
  orchestrator: string;
  task: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  agents: string[];
  phases: PhaseStatus[];
  totalCostUsd: number;
  errors: RunError[];
  inputRunId?: string;
}

export interface PhaseStatus {
  phase: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
}

export interface RunError {
  phase: number;
  agent: string;
  message: string;
  timestamp: string;
  retried: boolean;
}
