# 설계 현황 진단 및 다음 단계

## 현재까지 완성된 것

### 1단계: 시스템 설계 (완료)

| 문서                              | 내용                                                             | 상태 |
| --------------------------------- | ---------------------------------------------------------------- | ---- |
| `orchestrator.md`                 | 공통 실행 인프라: Run 관리, Phase/Turn 규칙, Run Chaining, 로그  | 완료 |
| `orchestrators/planning-team.md`  | 기획 팀 오케스트레이터: 팀 구성, Phase 배정, 산출물              | 완료 |
| `orchestrators/dev-team.md`       | 개발 팀 오케스트레이터: 초안 (향후 구체화)                       | 완료 |
| `agents/planner.md`               | 요구사항 정의, MVP 범위 설정                                     | 완료 |
| `agents/research.md`              | 시장 분석, 유사 서비스 비교                                      | 완료 |
| `agents/tech-architect.md`        | 기술 스택, 아키텍처 설계                                         | 완료 |
| `agents/integrator.md`            | 산출물 통합, 의사결정 정리                                       | 완료 |
| `tasks/blog-project.md`           | 블로그 프로젝트 태스크 (planning-team → dev-team)                | 완료 |

### 2단계: 기술 조사 및 구현 계획 (완료)

| 문서                              | 내용                                                                  | 상태 |
| --------------------------------- | --------------------------------------------------------------------- | ---- |
| `research/implementation-plan.md` | TypeScript + Claude Agent SDK 구현 계획, 타입/파서/엔진/CLI 전체 설계 | 완료 |

> 기술 조사 문서(orchestrator-research.md, claude-agent-team-research.md)는 결론이 설계 문서에 반영되어 삭제함.

---

## 빠져 있는 것: 현재 시스템의 한계

멀티 오케스트레이터 + 공유 에이전트 풀 구조로 전환 완료. 기획 팀(`planning-team`)은 설계가 끝났지만, 개발 팀(`dev-team`)은 초안 상태이다.

```
현재:  아이디어 → [planning-team] → 기획 산출물 → 사용자 검토
향후:  확정된 기획 → [dev-team] → 코드 구현 → [검증] → 동작하는 소프트웨어
```

기획 팀을 먼저 구현/시험한 뒤, 결과를 보고 개발 팀을 구체화한다.

---

## 다음 설계가 필요한 영역

### 영역 1: 개발 에이전트 추가

기획 Phase 이후 실제 코드를 작성하는 에이전트가 없다.

| 추가 에이전트     | 역할                     | 입력                 | 출력                     |
| ----------------- | ------------------------ | -------------------- | ------------------------ |
| **Frontend Dev**  | UI/페이지 구현           | tech-architecture.md | 프론트엔드 코드          |
| **Backend Dev**   | API/서버 구현            | tech-architecture.md | 백엔드 코드              |
| **DevOps**        | 인프라/배포 설정         | tech-architecture.md | CI/CD, Docker, 배포 설정 |
| **QA/Tester**     | 테스트 코드 작성 및 실행 | 구현된 코드          | 테스트 결과 리포트       |
| **Code Reviewer** | 코드 품질 검토           | 구현된 코드          | 리뷰 코멘트, 수정 제안   |

고려 사항:

- 코딩 에이전트는 문서가 아닌 **실제 파일 시스템에 코드를 쓴다** → 출력 규격이 완전히 달라짐
- 코드 충돌 관리: 같은 파일을 여러 에이전트가 수정할 가능성 → **Worktree 격리** 또는 **파일 단위 lock** 필요
- 빌드/테스트 실행: Bash 도구를 허용해야 하므로 보안 정책 재검토 필요

### 영역 2: dev-team 오케스트레이터 워크플로우 설계

`orchestrators/dev-team.md`에 초안만 있다. 구체화가 필요한 항목:

```
dev-team Phase 구성 (초안):
  Phase 1: Frontend Dev + Backend Dev (구현, Turn 기반)
  Phase 2: QA + Code Reviewer (검증, Turn 기반)
  Phase 3: DevOps (배포, 단독)
```

