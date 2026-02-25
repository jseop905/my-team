# 오케스트레이터 구현 계획 (Claude Agent SDK + TypeScript)

## Context

멀티 오케스트레이터 + 공유 에이전트 풀 구조의 설계 문서가 완성되었다.

- `orchestrator.md` — 공통 실행 인프라 (Run, Phase/Turn, 로그, Run Chaining)
- `orchestrators/*.md` — 개별 오케스트레이터 정의 (팀 구성, Phase 배정, 산출물)
- `agents/*.md` — 공유 에이전트 풀 (역할, 입출력, 프롬프트)
- `tasks/*.md` — 태스크 (프로젝트 방향, 사용할 오케스트레이터)

이 설계를 `@anthropic-ai/claude-agent-sdk` TypeScript SDK로 구현하여,
`npm run orchestrate -- <orchestrator> <task>` 명령으로 Phase/Turn 기반 멀티 에이전트 워크플로우를 실행한다.

```bash
# 기획 팀 실행
npm run orchestrate -- planning-team blog-project

# 개발 팀 실행 (기획 산출물을 입력으로)
npm run orchestrate -- dev-team blog-project --input-run 2026-02-25_001_planning-team_blog-project
```

## 핵심 설계 결정

1. **독립 `query()` 호출 방식**: SDK의 agents 옵션(서브에이전트)을 사용하지 않고, 각 에이전트를 별도 `query()` 호출로 실행한다.
   - 이유: 토큰 격리, `Promise.all()`로 자연스러운 병렬 실행, 서브에이전트 중첩 불가 제약 회피
   - 각 에이전트의 비용/시간이 독립 추적됨

2. **MD 파서로 동적 로드**: 오케스트레이터/에이전트/태스크 정의를 하드코딩하지 않고 기존 MD 파일을 파싱

3. **systemPrompt 방식**: 커스텀 문자열로 에이전트 역할 + 출력 규격 + 프롬프트 템플릿 주입
   - `{ preset: "claude_code" }` 사용하지 않음 (불필요한 Claude Code 지시사항 배제)

4. **permissionMode**: `"bypassPermissions"` + `allowDangerouslySkipPermissions: true` (자동화 시스템)

---

## 프로젝트 구조

