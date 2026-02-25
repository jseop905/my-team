import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentDefinition, AgentExecutionResult } from "../types/index.js";
import type { Logger } from "../logger/logger.js";

export interface AgentRunOptions {
  agentDef: AgentDefinition;
  prompt: string;
  artifactsDir: string;
  phase: number;
  turn: number;
  logger: Logger;
  maxTurns?: number;
}

export async function runAgent(
  options: AgentRunOptions,
): Promise<AgentExecutionResult> {
  const {
    agentDef,
    prompt,
    artifactsDir,
    phase,
    turn,
    logger,
    maxTurns = 30,
  } = options;

  await logger.logProgress(agentDef.name, phase, turn, "에이전트 실행 시작");

  let sessionId = "";
  let resultText = "";
  let costUsd = 0;
  let durationMs = 0;
  let numTurns = 0;
  let success = false;
  let error: string | undefined;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: buildSystemPrompt(agentDef, artifactsDir),
        cwd: artifactsDir,
        allowedTools: [
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "WebSearch",
          "WebFetch",
        ],
        permissionMode: (process.env.AGENT_PERMISSION_MODE ?? "bypassPermissions") as "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
      },
    })) {
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
      }

      if (message.type === "result") {
        costUsd = message.total_cost_usd;
        durationMs = message.duration_ms;
        numTurns = message.num_turns;

        if (message.subtype === "success") {
          resultText = message.result;
          success = true;
        } else {
          error = `${message.subtype}: ${message.errors?.join("; ") ?? "unknown"}`;
          success = false;
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    success = false;
  }

  if (success) {
    await logger.logComplete(
      agentDef.name,
      phase,
      turn,
      "실행 완료",
      agentDef.outputFiles.join(", "),
      costUsd,
      durationMs,
    );
  } else {
    await logger.logError(
      agentDef.name,
      phase,
      turn,
      `실행 실패: ${error}`,
    );
  }

  return {
    agentName: agentDef.name,
    success,
    outputPaths: agentDef.outputFiles,
    resultText,
    sessionId,
    costUsd,
    durationMs,
    numTurns,
    error,
  };
}

function buildSystemPrompt(
  agentDef: AgentDefinition,
  artifactsDir: string,
): string {
  return [
    `너는 "${agentDef.name}" 에이전트이다.`,
    ``,
    `## 역할`,
    agentDef.role,
    ``,
    `## 출력 규격`,
    ...agentDef.outputFiles.map(
      (f) => `결과를 반드시 다음 파일에 작성하라: ${artifactsDir}/${f.replace("artifacts/", "")}`,
    ),
    `Write 도구를 사용하여 위 절대 경로에 파일을 생성하라.`,
    agentDef.outputSpec,
    ``,
    `## 작업 지침`,
    agentDef.promptTemplate,
    ``,
    `## 중요 규칙`,
    `- 반드시 Write 도구로 파일을 생성하라. 텍스트 응답만 하지 마라.`,
    `- 파일 경로는 절대 경로를 사용하라.`,
    `- 한국어로 작성하라.`,
  ].join("\n");
}
