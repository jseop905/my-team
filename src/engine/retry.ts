import type { AgentDefinition, AgentExecutionResult, PhaseContext } from "../types/index.js";
import type { Logger } from "../logger/logger.js";
import { runAgent } from "../agent/agent-runner.js";

export interface RetryResult {
  result: AgentExecutionResult;
  retried: boolean;
}

export async function executeWithRetry(
  agentDef: AgentDefinition,
  prompt: string,
  ctx: PhaseContext,
  logger: Logger,
  turn: number,
): Promise<RetryResult> {
  let result = await runAgent({
    agentDef,
    prompt,
    artifactsDir: ctx.artifactsDir,
    phase: ctx.phaseNumber,
    turn,
    logger,
  });

  if (!result.success) {
    console.log(`    재시도: ${agentDef.name}`);
    result = await runAgent({
      agentDef,
      prompt,
      artifactsDir: ctx.artifactsDir,
      phase: ctx.phaseNumber,
      turn,
      logger,
    });
    return { result, retried: true };
  }

  return { result, retried: false };
}