```
my-team/
├── src/
│   ├── cli.ts                     # CLI 진입점 (orchestrator + task 인자 처리)
│   ├── orchestrator.ts            # 메인 오케스트레이터 (전체 흐름 제어)
│   ├── types/
│   │   ├── index.ts               # 배럴 export
│   │   ├── orchestrator-def.ts    # OrchestratorDefinition, PhaseAssignment, ArtifactDefinition
│   │   ├── task.ts                # TaskDefinition, OrchestratorRef
│   │   ├── agent.ts               # AgentDefinition, CrossReviewDef
│   │   ├── run.ts                 # RunMeta, RunStatus, PhaseStatus, RunError
│   │   └── engine.ts              # PhaseContext, AgentExecutionResult, LogEntry
│   ├── parsers/
│   │   ├── orchestrator-parser.ts # orchestrators/*.md → OrchestratorDefinition
│   │   ├── task-parser.ts         # tasks/*.md → TaskDefinition
│   │   ├── agent-parser.ts        # agents/*.md → AgentDefinition
│   │   └── md-utils.ts            # 공통 MD 파싱 유틸
│   ├── run/
│   │   └── run-manager.ts         # run-id 생성, 디렉토리, run-meta.json 관리
│   ├── engine/
│   │   ├── phase-executor.ts      # Phase 실행 (단독/Turn 분기)
│   │   └── turn-executor.ts       # Turn 1→2→3 실행 + 리뷰 라운드
│   ├── agent/
│   │   └── agent-runner.ts        # SDK query() 래핑
│   └── logger/
│       └── logger.ts              # JSONL 로그 기록
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Step 1: 프로젝트 초기화

### package.json

```json
{
  "name": "my-team-orchestrator",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "orchestrate": "tsx src/cli.ts"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.52"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### 실행: `npm install`

---

## Step 2: 타입 정의 (`src/types/`)

### orchestrator-def.ts

```typescript
export interface OrchestratorDefinition {
  name: string;                        // 파일명에서 추출 ("planning-team")
  description: string;                 // 첫 번째 문단
  teamComposition: string[];           // "## 팀 구성" 테이블에서 에이전트명 추출
  phaseAssignment: PhaseAssignment[];  // "## Phase 배정" 테이블
  artifacts: ArtifactDefinition[];     // "## 산출물 정의" 테이블
  executionFlow: string;               // "## 실행 흐름" 섹션 원문 (참고용)
}

export interface PhaseAssignment {
  phase: number;                       // 1, 2, 3...
  agents: string[];                    // ["research", "tech-architect"]
  executionMode: "solo" | "turn";      // "단독" → solo, 그 외 → turn
}

export interface ArtifactDefinition {
  path: string;                        // "artifacts/project-vision.md"
  assignee: string;                    // "planner"
  description: string;                 // "요구사항 및 MVP 범위"
}
```

### task.ts

```typescript
export interface TaskDefinition {
  name: string;                        // 파일명에서 추출 ("blog-project")
  orchestrators: OrchestratorRef[];    // "## 오케스트레이터" 테이블
  projectDirection: string;            // "## 프로젝트 방향" 섹션 원문
}

export interface OrchestratorRef {
  stage: string;                       // "기획", "개발" 등
  orchestratorName: string;            // "planning-team"
  description: string;                 // "아이디어 → 기획서, 기술 설계서"
}
```

### agent.ts

```typescript
export interface AgentDefinition {
  name: string;                        // 파일명에서 추출 ("planner")
  role: string;                        // "## 역할" 섹션
  inputs: string[];                    // "## 입력 조건"에서 추출한 경로 ["artifacts/project-vision.md"]
  outputFile: string;                  // "## 출력 규격"에서 추출 "artifacts/project-vision.md"
  outputSpec: string;                  // 출력에 포함할 내용 설명 원문
  crossReview?: CrossReviewDef;        // "## 교차 리뷰 역할" (있을 경우)
  promptTemplate: string;              // "## 프롬프트 템플릿" 코드블록 내용
}

export interface CrossReviewDef {
  targetArtifact: string;              // "artifacts/tech-architecture.md"
  reviewCriteria: string;              // "기술 선택이 시장 분석 결과와 부합하는지 검토"
}
```

### run.ts

```typescript
export type RunStatus = "running" | "completed" | "failed";

export interface RunMeta {
  id: string;                          // "2026-02-24_001_planning-team_blog-project"
  orchestrator: string;                // "planning-team"
  task: string;                        // "blog-project"
  status: RunStatus;
  startedAt: string;                   // ISO 8601
  completedAt?: string;
  agents: string[];
  phases: PhaseStatus[];
  inputRunId?: string;                 // Run Chaining 시 선행 run ID
  totalCostUsd?: number;
  errors?: RunError[];
}

export interface PhaseStatus {
  phase: number;
  status: "pending" | "running" | "completed" | "failed";
  reviewRounds?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface RunError {
  phase: number;
  agent: string;
  message: string;
  timestamp: string;
  retried: boolean;
}
```

### engine.ts

```typescript
export interface PhaseContext {
  phaseNumber: number;
  agents: string[];
  mode: "solo" | "turn";
  runDir: string;                      // 절대 경로: runs/{run-id}
  artifactsDir: string;                // runs/{run-id}/artifacts
  reviewsDir: string;                  // runs/{run-id}/reviews
  logsDir: string;                     // runs/{run-id}/logs
  previousArtifacts: Map<string, string>;  // path → content
}

export interface AgentExecutionResult {
  agentName: string;
  success: boolean;
  outputPath?: string;
  resultText: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  error?: string;
}

export interface LogEntry {
  timestamp: string;
  agent: string;
  phase: number;
  turn: number;
  status: "in_progress" | "completed" | "error";
  message: string;
  artifact?: string;
  costUsd?: number;
  durationMs?: number;
}
```

---

## Step 3: MD 파서 (`src/parsers/`)

### md-utils.ts — 공통 유틸

```typescript
/** "## 헤딩" ~ 다음 "## " 사이의 텍스트 추출 */
export function extractSection(content: string, heading: string): string

/** Markdown 테이블 → 객체 배열로 변환 */
export function parseMarkdownTable(section: string): Record<string, string>[]

/** 특정 섹션 아래 첫 번째 코드블록(```...```) 내용 추출 */
export function extractCodeBlock(content: string, heading: string): string

/** "Tech Architect" → "tech-architect" */
export function normalizeAgentName(name: string): string

/** 첫 번째 "# " 이후, 다음 "## " 이전까지의 텍스트 (설명 문단) 추출 */
export function extractDescription(content: string): string
```

파싱 정규식 상세:
- `extractSection`: `/## ${heading}\n([\s\S]*?)(?=\n## |\n*$)/`
- `parseMarkdownTable`: `|` 구분자로 split, 첫 행=헤더, 두번째 행=구분선(스킵), 나머지=데이터
- `extractCodeBlock`: 섹션 내 `` /```[a-z]*\n([\s\S]*?)```/ ``
- `normalizeAgentName`: `.trim().toLowerCase().replace(/\s+/g, "-")`
- `extractDescription`: `/^# .+\n\n([\s\S]*?)(?=\n## )/`

### orchestrator-parser.ts (신규)

실제 파싱 대상 (orchestrators/planning-team.md):
```
## 팀 구성
| 에이전트         | 역할                       |
| ---------------- | -------------------------- |
| `planner`        | 요구사항 정의, MVP 범위    |

## Phase 배정
| Phase | 에이전트                   | 실행 방식                              |
| ----- | -------------------------- | -------------------------------------- |
| 1     | Planner                    | 단독 실행                              |
| 2     | Research, Tech Architect   | Turn 기반 (초안 → 교차 리뷰 → 반영)   |

## 산출물 정의
| 산출물                          | 담당           | 설명                 |
| ------------------------------- | -------------- | -------------------- |
| `artifacts/project-vision.md`   | Planner        | 요구사항 및 MVP 범위 |
```

파싱 로직:
1. `name`: 파일명에서 추출 (`planning-team.md` → `"planning-team"`)
2. `description`: `extractDescription(content)`
3. `teamComposition`: "팀 구성" 테이블에서 에이전트 컬럼 추출
   - row["에이전트"]에서 백틱 제거 → `["planner", "research", ...]`
4. `phaseAssignment`: "Phase 배정" 테이블 파싱
   - `phase`: parseInt(row["Phase"])
   - `agents`: row["에이전트"].split(",").map(s => normalizeAgentName(s))
   - `executionMode`: row["실행 방식"].includes("단독") ? "solo" : "turn"
5. `artifacts`: "산출물 정의" 테이블 파싱
   - `path`: row["산출물"]에서 백틱 제거
   - `assignee`: normalizeAgentName(row["담당"])
   - `description`: row["설명"]
6. `executionFlow`: `extractSection(content, "실행 흐름")`

### task-parser.ts (간소화)

실제 파싱 대상 (tasks/blog-project.md):
```
## 오케스트레이터
| 단계   | 오케스트레이터   | 설명                               |
| ------ | ---------------- | ---------------------------------- |
| 기획   | `planning-team`  | 아이디어 → 기획서, 기술 설계서     |
| 개발   | `dev-team`       | 기획서 → 코드 구현 (향후)          |

## 프로젝트 방향
- 개발자 대상 기술 블로그를 기본 방향으로 한다.
...
```

파싱 로직:
1. `name`: 파일명에서 추출 (`blog-project.md` → `"blog-project"`)
2. `orchestrators`: "오케스트레이터" 테이블 파싱
   - `stage`: row["단계"]
   - `orchestratorName`: row["오케스트레이터"]에서 백틱 제거
   - `description`: row["설명"]
3. `projectDirection`: `extractSection(content, "프로젝트 방향")`

### agent-parser.ts (변경 없음)

실제 파싱 대상 (agents/research.md):
```
## 입력 조건
- `artifacts/project-vision.md` (필수)

## 출력 규격
- 파일: `artifacts/market-analysis.md`
- 포함 내용:
  - 시장 현황 요약
  ...

## 교차 리뷰 역할
- Turn 2에서 `artifacts/tech-architecture.md`를 리뷰한다.
- 기술 선택이 시장 분석 결과와 부합하는지 검토한다.
```

파싱 로직:
1. `inputs`: "입력 조건" 섹션에서 `` /`(artifacts\/[^`]+)`/g `` 매칭 → `["artifacts/project-vision.md"]`
   - Planner는 "태스크 명세의 프로젝트 방향 섹션" → 빈 배열 (프로젝트 방향은 항상 주입)
2. `outputFile`: "출력 규격" 섹션에서 `` /파일:\s*`([^`]+)`/ `` 매칭 → `"artifacts/market-analysis.md"`
3. `outputSpec`: "출력 규격" 섹션에서 "포함 내용:" 이후 텍스트
4. `crossReview`: "교차 리뷰 역할" 섹션이 있으면
   - `targetArtifact`: `` /`(artifacts\/[^`]+)`/ `` 매칭
   - `reviewCriteria`: 두 번째 줄 (리뷰 기준 설명)
5. `promptTemplate`: `extractCodeBlock(content, "프롬프트 템플릿")`

---

## Step 4: 로거 + Run 매니저

### logger.ts

```typescript
export class Logger {
  constructor(private logsDir: string) {}

