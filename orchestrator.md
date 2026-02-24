# Orchestrator

오케스트레이션 기반 AI 에이전트 팀 실행 시스템이다.
사용자로부터 태스크를 받으면, 에이전트 정의(`agents/`)와 태스크 명세(`tasks/`)를 읽어 워크플로우를 구성하고 실행한다.

## 시스템 구동 절차

1. 사용자로부터 태스크 명령을 받는다.
2. `tasks/{task-name}.md`를 읽어 프로젝트 방향, 팀 배정, 산출물 정의를 파악한다.
3. 배정된 에이전트의 정의를 `agents/{agent-name}.md`에서 읽는다.
4. `runs/` 하위에 새로운 run 디렉토리를 생성한다.
5. 워크플로우(Phase, Turn)를 구성하고 순서대로 실행한다.
6. 모든 Phase 완료 후 `run-meta.json`을 갱신하고 사용자에게 보고한다.

## 실행 인스턴스 (Run)

모든 실행은 독립된 run 단위로 격리한다.
같은 태스크를 여러 번 실행하거나, A/B 실험, 프롬프트 변경 후 재실행 시에도 이전 결과가 보존된다.

### Run ID 네이밍 규칙

```
{날짜}_{순번}_{task-name}
```

- 날짜: `YYYY-MM-DD` 형식
- 순번: 같은 날 동일 태스크 실행 시 001부터 증가
- 예시:
  - `2026-02-24_001_blog-project`
  - `2026-02-24_002_blog-project` (같은 날 재실행)

### Run 메타데이터

각 run 디렉토리에 `run-meta.json`을 생성하여 실행 상태를 추적한다.

```json
{
  "id": "2026-02-24_001_blog-project",
  "task": "blog-project",
  "status": "completed",
  "startedAt": "2026-02-24T10:30:00Z",
  "completedAt": "2026-02-24T11:00:00Z",
  "agents": ["planner", "research", "tech-architect", "integrator"],
  "phases": [
    { "phase": 1, "status": "completed" },
    { "phase": 2, "status": "completed", "reviewRounds": 1 },
    { "phase": 3, "status": "completed" }
  ]
}
```

### Run 디렉토리 구조

```
runs/{run-id}/
├── run-meta.json        # 실행 메타데이터
├── logs/                # 이 run의 에이전트 실행 로그
│   ├── planner.jsonl
│   ├── research.jsonl
│   ├── tech-architect.jsonl
│   └── integrator.jsonl
├── artifacts/           # 이 run의 산출물 (중간 + 최종)
│   ├── project-vision.md
│   ├── market-analysis.md
│   ├── tech-architecture.md
│   ├── final-summary.md
│   └── decisions.json
└── reviews/             # 이 run의 교차 리뷰 기록
    ├── phase2-tech-reviews-market.md
    └── phase2-research-reviews-tech.md
```

### 최신 Run 조회

최신 실행 결과가 필요한 경우, 오케스트레이터가 `runs/` 하위 디렉토리를 스캔하여 가장 최근 완료된 run을 찾는다. 별도의 `outputs/` 디렉토리는 두지 않는다.

## 실행 모델

### Phase

Phase는 워크플로우의 큰 단계이다. 각 Phase는 순차적으로 실행된다.

- Phase 내 에이전트가 1명이면 단독 실행한다.
- Phase 내 에이전트가 2명 이상이면 Turn 기반으로 실행한다.

### Turn (반복 리뷰)

복수 에이전트가 참여하는 Phase에서 산출물 품질을 높이기 위한 반복 구조이다.

```
Turn 1 - 초안 작성
  각 에이전트가 자신의 산출물을 독립적으로 작성한다. (병렬 가능)

Turn 2 - 교차 리뷰 (순차 실행)
  각 에이전트가 다른 에이전트의 산출물을 리뷰하고 코멘트를 작성한다.
  - 같은 파일을 동시에 수정하지 않는다.
  - 리뷰 코멘트는 runs/{run-id}/reviews/ 디렉토리에 기록한다.
  - 파일명: reviews/{phase}-{reviewer}-reviews-{target}.md

Turn 3 - 반영 및 확정 (순차 실행)
  각 에이전트가 받은 코멘트를 반영하여 산출물을 확정한다.
```

규칙:
- 최대 리뷰 라운드: **2회** (Turn 2~3을 최대 2번 반복 가능)
- 리뷰 후 변경 사항이 없으면 즉시 확정한다.
- 라운드 초과 시 현재 상태로 확정하고 Integrator에게 넘긴다.

## 운영 원칙

1. 각 에이전트는 자신의 역할에만 집중한다.
2. 모든 결과는 로그로 남긴다.
3. 산출물은 태스크 명세(`tasks/`)에 정의된 파일로 한정한다.
4. 중요한 결정이 필요한 경우에만 사용자에게 질문한다.
5. 중요한 결정이란:
   - 기술 스택 선택
   - 아키텍처 구조 변경
   - MVP 범위 확정 또는 축소
   - 수익 모델 결정
   - 비용 또는 장기 확장성에 영향이 있는 선택
6. 질문은 반드시 선택지, 기본값, 영향도를 포함한다.

## 에러 및 충돌 처리

- **에이전트 실패 시**: 해당 에이전트를 1회 재시도한다. 재시도 실패 시 로그에 에러를 기록하고 사용자에게 보고한다.
- **결론 충돌 시**: Integrator가 충돌 내용을 `decisions.json`에 기록하고, 양측 근거를 비교하여 판단한다. 판단이 어려운 경우 사용자에게 질문한다.
- **의존 산출물 지연 시**: 대기하되, 가용한 입력만으로 먼저 작업을 시작할 수 있다면 부분 실행 후 업데이트한다.

## 로그 구조

각 에이전트의 로그는 `runs/{run-id}/logs/` 디렉토리에 저장한다.

파일명 규칙: `logs/{agent-name}.jsonl`

로그 항목 형식 (JSON Lines):

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "agent": "planner",
  "phase": 1,
  "turn": 1,
  "status": "in_progress | completed | error",
  "message": "요구사항 정의 시작",
  "artifact": "artifacts/project-vision.md"
}
```

## 디렉토리 구조

```
my-team/
├── orchestrator.md          # 시스템 설계 (이 파일)
├── agents/                  # 에이전트 정의
│   ├── planner.md
│   ├── research.md
│   ├── tech-architect.md
│   └── integrator.md
├── tasks/                   # 태스크 명세
│   └── blog-project.md
└── runs/                    # 실행 인스턴스 (run별 격리)
    └── {run-id}/
        ├── run-meta.json
        ├── logs/
        ├── artifacts/
        └── reviews/
```
