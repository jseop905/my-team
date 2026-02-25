import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentDefinition,
  AgentExecutionResult,
  PhaseAssignment,
  PhaseContext,
  RunMeta,
} from "../types/index.js";
import type { Logger } from "../logger/logger.js";
import { RunManager } from "../run/run-manager.js";
import { executeTurns } from "./turn-executor.js";
import { executeWithRetry, type RetryResult } from "./retry.js";

export class PhaseExecutor {
  constructor(
    private runManager: RunManager,
    private logger: Logger,
    private agentDefs: Map<string, AgentDefinition>,
    private runDir: string,
    private runMeta: RunMeta,
    private projectDirection: string,
  ) {}

  async executePhase(
    assignment: PhaseAssignment,
  ): Promise<AgentExecutionResult[]> {
    const { phase, agents, executionMode } = assignment;

    // Phase 상태 → "running"
    await this.runManager.updatePhase(this.runDir, this.runMeta, phase, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    // 이전 Phase 산출물 수집
    const previousArtifacts = await this.collectPreviousArtifacts();

    const ctx: PhaseContext = {
      phaseNumber: phase,
      agents,
      mode: executionMode,
      runDir: this.runDir,
      artifactsDir: join(this.runDir, "artifacts"),
      reviewsDir: join(this.runDir, "reviews"),
      logsDir: join(this.runDir, "logs"),
      projectDir: join(this.runDir, "project"),
      previousArtifacts,
    };

    let retryResults: RetryResult[];

    try {
      if (executionMode === "solo") {
        retryResults = await this.executeSolo(ctx);
      } else {
        retryResults = await executeTurns(
          ctx,
          this.agentDefs,
          this.logger,
          this.projectDirection,
        );
      }
    } catch (err) {
      await this.runManager.updatePhase(this.runDir, this.runMeta, phase, {
        status: "failed",
        completedAt: new Date().toISOString(),
      });
      throw err;
    }

    // 결과에 따라 Phase 상태 업데이트
    const hasFailed = retryResults.some((rr) => !rr.result.success);
    await this.runManager.updatePhase(this.runDir, this.runMeta, phase, {
      status: hasFailed ? "failed" : "completed",
      completedAt: new Date().toISOString(),
    });

    // 실패 에이전트 에러 기록
    for (const rr of retryResults) {
      if (!rr.result.success) {
        await this.runManager.addError(this.runDir, this.runMeta, {
          phase,
          agent: rr.result.agentName,
          message: rr.result.error ?? "unknown error",
          timestamp: new Date().toISOString(),
          retried: rr.retried,
        });
      }
    }

    return retryResults.map((rr) => rr.result);
  }

  private async executeSolo(
    ctx: PhaseContext,
  ): Promise<RetryResult[]> {
    const agentDef = this.agentDefs.get(ctx.agents[0])!;
    const prompt = this.buildSoloPrompt(agentDef, ctx);
    const rr = await executeWithRetry(agentDef, prompt, ctx, this.logger, 1);
    return [rr];
  }

  private async collectPreviousArtifacts(): Promise<Map<string, string>> {
    const artifacts = new Map<string, string>();

    // 현재 run의 artifacts
    try {
      const entries = await readdir(join(this.runDir, "artifacts"));
      for (const entry of entries) {
        const content = await readFile(
          join(this.runDir, "artifacts", entry),
          "utf-8",
        );
        artifacts.set(`artifacts/${entry}`, content);
      }
    } catch {
      // artifacts 디렉토리가 비어있을 수 있음
    }

    // 현재 run의 reviews
    try {
      const entries = await readdir(join(this.runDir, "reviews"));
      for (const entry of entries) {
        const content = await readFile(
          join(this.runDir, "reviews", entry),
          "utf-8",
        );
        artifacts.set(`reviews/${entry}`, content);
      }
    } catch {
      // reviews 디렉토리가 비어있을 수 있음
    }

    // inputRunId가 있으면 선행 run의 artifacts도 추가
    if (this.runMeta.inputRunId) {
      const inputArtifacts = await this.runManager.loadInputRunArtifacts(
        this.runMeta.inputRunId,
      );
      for (const [path, content] of inputArtifacts) {
        if (!artifacts.has(path)) {
          artifacts.set(path, content);
        }
      }
    }

    return artifacts;
  }

  private buildSoloPrompt(
    agentDef: AgentDefinition,
    ctx: PhaseContext,
  ): string {
    const parts: string[] = [];

    parts.push(`# 프로젝트 방향\n\n${this.projectDirection}`);

    // 의존 아티팩트 주입
    for (const inputPath of agentDef.inputs) {
      const content = ctx.previousArtifacts.get(inputPath);
      if (content) {
        parts.push(`---\n\n# 입력: ${inputPath}\n\n${content}`);
      } else {
        parts.push(`---\n\n# 입력: ${inputPath}\n\n(아직 생성되지 않음)`);
      }
    }

    // 리뷰 기록 주입
    const reviewEntries = [...ctx.previousArtifacts.entries()]
      .filter(([path]) => path.startsWith("reviews/"));
    if (reviewEntries.length > 0) {
      const reviewParts = reviewEntries
        .map(([path, content]) => `### ${path}\n\n${content}`)
        .join("\n\n");
      parts.push(`---\n\n# 리뷰 기록\n\n${reviewParts}`);
    }

    const fileInstructions = agentDef.outputFiles
      .map((f) => `Write 도구를 사용하여 ${ctx.artifactsDir}/${f.replace("artifacts/", "")} 파일에 저장하라.`)
      .join("\n");
    parts.push(
      `---\n\n위 내용을 바탕으로 ${agentDef.outputFiles.join(", ")}를 작성하라.\n${fileInstructions}`,
    );

    return parts.join("\n\n").replaceAll("{projectDir}", ctx.projectDir);
  }
}