  async log(entry: LogEntry): Promise<void>
  // → appendFile(join(logsDir, `${entry.agent}.jsonl`), JSON.stringify(entry) + "\n")

  async logProgress(agent, phase, turn, message, artifact?): Promise<void>
  async logComplete(agent, phase, turn, message, artifact?, costUsd?, durationMs?): Promise<void>
  async logError(agent, phase, turn, message): Promise<void>
}
```

### run-manager.ts

```typescript
export class RunManager {
  constructor(private baseDir: string) {}

  async createRun(orchestratorName: string, taskName: string, agents: string[], phases: PhaseStatus[], inputRunId?: string): Promise<RunMeta>
  // 1. today = YYYY-MM-DD
  // 2. runs/ 스캔하여 같은 날 같은 orchestrator+task 조합의 최대 순번 확인 → +1 → "001" 형태
  // 3. runId = `${today}_${seq}_${orchestratorName}_${taskName}`
  // 4. mkdir -p runs/{runId}/{logs,artifacts,reviews}
  // 5. run-meta.json 저장 (status: "running", orchestrator, inputRunId)

  async updatePhase(runDir, meta, phaseNumber, updates): Promise<RunMeta>
  // meta.phases에서 해당 phase 찾아 업데이트 → run-meta.json 저장

  async completeRun(runDir, meta, status, totalCostUsd?): Promise<RunMeta>
  // status, completedAt, totalCostUsd 갱신 → 저장

