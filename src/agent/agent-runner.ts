import { spawn } from "node:child_process";
import type { AgentDefinition, AgentExecutionResult } from "../types/index.js";
import type { Logger } from "../logger/logger.js";

export interface AgentRunOptions {
  agentDef: AgentDefinition;
  prompt: string;
  artifactsDir: string;
  projectDir?: string;
  phase: number;
  turn: number;
  logger: Logger;
  maxTurns?: number;
}

interface ClaudeJsonResult {
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
  session_id?: string;
  cost?: {
    input_tokens?: number;
    output_tokens?: number;
    total_cost_usd?: number;
  };
  duration_ms?: number;
  num_turns?: number;
}

export async function runAgent(
  options: AgentRunOptions,
): Promise<AgentExecutionResult> {
  const {
    agentDef,
    prompt,
    artifactsDir,
    projectDir,
    phase,
    turn,
    logger,
    maxTurns = 30,
  } = options;

  await logger.logProgress(agentDef.name, phase, turn, "에이전트 실행 시작");

  let sessionId = "";
  let resultText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let durationMs = 0;
  let numTurns = 0;
  let success = false;
  let error: string | undefined;

  const systemPrompt = buildSystemPrompt(agentDef, artifactsDir, projectDir);

  await logger.logPrompt(agentDef.name, phase, turn, systemPrompt, prompt);

  try {
    const permissionMode =
      process.env.AGENT_PERMISSION_MODE ?? "bypassPermissions";

    const args = [
      "-p",
      "--output-format", "json",
      "--max-turns", String(maxTurns),
      "--system-prompt", systemPrompt,
      "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch",
      "--permission-mode", permissionMode,
      "--no-session-persistence",
      prompt,
    ];

    if (permissionMode === "bypassPermissions") {
      args.splice(args.indexOf("--permission-mode"), 0, "--dangerously-skip-permissions");
    }

    const startTime = Date.now();
    const stdout = await execClaude(args, artifactsDir, agentDef.name);
    durationMs = Date.now() - startTime;

    const parsed: ClaudeJsonResult = JSON.parse(stdout);

    sessionId = parsed.session_id ?? "";
    inputTokens = parsed.cost?.input_tokens ?? 0;
    outputTokens = parsed.cost?.output_tokens ?? 0;
    durationMs = parsed.duration_ms ?? durationMs;
    numTurns = parsed.num_turns ?? 0;

    // result.content에서 텍스트 추출
    const textBlocks = parsed.result?.content?.filter(
      (b) => b.type === "text",
    );
    resultText = textBlocks?.map((b) => b.text).join("\n") ?? "";
    success = true;

    await logger.logResponse(agentDef.name, phase, turn, resultText);
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
      inputTokens,
      outputTokens,
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
    inputTokens,
    outputTokens,
    durationMs,
    numTurns,
    error,
  };
}

function execClaude(args: string[], cwd: string, agentName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CLAUDECODE: "" }, // 중첩 세션 방지 해제
    });

    const stdoutChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) {
        console.error(`    [${agentName}] ${msg}`);
      }
    });

    child.on("error", (err) => {
      reject(new Error(`claude CLI 실행 불가: ${err.message}`));
    });

    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      if (code !== 0) {
        reject(new Error(`claude CLI 실패 (exit code ${code}): ${stdout.slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function buildSystemPrompt(
  agentDef: AgentDefinition,
  artifactsDir: string,
  projectDir?: string,
): string {
  const lines = [
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
  ];

  if (projectDir) {
    lines.push(
      `## 프로젝트 디렉토리`,
      `코드 파일은 다음 디렉토리에 생성하라: ${projectDir}`,
      `이 경로를 {projectDir}로 참조한다.`,
      ``,
    );
  }

  lines.push(
    `## 작업 지침`,
    agentDef.promptTemplate.replaceAll("{projectDir}", projectDir ?? artifactsDir),
    ``,
    `## 중요 규칙`,
    `- 반드시 Write 도구로 파일을 생성하라. 텍스트 응답만 하지 마라.`,
    `- 파일 경로는 절대 경로를 사용하라.`,
    `- 한국어로 작성하라.`,
  );

  return lines.join("\n");
}
