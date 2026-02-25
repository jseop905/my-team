import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseOrchestratorFile } from "./parsers/orchestrator-parser.js";
import { parseAgentFile } from "./parsers/agent-parser.js";
import { PhaseExecutor } from "./engine/phase-executor.js";
import { RunManager } from "./run/run-manager.js";
import { Logger } from "./logger/logger.js";
import type { AgentDefinition } from "./types/index.js";
import { extractSection } from "./parsers/md-utils.js";

async function main() {
  const args = process.argv.slice(2);
  const orchestratorName = args[0];
  const taskName = args[1];
  const inputRunFlag = args.indexOf("--input-run");
  const inputRunId =
    inputRunFlag !== -1 ? args[inputRunFlag + 1] : undefined;

  if (!orchestratorName || !taskName) {
    console.error(
      "사용법: npm run orchestrate -- <orchestrator> <task> [--input-run <run-id>]",
    );
    process.exit(1);
  }

  const baseDir = resolve(".");

  // 오케스트레이터 파싱
  const orchFile = join(baseDir, "orchestrators", `${orchestratorName}.md`);
  const orchDef = await parseOrchestratorFile(orchFile);
  console.log(`오케스트레이터: ${orchDef.name}`);

  // 에이전트 파싱
  const agentDefs = new Map<string, AgentDefinition>();
  for (const agentName of orchDef.teamComposition) {
    const agentFile = join(baseDir, "agents", `${agentName}.md`);
    const agentDef = await parseAgentFile(agentFile);
    agentDefs.set(agentName, agentDef);
  }
  console.log(`에이전트: ${[...agentDefs.keys()].join(", ")}`);

  // 태스크 파싱
  const taskFile = join(baseDir, "tasks", `${taskName}.md`);
  const taskContent = await readFile(taskFile, "utf-8");
  const projectDirection = extractSection(taskContent, "프로젝트 방향");
  if (!projectDirection) {
    console.error(`태스크 "${taskName}"에 "## 프로젝트 방향" 섹션이 없습니다.`);
    process.exit(1);
  }

  // Run 생성
  const runManager = new RunManager(join(baseDir, "runs"));
  const phaseNumbers = orchDef.phaseAssignment.map((p) => p.phase);
  const { runDir, runMeta } = await runManager.createRun(
    orchestratorName,
    taskName,
    [...agentDefs.keys()],
    phaseNumbers,
    inputRunId,
  );
  console.log(`\nRun: ${runMeta.id}`);
  console.log(`출력: ${runDir}\n`);

  // Logger 초기화
  const logger = new Logger(join(runDir, "logs"));
  await logger.init();

  // Phase 순차 실행
  const phaseExecutor = new PhaseExecutor(
    runManager,
    logger,
    agentDefs,
    runDir,
    runMeta,
    projectDirection,
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let hasFailed = false;

  for (const assignment of orchDef.phaseAssignment) {
    console.log(
      `\n${"=".repeat(50)}\nPhase ${assignment.phase}: ${assignment.agents.join(", ")} (${assignment.executionMode})\n${"=".repeat(50)}`,
    );

    try {
      const results = await phaseExecutor.executePhase(assignment);
      for (const r of results) {
        totalInputTokens += r.inputTokens;
        totalOutputTokens += r.outputTokens;
        if (!r.success) hasFailed = true;
      }
    } catch (err) {
      console.error(`Phase ${assignment.phase} 실행 실패:`, err);
      hasFailed = true;
      break;
    }
  }

  // Run 완료
  await runManager.finalizeRun(runDir, runMeta, totalInputTokens, totalOutputTokens, hasFailed);

  const totalTokens = totalInputTokens + totalOutputTokens;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`상태: ${hasFailed ? "FAILED" : "COMPLETED"}`);
  console.log(`총 토큰: ${totalTokens.toLocaleString()} [입력: ${totalInputTokens.toLocaleString()}, 출력: ${totalOutputTokens.toLocaleString()}]`);
  console.log(`산출물: ${join(runDir, "artifacts")}`);
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
