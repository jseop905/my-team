# Project Context: My Team Orchestrator

## 한줄 요약

마크다운으로 팀(오케스트레이터)과 태스크를 정의하면, AI 에이전트들이 Phase/Turn 기반으로 협업하여 산출물을 자동 생성하는 시스템.

## 기술 스택

- **런타임**: Node.js + TypeScript (tsx로 실행)
- **핵심 의존성**: `@anthropic-ai/claude-agent-sdk` — Claude 에이전트를 프로그래밍적으로 실행
- **기타**: zod (유효성 검증), esbuild (빌드)

## 프로젝트 구조

```
my-team/
├── orchestrators/          # 오케스트레이터 정의 (팀 구성 + 실행 흐름)
│   ├── planning-team.md    # 기획팀 (Planner → Research+TechArch → Integrator)
│   └── dev-team.md         # 개발팀 (향후 설계 예정, 초안만 존재)
│
├── agents/                 # 공유 에이전트 풀 (역할 + 프롬프트)
│   ├── planner.md          # 요구사항 정의, MVP 범위 설정
│   ├── research.md         # 시장 분석, 유사 서비스 비교
│   ├── tech-architect.md   # 기술 스택, 아키텍처 설계
│   └── integrator.md       # 모든 산출물 통합 → 최종 보고서
│
├── tasks/                  # 사용자가 작성하는 태스크 (현재 비어있음)
│
├── src/                    # 엔진 소스 코드
│   ├── types/
│   │   ├── agent.ts        # AgentDefinition, CrossReviewDef
│   │   └── engine.ts       # PhaseContext, AgentExecutionResult, LogEntry
│   ├── parsers/
│   │   ├── agent-parser.ts         # agents/*.md 파싱
│   │   └── orchestrator-parser.ts  # orchestrators/*.md 파싱
│   ├── agent/
│   │   └── agent-runner.ts         # Claude Agent SDK query() 호출
│   └── engine/
│       ├── phase-executor.ts       # Phase 단위 실행 (Solo / Turn 분기)
│       ├── turn-executor.ts        # Turn 기반 실행 (초안 → 교차 리뷰 → 반영)
│       └── retry.ts                # 실패 시 1회 재시도
│
└── runs/                   # 실행 결과 (자동 생성, .gitignore)
```

### Git에 추적되지 않는 파일 (소스에서 import하지만 미포함)

- `src/parsers/md-utils.ts` — 마크다운 섹션/테이블 파싱 유틸
- `src/logger/logger.ts` — 로깅 (JSONL 기록)
- `src/run/run-manager.ts` — run 디렉토리/메타데이터 관리
- `src/types/index.ts` — 타입 재export 배럴

이 파일들은 아직 git에 커밋되지 않았거나, 별도 관리되는 상태.

## 핵심 개념

### 3계층 마크다운 구조

| 계층 | 파일 위치 | 역할 |
|------|-----------|------|
| **Task** | `tasks/*.md` | 사용자가 원하는 것 (프로젝트 방향) |
| **Orchestrator** | `orchestrators/*.md` | 어떤 에이전트들이 어떤 순서로 협업할지 |
| **Agent** | `agents/*.md` | 개별 에이전트의 역할, 입출력, 프롬프트 |

### 실행 모델

```
오케스트레이터 = Phase 1 → Phase 2 → Phase 3 → ...
```

#### Phase 실행 방식 (2가지)

1. **Solo** (에이전트 1명) → 단독 실행
2. **Turn 기반** (에이전트 2명+) → 3단계 반복:
   - Turn 1: 초안 작성 (병렬)
   - Turn 2: 교차 리뷰 (순차) — 서로의 산출물을 리뷰
   - Turn 3: 반영 및 확정 (순차) — 리뷰 반영하여 수정
   - Turn 2~3은 최대 2라운드 반복, "변경 사항 없음"이면 조기 종료

### Planning Team 실행 흐름 (현재 유일한 완성된 오케스트레이터)

