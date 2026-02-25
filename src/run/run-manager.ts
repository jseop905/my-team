import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PhaseStatus, RunError, RunMeta } from "../types/index.js";

export class RunManager {
  constructor(private runsBaseDir: string) {}

  /**
   * 새 run 디렉토리를 생성하고 초기 RunMeta를 반환한다.
   */
  async createRun(
    orchestrator: string,
    task: string,
    agents: string[],
    phases: number[],
    inputRunId?: string,
  ): Promise<{ runDir: string; runMeta: RunMeta }> {
    const id = await this.generateRunId(orchestrator, task);
    const runDir = join(this.runsBaseDir, id);

    await mkdir(join(runDir, "artifacts"), { recursive: true });
    await mkdir(join(runDir, "reviews"), { recursive: true });
    await mkdir(join(runDir, "logs"), { recursive: true });

    const runMeta: RunMeta = {
      id,
      orchestrator,
      task,
      status: "running",
      startedAt: new Date().toISOString(),
      agents,
      phases: phases.map((p) => ({ phase: p, status: "pending" as const })),
      totalCostUsd: 0,
      errors: [],
      inputRunId,
    };

    await this.saveMeta(runDir, runMeta);
    return { runDir, runMeta };
  }

  /**
   * Phase 상태를 업데이트하고 run-meta.json에 저장한다.
   */
  async updatePhase(
    runDir: string,
    runMeta: RunMeta,
    phaseNumber: number,
    update: Partial<PhaseStatus>,
  ): Promise<void> {
    const phase = runMeta.phases.find((p) => p.phase === phaseNumber);
    if (phase) {
      Object.assign(phase, update);
    }
    await this.saveMeta(runDir, runMeta);
  }

  /**
   * 에러를 추가하고 run-meta.json에 저장한다.
   */
  async addError(
    runDir: string,
    runMeta: RunMeta,
    error: RunError,
  ): Promise<void> {
    runMeta.errors.push(error);
    await this.saveMeta(runDir, runMeta);
  }

  /**
   * run 상태를 완료/실패로 마킹하고 총 비용을 기록한다.
   */
  async finalizeRun(
    runDir: string,
    runMeta: RunMeta,
    totalCostUsd: number,
    failed: boolean,
  ): Promise<void> {
    runMeta.status = failed ? "failed" : "completed";
    runMeta.completedAt = new Date().toISOString();
    runMeta.totalCostUsd = totalCostUsd;
    await this.saveMeta(runDir, runMeta);
  }

  /**
   * 선행 run의 artifacts를 읽어 Map으로 반환한다.
   */
  async loadInputRunArtifacts(
    inputRunId: string,
  ): Promise<Map<string, string>> {
    const artifacts = new Map<string, string>();
    const artifactsDir = join(this.runsBaseDir, inputRunId, "artifacts");

    try {
      const entries = await readdir(artifactsDir);
      for (const entry of entries) {
        const content = await readFile(
          join(artifactsDir, entry),
          "utf-8",
        );
        artifacts.set(`artifacts/${entry}`, content);
      }
    } catch {
      // 디렉토리가 없거나 비어있는 경우
    }

    return artifacts;
  }

  private async saveMeta(
    runDir: string,
    runMeta: RunMeta,
  ): Promise<void> {
    await writeFile(
      join(runDir, "run-meta.json"),
      JSON.stringify(runMeta, null, 2),
      "utf-8",
    );
  }

  private async generateRunId(orchestrator: string, task: string): Promise<string> {
    const date = new Date().toISOString().slice(0, 10);
    const prefix = `${date}_`;
    const suffix = `_${orchestrator}_${task}`;

    let maxSeq = 0;
    try {
      const entries = await readdir(this.runsBaseDir);
      for (const entry of entries) {
        if (entry.startsWith(prefix) && entry.endsWith(suffix)) {
          const seqStr = entry.slice(prefix.length, entry.length - suffix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    } catch {
      // runs 디렉토리가 아직 없을 수 있음
    }

    const seq = String(maxSeq + 1).padStart(3, "0");
    return `${date}_${seq}_${orchestrator}_${task}`;
  }
}