고려 사항:

- Phase 1의 병렬 실행: Frontend/Backend를 동시에 돌리면 Worktree 격리 필수
- Phase 2의 Turn 기반 리뷰: QA가 버그를 발견하면 → 개발 에이전트에게 수정 요청 → 재검증 루프
- **Phase 간 반복**: Phase 1↔2 왕복이 빈번 → 반복 메커니즘 필요

### 영역 3: 오케스트레이터/태스크 확장

현재 오케스트레이터 2개(`planning-team`, `dev-team`), 태스크 1개(`blog-project`). 확장 가능한 방향:

| 오케스트레이터 | 에이전트 조합 | 용도 |
| -------------- | ------------- | ---- |
| `planning-team` (현재) | Planner, Research, Tech Architect, Integrator | 기획/설계 |
| `dev-team` (초안) | Frontend Dev, Backend Dev, QA, Code Reviewer, DevOps | 코드 구현 |
| `bugfix-team` (향후) | Debugger, Code Reviewer, QA | 버그 수정 |
| `refactor-team` (향후) | Code Analyzer, Refactorer, QA | 리팩토링 |
| `docs-team` (향후) | Doc Writer, Code Analyzer | 문서화 |

구조적 장점:
- 에이전트는 공유 풀이므로, 같은 `qa` 에이전트를 `dev-team`과 `bugfix-team`에서 재사용
- 태스크(`blog-project`)는 사용할 오케스트레이터만 지정하면 됨
- 새 오케스트레이터 추가 = `orchestrators/` 에 MD 파일 하나 추가

### 영역 4: 코드 산출물 관리

현재 산출물은 전부 Markdown/JSON 문서다. 코드 산출물은 근본적으로 다르다.

| 항목      | 문서 산출물 (현재)     | 코드 산출물 (필요)                     |
| --------- | ---------------------- | -------------------------------------- |
| 저장 위치 | `runs/{id}/artifacts/` | 별도 프로젝트 디렉토리 또는 Git 저장소 |
| 파일 수   | 5개 내외               | 수십~수백 개                           |
| 검증 방법 | 사람이 읽고 판단       | 빌드 성공, 테스트 통과                 |
| 충돌 관리 | 파일별 격리로 충분     | Git merge/rebase 필요                  |
| 버전 관리 | run-meta.json          | Git commit history                     |

설계가 필요한 부분:

- 코드 프로젝트의 초기 scaffolding을 누가 하는가 (Tech Architect? DevOps?)
- 에이전트별 작업 디렉토리 격리 전략 (Git worktree vs 디렉토리 분리)
- 코드 통합 시점과 방법 (Git merge? 수동 통합?)

### 영역 5: 피드백 루프와 인간 개입 지점

현재 설계에서 사용자 개입은 "중요한 결정" 시에만 발생한다. 개발 Phase에서는 더 세밀한 피드백이 필요하다.

추가로 설계해야 할 것:

- **중간 데모/프리뷰**: Phase 4 완료 후 사용자가 실제 동작을 확인하고 피드백
- **우선순위 재조정**: 개발 중 발견된 이슈로 MVP 범위 변경
- **수동 개입 후 재개**: 사용자가 코드를 직접 수정한 뒤 이어서 실행
- **승인 게이트**: 특정 Phase 완료 후 사용자 승인 없이 다음으로 넘어가지 않는 옵션

### 영역 6: 비용과 품질 관리

구현 계획(`implementation-plan.md`)에서 비용 추적은 있지만, 관리 전략은 없다.

설계가 필요한 부분:

- **예산 한도**: 태스크별/run별 최대 비용 설정
- **모델 티어 전략**: 어떤 에이전트에 Opus/Sonnet/Haiku를 쓸 것인가
  - 기획 에이전트(Planner, Integrator) → Opus (고품질 판단 필요)
  - 코딩 에이전트(Frontend, Backend) → Sonnet (비용 효율)
  - 탐색/리뷰(Research, QA) → Sonnet 또는 Haiku (반복 작업)