  async addError(runDir, meta, error: RunError): Promise<RunMeta>
  // meta.errors에 추가 → 저장

  async loadInputRunArtifacts(inputRunId: string): Promise<Map<string, string>>
  // runs/{inputRunId}/artifacts/ 의 모든 파일을 읽어 Map<경로, 내용>으로 반환
  // Run Chaining 시 선행 run의 산출물을 후속 run에 주입할 때 사용

  getRunDir(runId: string): string
  // → join(baseDir, "runs", runId)
}
```

---

## Step 5: 에이전트 실행기 (`src/agent/agent-runner.ts`)

### SDK query() 호출 래핑

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

export interface AgentRunOptions {
  agentDef: AgentDefinition;
  prompt: string;                     // Turn에 따라 다르게 조합된 프롬프트
  artifactsDir: string;               // 에이전트가 Write할 절대 경로
  phase: number;
  turn: number;
  logger: Logger;
  maxTurns?: number;                  // SDK maxTurns (기본 30)
}

export async function runAgent(options: AgentRunOptions): Promise<AgentExecutionResult> {
  const { agentDef, prompt, artifactsDir, phase, turn, logger, maxTurns = 30 } = options;

  await logger.logProgress(agentDef.name, phase, turn, "에이전트 실행 시작");

  let sessionId = "";
  let resultText = "";
  let costUsd = 0;
  let durationMs = 0;
  let numTurns = 0;
  let success = false;
  let error: string | undefined;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: buildSystemPrompt(agentDef, artifactsDir),
        cwd: artifactsDir,              // 에이전트의 작업 디렉토리 = artifacts 폴더
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
      },
    })) {
      // 1) init → session_id 캡처
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
      }

      // 2) result → 최종 결과 수집
      if (message.type === "result") {
        costUsd = message.total_cost_usd;
        durationMs = message.duration_ms;
        numTurns = message.num_turns;

        if (message.subtype === "success") {
          resultText = message.result;
          success = true;
        } else {
          // "error_max_turns" | "error_during_execution" | "error_max_budget_usd"
          error = `${message.subtype}: ${(message as any).errors?.join("; ") ?? "unknown"}`;
          success = false;
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    success = false;
  }

  // 로그 기록
  if (success) {
    await logger.logComplete(agentDef.name, phase, turn, "실행 완료", agentDef.outputFile, costUsd, durationMs);
  } else {
    await logger.logError(agentDef.name, phase, turn, `실행 실패: ${error}`);
  }

  return { agentName: agentDef.name, success, outputPath: agentDef.outputFile, resultText, sessionId, costUsd, durationMs, numTurns, error };
}
```

