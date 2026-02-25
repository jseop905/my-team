export interface PhaseContext {
  phaseNumber: number;
  agents: string[];
  mode: "solo" | "turn";
  runDir: string;
  artifactsDir: string;
  reviewsDir: string;
  logsDir: string;
  previousArtifacts: Map<string, string>;
}

export interface AgentExecutionResult {
  agentName: string;
  success: boolean;
  outputPaths?: string[];
  resultText: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  error?: string;
}

export interface LogEntry {
  timestamp: string;
  agent: string;
  phase: number;
  turn: number;
  status: "in_progress" | "completed" | "error";
  message: string;
  artifact?: string;
  costUsd?: number;
  durationMs?: number;
}
