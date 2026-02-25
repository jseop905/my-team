import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { OrchestratorDefinition } from "../types/index.js";
import {
  extractDescription,
  extractSection,
  normalizeAgentName,
  parseMarkdownTable,
} from "./md-utils.js";

export async function parseOrchestratorFile(
  filePath: string,
): Promise<OrchestratorDefinition> {
  const content = await readFile(filePath, "utf-8");
  const name = basename(filePath, ".md");

  const description = extractDescription(content);

  // 팀 구성
  const teamSection = extractSection(content, "팀 구성");
  const teamRows = parseMarkdownTable(teamSection);
  const teamComposition = teamRows
    .map((row) => normalizeAgentName(row["에이전트"] ?? ""))
    .filter(Boolean);
  if (teamComposition.length === 0) {
    throw new Error(`오케스트레이터 "${name}": 팀 구성에 에이전트가 없습니다.`);
  }

  // Phase 배정
  const phaseSection = extractSection(content, "Phase 배정");
  const phaseRows = parseMarkdownTable(phaseSection);
  const phaseAssignment = phaseRows.map((row) => {
    const phase = parseInt(row["Phase"] ?? "0", 10);
    if (phase <= 0) {
      throw new Error(`오케스트레이터 "${name}": Phase 번호는 1 이상이어야 합니다. (받은 값: ${phase})`);
    }
    const agents = (row["에이전트"] ?? "")
      .split(",")
      .map((s) => normalizeAgentName(s))
      .filter(Boolean);
    if (agents.length === 0) {
      throw new Error(`오케스트레이터 "${name}": Phase ${phase}에 에이전트가 없습니다.`);
    }
    const executionMode = (row["실행 방식"] ?? "").includes("단독")
      ? ("solo" as const)
      : ("turn" as const);
    return { phase, agents, executionMode };
  });

  // 산출물 정의
  const artifactSection = extractSection(content, "산출물 정의");
  const artifactRows = parseMarkdownTable(artifactSection);
  const artifacts = artifactRows.map((row) => ({
    path: (row["산출물"] ?? "").replace(/`/g, "").trim(),
    assignee: normalizeAgentName(row["담당"] ?? ""),
    description: (row["설명"] ?? "").trim(),
  }));

  // 실행 흐름
  const executionFlow = extractSection(content, "실행 흐름");

  return {
    name,
    description,
    teamComposition,
    phaseAssignment,
    artifacts,
    executionFlow,
  };
}
