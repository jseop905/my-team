import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LogEntry } from "../types/index.js";

export class Logger {
  constructor(private logsDir: string) {}

  async init(): Promise<void> {
    await mkdir(this.logsDir, { recursive: true });
  }

  async logProgress(
    agent: string,
    phase: number,
    turn: number,
    message: string,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      phase,
      turn,
      status: "in_progress",
      message,
    };
    await this.write(agent, entry);
    console.log(`    [${agent}] ${message}`);
  }

  async logPrompt(
    agent: string,
    phase: number,
    turn: number,
    systemPrompt: string,
    prompt: string,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      phase,
      turn,
      status: "prompt",
      message: "프롬프트 전달",
      systemPrompt,
      prompt,
    };
    await this.write(agent, entry);
  }

  async logResponse(
    agent: string,
    phase: number,
    turn: number,
    response: string,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      phase,
      turn,
      status: "response",
      message: "에이전트 응답",
      response,
    };
    await this.write(agent, entry);
  }

  async logComplete(
    agent: string,
    phase: number,
    turn: number,
    message: string,
    artifact: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      phase,
      turn,
      status: "completed",
      message,
      artifact,
      inputTokens,
      outputTokens,
      durationMs,
    };
    await this.write(agent, entry);
    const totalTokens = inputTokens + outputTokens;
    console.log(
      `    [${agent}] ${message} (tokens: ${totalTokens.toLocaleString()} [in: ${inputTokens.toLocaleString()}, out: ${outputTokens.toLocaleString()}], ${(durationMs / 1000).toFixed(1)}s)`,
    );
  }

  async logError(
    agent: string,
    phase: number,
    turn: number,
    message: string,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      phase,
      turn,
      status: "error",
      message,
    };
    await this.write(agent, entry);
    console.error(`    [${agent}] ERROR: ${message}`);
  }

  private async write(agent: string, entry: LogEntry): Promise<void> {
    const filePath = join(this.logsDir, `${agent}.jsonl`);
    await appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
  }
}