- **품질 게이트**: 각 Phase 완료 시 산출물 품질 자동 검증
  - 문서: 필수 섹션 존재 여부 체크
  - 코드: 빌드 성공 + 테스트 통과 여부

---

## 결정 사항

**Q1. 개발 에이전트의 범위** → **(C) 기획 팀 먼저 구현, 개발 팀은 이후 별도 진행**

- 기획 팀이 산출물을 만들면, 사용자가 직접 검토하고 피드백한다.
- 최종 확정된 기획/설계 문서를 개발 팀에게 전달하는 2단계 구조.
- 기획과 개발 사이에 **사용자 검토 게이트**가 존재한다.

```
[기획 팀 Run]                    [사용자 검토]              [개발 팀 Run]
아이디어 → Planner →         →  사용자가 기획안 검토  →   개발 에이전트가
Research + Tech Architect →      피드백 → 재실행 or       확정된 기획서 기반으로
Integrator → 기획 산출물         확정                      코드 구현 (향후 설계)
```

**Q2. 첫 번째 시험 실행 시점** → **(B) 기획 Phase 먼저 구현 후 시험**

- `implementation-plan.md` 기반으로 기획 팀 오케스트레이터를 먼저 코드로 구현한다.
- `blog-project` 태스크로 시험 실행하여 산출물 품질을 검증한다.
- 검증 결과를 바탕으로 개발 팀 설계를 진행한다.

---

## 확정 진행 순서

```
[현재 위치]
     │
     ▼
① 기획 팀 오케스트레이터 구현 ─── implementation-plan.md 기반 코드 작성
     │                              (TypeScript + Claude Agent SDK)
     ▼
② 시험 실행 ─── npm run orchestrate -- blog-project
     │            Phase 1~3 실행, 산출물 품질 확인
     ▼
③ 사용자 검토 프로세스 설계 ─── 기획 산출물 검토/피드백/재실행 워크플로우
     │
     ▼
④ 개발 팀 설계 ─── 시험 결과 기반으로 개발 에이전트/Phase 설계
     │                (영역 1~4를 이 시점에 구체화)
     ▼
⑤ 개발 팀 구현 및 통합
     │
     ▼
⑥ 태스크 템플릿 확장 ─── 버그 수정, 리팩토링 등
```

---

## 다음 할 일: ① 기획 팀 오케스트레이터 구현

`research/implementation-plan.md`에 전체 코드 설계가 이미 있다. 멀티 오케스트레이터 구조를 반영하여 구현:

| 순서 | 파일                        | 설명                                          |
| ---- | --------------------------- | --------------------------------------------- |
| 1    | package.json, tsconfig.json | 프로젝트 초기화                               |
| 2    | src/types/\*.ts             | 타입 정의 (OrchestratorDefinition 추가)       |
| 3    | src/parsers/\*.ts           | MD 파서 (오케스트레이터, 태스크, 에이전트)    |
| 4    | src/logger/logger.ts        | JSONL 로그 기록                               |
| 5    | src/run/run-manager.ts      | Run ID 생성 (오케스트레이터명 포함), 디렉토리 |
| 6    | src/agent/agent-runner.ts   | SDK query() 래핑                              |
| 7    | src/engine/\*.ts            | Phase/Turn 실행 엔진                          |
| 8    | src/orchestrator.ts         | 메인 오케스트레이터 (오케스트레이터 MD 로드)  |
| 9    | src/cli.ts                  | CLI 진입점                                    |

CLI 변경:
```
# 기존 (단일 오케스트레이터)
npm run orchestrate -- blog-project

# 변경 (멀티 오케스트레이터)
npm run orchestrate -- planning-team blog-project
npm run orchestrate -- dev-team blog-project --input-run {run-id}
```

준비되면 `npm install` → `npx tsc --noEmit` → `npm run orchestrate -- planning-team blog-project` 순서로 검증한다.