### 시스템 프롬프트 조합

```typescript
function buildSystemPrompt(agentDef: AgentDefinition, artifactsDir: string): string {
  return [
    `너는 "${agentDef.name}" 에이전트이다.`,
    ``,
    `## 역할`,
    agentDef.role,
    ``,
    `## 출력 규격`,
    `결과를 반드시 다음 파일에 작성하라: ${artifactsDir}/${agentDef.outputFile.replace("artifacts/", "")}`,
    `Write 도구를 사용하여 위 절대 경로에 파일을 생성하라.`,
    agentDef.outputSpec,
    ``,
    `## 작업 지침`,
    agentDef.promptTemplate,
    ``,
    `## 중요 규칙`,
    `- 반드시 Write 도구로 파일을 생성하라. 텍스트 응답만 하지 마라.`,
    `- 파일 경로는 절대 경로를 사용하라.`,
    `- 한국어로 작성하라.`,
  ].join("\n");
}
```

### SDK 연동 핵심 사항

1. **파일 쓰기 3요소**: `allowedTools`에 `"Write"` 포함 + `permissionMode: "bypassPermissions"` + 프롬프트에 절대 경로 명시
2. **systemPrompt**: 커스텀 문자열 사용 (Claude Code 프리셋 아님). SDK 기본값은 최소 프롬프트이므로 명시 필수
3. **비용 추적**: `SDKResultMessage`의 `total_cost_usd`, `duration_ms`, `num_turns` 에서만 추출 가능 (스트림 마지막 메시지)
4. **세션 ID**: `SDKSystemMessage` (type="system", subtype="init") 에서 `session_id` 캡처
5. **에러 subtypes**: `error_max_turns`, `error_during_execution`, `error_max_budget_usd`, `error_max_structured_output_retries`
6. **환경 변수**: `ANTHROPIC_API_KEY`를 SDK가 자동으로 읽음

---

## Step 6: Phase/Turn 엔진 (`src/engine/`)

### phase-executor.ts

```typescript
export class PhaseExecutor {
  constructor(
    private runManager: RunManager,
    private logger: Logger,
    private agentDefs: Map<string, AgentDefinition>,
    private runDir: string,
    private runMeta: RunMeta,
    private projectDirection: string,
  ) {}

  async executePhase(assignment: PhaseAssignment): Promise<AgentExecutionResult[]> {
    // 1. Phase 상태 → "running"
    // 2. 이전 Phase 산출물 수집 (collectPreviousArtifacts)
    //    - inputRunId가 있으면 선행 run의 산출물도 포함
    // 3. mode === "solo" → executeSolo() / mode === "turn" → executeTurns()
    // 4. 결과에 따라 Phase 상태 → "completed" | "failed"
    // 5. 실패 에이전트가 있으면 RunMeta.errors에 추가
  }

  private async executeSolo(ctx: PhaseContext): Promise<AgentExecutionResult[]> {
    const agentDef = this.agentDefs.get(ctx.agents[0])!;
    const prompt = this.buildSoloPrompt(agentDef, ctx);
    const result = await this.executeWithRetry(agentDef, prompt, ctx, 1);
    return [result];
  }

  private async executeWithRetry(agentDef, prompt, ctx, turn): Promise<AgentExecutionResult> {
    let result = await runAgent({ agentDef, prompt, artifactsDir: ctx.artifactsDir, phase: ctx.phaseNumber, turn, logger: this.logger });
    if (!result.success) {
      // 1회 재시도
      result = await runAgent({ agentDef, prompt, artifactsDir: ctx.artifactsDir, phase: ctx.phaseNumber, turn, logger: this.logger });
    }
    return result;
  }

