import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { AgentDefinition } from "../types/index.js";
import { extractCodeBlock, extractSection } from "./md-utils.js";

export async function parseAgentFile(
  filePath: string,
): Promise<AgentDefinition> {
  const content = await readFile(filePath, "utf-8");
  const name = basename(filePath, ".md");

  // 역할
  const role = extractSection(content, "역할");

  // 입력 조건
  const inputSection = extractSection(content, "입력 조건");
  const inputMatches = inputSection.match(/`(artifacts\/[^`]+)`/g);
  const inputs = inputMatches
    ? inputMatches.map((m) => m.replace(/`/g, ""))
    : [];

  // 출력 규격
  const outputSection = extractSection(content, "출력 규격");
  const outputFileMatches = [...outputSection.matchAll(/파일:\s*`([^`]+)`/g)];
  const outputFiles = outputFileMatches.map((m) => m[1]);
  if (outputFiles.length === 0) {
    throw new Error(`에이전트 "${name}": 출력 파일이 정의되지 않았습니다.`);
  }

  // 포함 내용
  const specMatch = outputSection.match(/포함 내용:\s*\n([\s\S]*)/);
  const outputSpec = specMatch ? specMatch[1].trim() : "";

  // 교차 리뷰 역할
  const reviewSection = extractSection(content, "교차 리뷰 역할");
  let crossReview: AgentDefinition["crossReview"];
  if (reviewSection) {
    const targetMatch = reviewSection.match(/`(artifacts\/[^`]+)`/);
    const lines = reviewSection
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean);
    crossReview = {
      targetArtifact: targetMatch ? targetMatch[1] : "",
      reviewCriteria: lines.length > 1 ? lines[1] : "",
    };
  }

  // 프롬프트 템플릿
  const promptTemplate = extractCodeBlock(content, "프롬프트 템플릿");

  // 필수 필드 검증
  if (!role) {
    throw new Error(`에이전트 "${name}": 역할이 정의되지 않았습니다.`);
  }
  if (!promptTemplate) {
    throw new Error(`에이전트 "${name}": 프롬프트 템플릿이 정의되지 않았습니다.`);
  }

  return {
    name,
    role,
    inputs,
    outputFiles,
    outputSpec,
    crossReview,
    promptTemplate,
  };
}
