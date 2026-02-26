import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentDefinition,
  PhaseContext,
} from "../types/index.js";
import type { Logger } from "../logger/logger.js";
import { executeWithRetry, type RetryResult } from "./retry.js";

const MAX_REVIEW_ROUNDS = 2;

export async function executeTurns(
  ctx: PhaseContext,
  agentDefs: Map<string, AgentDefinition>,
  logger: Logger,
  projectDirection: string,
): Promise<RetryResult[]> {
  const allResults: RetryResult[] = [];

  // ========== Turn 1: 초안 작성 (병렬) ==========
  console.log(`  Turn 1: 초안 작성 (병렬)`);
  const draftPromises = ctx.agents.map(async (agentName) => {
    const agentDef = agentDefs.get(agentName)!;
    const prompt = await buildDraftPrompt(agentDef, ctx, projectDirection);
    return executeWithRetry(agentDef, prompt, ctx, logger, 1);
  });
  const draftResults = await Promise.all(draftPromises);
  allResults.push(...draftResults);

  // ========== Turn 2~3 반복 (최대 MAX_REVIEW_ROUNDS회) ==========
  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round++) {
    console.log(`\n  리뷰 라운드 ${round}/${MAX_REVIEW_ROUNDS}`);

    // ----- Turn 2: 교차 리뷰 (순차) -----
    console.log(`  Turn 2: 교차 리뷰 (순차)`);
    for (const agentName of ctx.agents) {
      const agentDef = agentDefs.get(agentName)!;
      if (!agentDef.crossReview) continue;

      const prompt = await buildReviewPrompt(agentDef, ctx, round);
      const rr = await executeWithRetry(agentDef, prompt, ctx, logger, 2);
      allResults.push(rr);
    }

    // ----- Turn 3: 반영 및 확정 (순차) -----
    console.log(`  Turn 3: 반영 및 확정 (순차)`);
    const reviseResults: RetryResult[] = [];
    for (const agentName of ctx.agents) {
      const agentDef = agentDefs.get(agentName)!;
      const prompt = await buildRevisePrompt(agentDef, ctx, round);
      const rr = await executeWithRetry(agentDef, prompt, ctx, logger, 3);
      reviseResults.push(rr);
    }
    allResults.push(...reviseResults);

    // 조기 종료: 모든 에이전트가 "변경 사항 없음" 응답 시 리뷰 루프 중단
    const allNoChange = reviseResults.every((rr) =>
      rr.result.resultText.includes("변경 사항 없음"),
    );
    if (allNoChange) {
      console.log(`  모든 에이전트 "변경 사항 없음" — 리뷰 루프 조기 종료`);
      break;
    }
  }

  return allResults;
}


async function buildDraftPrompt(
  agentDef: AgentDefinition,
  ctx: PhaseContext,
  projectDirection: string,
): Promise<string> {
  const contextDir = join(ctx.runDir, "context");
  const contextFileName = `phase${ctx.phaseNumber}-${agentDef.name}-draft.md`;
  const contextFilePath = join(contextDir, contextFileName);

  const contextParts: string[] = [];
  contextParts.push(`# 프로젝트 방향\n\n${projectDirection}`);

  for (const inputPath of agentDef.inputs) {
    const content = ctx.previousArtifacts.get(inputPath);
    if (content) {
      contextParts.push(`---\n\n# 입력: ${inputPath}\n\n${content}`);
    } else {
      contextParts.push(`---\n\n# 입력: ${inputPath}\n\n(아직 생성되지 않음)`);
    }
  }

  await writeFile(contextFilePath, contextParts.join("\n\n"), "utf-8");

  const fileInstructions = agentDef.outputFiles
    .map((f) => `Write 도구를 사용하여 ${ctx.artifactsDir}/${f.replace("artifacts/", "")} 파일에 저장하라.`)
    .join("\n");

  return [
    `먼저 Read 도구로 다음 컨텍스트 파일을 읽어라: ${contextFilePath}`,
    ``,
    `컨텍스트 파일에는 프로젝트 방향과 입력 아티팩트가 포함되어 있다.`,
    `이를 바탕으로 ${agentDef.outputFiles.join(", ")}를 작성하라.`,
    fileInstructions,
  ].join("\n");
}

async function buildReviewPrompt(
  agentDef: AgentDefinition,
  ctx: PhaseContext,
  round: number,
): Promise<string> {
  if (!agentDef.crossReview) return "";

  const targetFile = agentDef.crossReview.targetArtifact.replace(
    "artifacts/",
    "",
  );
  const targetFilePath = join(ctx.artifactsDir, targetFile);

  const reviewFileName = `phase${ctx.phaseNumber}-${agentDef.name}-reviews-${targetFile.replace(".md", "").replace(".json", "")}.md`;

  return [
    `# 교차 리뷰 (라운드 ${round})`,
    ``,
    `먼저 Read 도구로 리뷰 대상 파일을 읽어라: ${targetFilePath}`,
    ``,
    `## 리뷰 기준`,
    agentDef.crossReview.reviewCriteria,
    ``,
    `## 지침`,
    `위 산출물을 리뷰하고 코멘트를 작성하라.`,
    `Write 도구를 사용하여 ${ctx.reviewsDir}/${reviewFileName} 파일에 저장하라.`,
    `구체적이고 실행 가능한 피드백을 제공하라.`,
  ].join("\n");
}

async function buildRevisePrompt(
  agentDef: AgentDefinition,
  ctx: PhaseContext,
  round: number,
): Promise<string> {
  // 현재 산출물 파일 경로 목록
  const artifactFiles = agentDef.outputFiles.map((f) => {
    const outputFile = f.replace("artifacts/", "");
    return join(ctx.artifactsDir, outputFile);
  });

  // 리뷰 파일 경로 목록
  const reviewFilePaths: string[] = [];
  try {
    const reviewFiles = await readdir(ctx.reviewsDir);
    for (const outputFilePath of agentDef.outputFiles) {
      const outputFile = outputFilePath.replace("artifacts/", "");
      const targetName = outputFile.replace(".md", "").replace(".json", "");
      for (const rf of reviewFiles) {
        if (rf.includes(`reviews-${targetName}`)) {
          reviewFilePaths.push(join(ctx.reviewsDir, rf));
        }
      }
    }
  } catch {
    // reviews 디렉토리가 비었거나 없음
  }

  const writeInstructions = agentDef.outputFiles
    .map((f) => `Write 도구를 사용하여 ${ctx.artifactsDir}/${f.replace("artifacts/", "")} 파일에 덮어쓰라.`)
    .join("\n");

  const readInstructions = [
    ...artifactFiles.map((f) => `- 현재 산출물: ${f}`),
    ...reviewFilePaths.map((f) => `- 리뷰 코멘트: ${f}`),
  ].join("\n");

  return [
    `# 산출물 반영 및 확정 (라운드 ${round})`,
    ``,
    `먼저 Read 도구로 다음 파일들을 읽어라:`,
    readInstructions,
    ``,
    `## 지침`,
    `리뷰 코멘트를 반영하여 산출물을 수정하라.`,
    writeInstructions,
    `변경할 내용이 없으면 "변경 사항 없음"이라고 응답하라.`,
  ].join("\n");
}