  private async collectPreviousArtifacts(): Promise<Map<string, string>> {
    const artifacts = new Map<string, string>();

    // 1. 현재 run의 artifacts
    // runs/{runId}/artifacts/ 의 모든 파일을 읽어 추가

    // 2. inputRunId가 있으면 선행 run의 artifacts도 추가 (현재 run에 없는 것만)
    if (this.runMeta.inputRunId) {
      const inputArtifacts = await this.runManager.loadInputRunArtifacts(this.runMeta.inputRunId);
      for (const [path, content] of inputArtifacts) {
        if (!artifacts.has(path)) {
          artifacts.set(path, content);
        }
      }
    }

    return artifacts;
  }

  private buildSoloPrompt(agentDef, ctx): string {
    // 프로젝트 방향 + 의존 아티팩트(inputs) 내용 주입
  }
}
```

### turn-executor.ts — Turn 기반 실행 상세

```typescript
const MAX_REVIEW_ROUNDS = 2;

export async function executeTurns(ctx: PhaseContext, agentDefs, logger, projectDirection): Promise<AgentExecutionResult[]> {
  const allResults: AgentExecutionResult[] = [];

  // ========== Turn 1: 초안 작성 (병렬) ==========
  const draftPromises = ctx.agents.map(agentName => {
    const agentDef = agentDefs.get(agentName)!;
    const prompt = buildDraftPrompt(agentDef, ctx, projectDirection);
    return executeWithRetry(agentDef, prompt, ctx, logger, 1);
  });
  const draftResults = await Promise.all(draftPromises);
  allResults.push(...draftResults);

  // ========== Turn 2~3 반복 (최대 MAX_REVIEW_ROUNDS회) ==========
  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round++) {

    // ----- Turn 2: 교차 리뷰 (순차) -----
    for (const agentName of ctx.agents) {
      const agentDef = agentDefs.get(agentName)!;
      if (!agentDef.crossReview) continue;

      const prompt = await buildReviewPrompt(agentDef, ctx, round);
      const result = await executeWithRetry(agentDef, prompt, ctx, logger, 2);
      allResults.push(result);
    }

    // ----- Turn 3: 반영 및 확정 (순차) -----
    for (const agentName of ctx.agents) {
      const agentDef = agentDefs.get(agentName)!;
      const prompt = await buildRevisePrompt(agentDef, ctx, round);
      const result = await executeWithRetry(agentDef, prompt, ctx, logger, 3);
      allResults.push(result);
    }
  }

  return allResults;
}
```

### 프롬프트 조합 상세 (Turn별)

**Turn 1 — 초안 작성 (buildDraftPrompt)**

```
# 프로젝트 방향

- 개발자 대상 기술 블로그를 기본 방향으로 한다.
- 직접 운영하며, 장기적으로 수익화 가능성을 열어둔다.
- MVP 우선 접근: 최소 기능으로 빠르게 배포하고 점진적으로 확장한다.

---

# 입력: artifacts/project-vision.md

{project-vision.md의 실제 내용}

---

위 내용을 바탕으로 artifacts/market-analysis.md를 작성하라.
Write 도구를 사용하여 {절대경로}/artifacts/market-analysis.md 파일에 저장하라.
```

**Turn 2 — 교차 리뷰 (buildReviewPrompt)**

```
# 교차 리뷰 (라운드 1)

## 리뷰 대상: artifacts/tech-architecture.md

{tech-architecture.md의 실제 내용}

## 리뷰 기준
기술 선택이 시장 분석 결과와 부합하는지 검토한다.

## 지침
위 산출물을 리뷰하고 코멘트를 작성하라.
Write 도구를 사용하여 {절대경로}/reviews/phase2-research-reviews-tech.md 파일에 저장하라.
구체적이고 실행 가능한 피드백을 제공하라.
```

**Turn 3 — 반영 및 확정 (buildRevisePrompt)**

```
# 산출물 반영 및 확정 (라운드 1)

## 현재 산출물: artifacts/market-analysis.md

{market-analysis.md의 현재 내용}

## 받은 리뷰 코멘트

### 리뷰: phase2-tech-architect-reviews-market.md

{리뷰 파일 내용}