```
Phase 1: Planner (Solo)
  → artifacts/project-vision.md

Phase 2: Research + Tech Architect (Turn 기반)
  → Turn 1: 병렬로 market-analysis.md, tech-architecture.md 초안
  → Turn 2: 서로 교차 리뷰
  → Turn 3: 리뷰 반영 수정
  → (반복 최대 2회)

Phase 3: Integrator (Solo)
  → artifacts/final-summary.md + artifacts/decisions.json
```

### 체이닝

이전 실행 결과를 다음 오케스트레이터의 입력으로 전달 가능:
```bash
npm run orchestrate -- dev-team my-blog --input-run 2026-02-25_001_planning-team_my-blog
```

## 소스 코드 상세

### 타입 시스템 (`src/types/`)

```typescript
// AgentDefinition — agents/*.md 파싱 결과
{ name, role, inputs, outputFiles, outputSpec, crossReview?, promptTemplate }

// PhaseContext — Phase 실행 시 전달되는 컨텍스트
{ phaseNumber, agents, mode, runDir, artifactsDir, reviewsDir, logsDir, previousArtifacts }

// AgentExecutionResult — 에이전트 실행 결과
{ agentName, success, outputPaths?, resultText, sessionId, costUsd, durationMs, numTurns, error? }
```

### 파서 (`src/parsers/`)

- **agent-parser.ts**: `agents/*.md` → `AgentDefinition` 변환
  - `## 역할`, `## 입력 조건`, `## 출력 규격`, `## 교차 리뷰 역할`, `## 프롬프트 템플릿` 섹션 파싱
  - 출력 파일 필수, 역할/프롬프트 필수 (없으면 에러)
- **orchestrator-parser.ts**: `orchestrators/*.md` → `OrchestratorDefinition` 변환
  - `## 팀 구성`, `## Phase 배정`, `## 산출물 정의` 테이블 파싱
  - Phase 번호 1 이상 검증, 에이전트 필수 검증

### 에이전트 실행 (`src/agent/agent-runner.ts`)

- `@anthropic-ai/claude-agent-sdk`의 `query()` API 사용
- 허용 도구: Read, Write, Edit, Glob, Grep, WebSearch, WebFetch
- 권한 모드: `AGENT_PERMISSION_MODE` 환경변수 (기본: `bypassPermissions`)
- maxTurns: 30 (기본)
- 시스템 프롬프트에 역할, 출력 규격, 작업 지침, 규칙 포함

### 엔진 (`src/engine/`)

- **phase-executor.ts**: Phase 단위 실행 오케스트레이션
  - Solo/Turn 분기, 이전 아티팩트 수집, 실패 시 에러 기록
  - `inputRunId`가 있으면 선행 run의 아티팩트도 수집
- **turn-executor.ts**: Turn 기반 다중 에이전트 실행
  - Turn 1 병렬, Turn 2~3 순차
  - 리뷰 파일명 규칙: `phase{N}-{agentName}-reviews-{targetName}.md`
  - 조기 종료: 모든 에이전트의 resultText에 "변경 사항 없음" 포함 시
- **retry.ts**: 실패 시 1회 재시도, `RetryResult`로 재시도 여부 추적

## 실행 결과 구조 (`runs/`)

```
runs/{run-id}/
├── run-meta.json     # 상태, 비용, 에러, Phase별 상태
├── artifacts/        # 산출물 파일들
├── reviews/          # 교차 리뷰 기록
└── logs/             # 에이전트별 JSONL 로그
```

## CLI

```bash
npm run orchestrate -- <orchestrator> <task> [--input-run <run-id>]
```

## 현재 상태

- **완성**: planning-team 오케스트레이터 + 4개 에이전트 (planner, research, tech-architect, integrator)
- **미완성**: dev-team 오케스트레이터 (초안만 존재, 에이전트 미정의)
- **미커밋 파일**: md-utils, logger, run-manager, types/index 등 일부 유틸/인프라 코드
- **현재 브랜치**: `feat/blog-planning`
