import { readFile, readdir } from "node:fs/promises";
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
  const draftPromises = ctx.agents.map((agentName) => {
    const agentDef = agentDefs.get(agentName)!;
    const prompt = buildDraftPrompt(agentDef, ctx, projectDirection);
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


function buildDraftPrompt(
  agentDef: AgentDefinition,
  ctx: PhaseContext,
  projectDirection: string,
): string {
  const parts: string[] = [];

  parts.push(`# 프로젝트 방향\n\n${projectDirection}`);

  // 의존 아티팩트 주입
  for (const inputPath of agentDef.inputs) {
    const content = ctx.previousArtifacts.get(inputPath);
    if (content) {
      parts.push(`---\n\n# 입력: ${inputPath}\n\n${content}`);
    } else {
      parts.push(`---\n\n# 입력: ${inputPath}\n\n(아직 생성되지 않음)`);
    }
  }

  const fileInstructions = agentDef.outputFiles
    .map((f) => `Write 도구를 사용하여 ${ctx.artifactsDir}/${f.replace("artifacts/", "")} 파일에 저장하라.`)
    .join("\n");
  parts.push(
    `---\n\n위 내용을 바탕으로 ${agentDef.outputFiles.join(", ")}를 작성하라.\n${fileInstructions}`,
  );

  return parts.join("\n\n");
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
  let targetContent: string;
  try {
    targetContent = await readFile(
      join(ctx.artifactsDir, targetFile),
      "utf-8",
    );
  } catch {
    targetContent = "(아직 생성되지 않음)";
  }

  const reviewFileName = `phase${ctx.phaseNumber}-${agentDef.name}-reviews-${targetFile.replace(".md", "").replace(".json", "")}.md`;

  return [
    `# 교차 리뷰 (라운드 ${round})`,
    ``,
    `## 리뷰 대상: ${agentDef.crossReview.targetArtifact}`,
    ``,
    targetContent,
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
  const contentParts: string[] = [];

  for (const outputFilePath of agentDef.outputFiles) {
    const outputFile = outputFilePath.replace("artifacts/", "");
    let currentContent: string;
    try {
      currentContent = await readFile(
        join(ctx.artifactsDir, outputFile),
        "utf-8",
      );
    } catch {
      currentContent = "(아직 생성되지 않음)";
    }
    contentParts.push(`## 현재 산출물: ${outputFilePath}\n\n${currentContent}`);
  }

  // 리뷰 파일 수집
  const reviewParts: string[] = [];
  try {
    const reviewFiles = await readdir(ctx.reviewsDir);
    for (const outputFilePath of agentDef.outputFiles) {
      const outputFile = outputFilePath.replace("artifacts/", "");
      const targetName = outputFile.replace(".md", "").replace(".json", "");
      for (const rf of reviewFiles) {
        if (rf.includes(`reviews-${targetName}`)) {
          const reviewContent = await readFile(
            join(ctx.reviewsDir, rf),
            "utf-8",
          );
          reviewParts.push(`### 리뷰: ${rf}\n\n${reviewContent}`);
        }
      }
    }
  } catch {
    // reviews 디렉토리가 비었거나 없음
  }

  if (reviewParts.length === 0) {
    reviewParts.push("(리뷰 코멘트 없음)");
  }

  const writeInstructions = agentDef.outputFiles
    .map((f) => `Write 도구를 사용하여 ${ctx.artifactsDir}/${f.replace("artifacts/", "")} 파일에 덮어쓰라.`)
    .join("\n");

  return [
    `# 산출물 반영 및 확정 (라운드 ${round})`,
    ``,
    ...contentParts,
    ``,
    `## 받은 리뷰 코멘트`,
    ``,
    reviewParts.join("\n\n"),
    ``,
    `## 지침`,
    `위 리뷰 코멘트를 반영하여 산출물을 수정하라.`,
    writeInstructions,
    `변경할 내용이 없으면 "변경 사항 없음"이라고 응답하라.`,
  ].join("\n");
}