## 지침
위 리뷰 코멘트를 반영하여 산출물을 수정하라.
Write 도구를 사용하여 {절대경로}/artifacts/market-analysis.md 파일에 덮어쓰라.
변경할 내용이 없으면 "변경 사항 없음"이라고 응답하라.
```

---

## Step 7: 메인 오케스트레이터 + CLI

### orchestrator.ts

```typescript
export async function orchestrate(
  orchestratorName: string,
  taskName: string,
  baseDir: string,
  inputRunId?: string,
): Promise<void> {
  // 1. 태스크 파싱: parseTaskFile(join(baseDir, "tasks", `${taskName}.md`))
  // 2. 오케스트레이터 파싱: parseOrchestratorFile(join(baseDir, "orchestrators", `${orchestratorName}.md`))
  // 3. 태스크에 해당 오케스트레이터가 등록되어 있는지 검증
  // 4. 에이전트 로드: orchestratorDef.teamComposition에서 에이전트 이름 수집 → parseAgentFile()
  // 5. Run 생성: runManager.createRun(orchestratorName, taskName, agents, phases, inputRunId)
  // 6. Logger 초기화: new Logger(join(runDir, "logs"))
  // 7. PhaseExecutor 생성
  // 8. Phase 순차 실행 (for of orchestratorDef.phaseAssignment)
  //    - 비용 누적, 에러 체크
  //    - Phase 실패 시 후속 Phase 중단
  // 9. Run 완료: runManager.completeRun(...)
  // 10. 결과 출력: Run ID, 총 비용, 산출물 경로
}
```

### cli.ts

```typescript
import { resolve } from "node:path";
import { orchestrate } from "./orchestrator.js";

const args = process.argv.slice(2);

// 인자 파싱
const orchestratorName = args[0];
const taskName = args[1];
const inputRunIndex = args.indexOf("--input-run");
const inputRunId = inputRunIndex !== -1 ? args[inputRunIndex + 1] : undefined;

if (!orchestratorName || !taskName) {
  console.log("사용법: npm run orchestrate -- <orchestrator> <task> [--input-run <run-id>]");
  console.log("예시:");
  console.log("  npm run orchestrate -- planning-team blog-project");
  console.log("  npm run orchestrate -- dev-team blog-project --input-run 2026-02-25_001_planning-team_blog-project");
  process.exit(1);
}

const baseDir = resolve(process.cwd());
await orchestrate(orchestratorName, taskName, baseDir, inputRunId);
```

---

## 실행 흐름 (planning-team + blog-project)

```
$ npm run orchestrate -- planning-team blog-project

=== 오케스트레이션 시작 ===
  오케스트레이터: planning-team
  태스크: blog-project

태스크 로드: blog-project (프로젝트 방향 확인)
오케스트레이터 로드: planning-team (Phase 3개, 산출물 5개)
에이전트 로드: planner, research, tech-architect, integrator
Run 생성: 2026-02-25_001_planning-team_blog-project

--- Phase 1 (solo) ---
  Planner 실행 중...
    → query({ prompt: "프로젝트 방향 + 지시", systemPrompt: "..." })
    → Write: artifacts/project-vision.md
    ✓ 완료 ($0.0123, 15.2s)

--- Phase 2 (turn) ---
  Turn 1: 초안 작성 (병렬)
    → Promise.all([query(Research), query(TechArchitect)])
    → Write: artifacts/market-analysis.md (draft)
    → Write: artifacts/tech-architecture.md (draft)
    ✓ 완료

  리뷰 라운드 1/2
  Turn 2: 교차 리뷰 (순차)
    → TechArchitect reviews market-analysis
      → Write: reviews/phase2-tech-architect-reviews-market.md
    → Research reviews tech-architecture
      → Write: reviews/phase2-research-reviews-tech.md
    ✓ 완료

  Turn 3: 반영 및 확정 (순차)
    → Research: 리뷰 반영 → artifacts/market-analysis.md (확정)
    → TechArchitect: 리뷰 반영 → artifacts/tech-architecture.md (확정)
    ✓ 완료

--- Phase 3 (solo) ---
  Integrator 실행 중...
    → 모든 artifacts 내용을 프롬프트에 주입
    → Write: artifacts/final-summary.md
    → Write: artifacts/decisions.json
    ✓ 완료

=== 오케스트레이션 완료 ===
  Run ID: 2026-02-25_001_planning-team_blog-project
  총 비용: $0.1234
  산출물: runs/2026-02-25_001_planning-team_blog-project/artifacts/
```

### Run Chaining 실행 흐름 (향후)

```
$ npm run orchestrate -- dev-team blog-project --input-run 2026-02-25_001_planning-team_blog-project

=== 오케스트레이션 시작 ===
  오케스트레이터: dev-team
  태스크: blog-project
  입력 Run: 2026-02-25_001_planning-team_blog-project

선행 Run 산출물 로드: 5개 파일
  → artifacts/project-vision.md
  → artifacts/market-analysis.md
  → artifacts/tech-architecture.md
  → artifacts/final-summary.md
  → artifacts/decisions.json

Run 생성: 2026-02-25_001_dev-team_blog-project (inputRunId 기록)

--- Phase 1 (turn) ---
  ...선행 산출물을 에이전트 프롬프트에 주입하여 실행...
```

---

## 에러 처리 상세

| 시나리오 | 감지 방법 | 처리 |
|---------|-----------|------|
| SDK query() throw | try-catch | 1회 재시도 → 재실패 시 로그 + RunError 추가 |
| result.subtype !== "success" | message.type === "result" 체크 | error_max_turns: 로그 기록, 부분 결과 유지 |
| | | error_during_execution: 1회 재시도 |
| | | error_max_budget_usd: 로그 기록, 사용자 보고 |
| Phase 내 부분 실패 | 결과 배열에서 !success 체크 | 성공한 산출물은 유지, Phase는 "failed" |
| Phase 치명적 오류 | catch 블록 | 후속 Phase 중단, Run status "failed" |
| 의존 아티팩트 없음 | collectPreviousArtifacts에서 빈 결과 | 프롬프트에 "(아직 생성되지 않음)" 표시 |
| 리뷰 파일 없음 | readdir에서 빈 결과 | "(리뷰 코멘트 없음)" 표시, Turn 3 스킵 |
| 오케스트레이터 파일 없음 | parseOrchestratorFile에서 throw | "orchestrators/{name}.md 파일을 찾을 수 없습니다" |
| 태스크에 오케스트레이터 미등록 | orchestrators 배열에서 검색 실패 | "{task}에 {orchestrator} 오케스트레이터가 등록되어 있지 않습니다" |
| inputRunId의 run 디렉토리 없음 | loadInputRunArtifacts에서 throw | "입력 Run {id}을 찾을 수 없습니다" |

---

## 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키 | 예 |

SDK가 자동으로 `process.env.ANTHROPIC_API_KEY`를 읽는다.

---

## 구현 순서

| 순서 | 파일 | 의존성 |
|------|------|--------|
| 1 | package.json, tsconfig.json, .gitignore | 없음 |
| 2 | src/types/*.ts | 없음 |
| 3 | src/parsers/md-utils.ts | 없음 |
| 4 | src/parsers/orchestrator-parser.ts | types, md-utils |
| 5 | src/parsers/task-parser.ts | types, md-utils |
| 6 | src/parsers/agent-parser.ts | types, md-utils |
| 7 | src/logger/logger.ts | types |
| 8 | src/run/run-manager.ts | types |
| 9 | src/agent/agent-runner.ts | types, logger, SDK |
| 10 | src/engine/turn-executor.ts | types, agent-runner, logger |
| 11 | src/engine/phase-executor.ts | types, turn-executor, agent-runner, run-manager, logger |
| 12 | src/orchestrator.ts | parsers, run-manager, phase-executor, logger |
| 13 | src/cli.ts | orchestrator |

---

## 검증 방법

1. `npm install` → 의존성 설치 성공
2. `npx tsc --noEmit` → 타입 체크 통과
3. `npm run orchestrate -- planning-team blog-project` 실행
4. 확인 항목:
   - `runs/YYYY-MM-DD_001_planning-team_blog-project/` 디렉토리 생성
   - `artifacts/` 내 5개 파일 존재 (project-vision.md, market-analysis.md, tech-architecture.md, final-summary.md, decisions.json)
   - `logs/` 내 에이전트별 .jsonl 파일 존재 (planner.jsonl 등)
   - `reviews/` 내 교차 리뷰 파일 존재
   - `run-meta.json`의 orchestrator === "planning-team", status === "completed"
   - 각 로그 파일에 timestamp, phase, turn, status 필드 존재
