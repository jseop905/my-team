# My Team Orchestrator

마크다운으로 팀과 태스크를 정의하면, AI 에이전트들이 협업하여 산출물을 생성하는 시스템.

[Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) 기반.

## 빠른 시작

### 1. 설치

```bash
npm install
```

### 2. 환경변수

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `ANTHROPIC_API_KEY` | O | Anthropic API 키 |
| `AGENT_PERMISSION_MODE` | X | 에이전트 권한 모드 (기본: `bypassPermissions`) |

### 3. 태스크 작성

`tasks/` 디렉토리에 마크다운 파일을 만든다. 이것만 작성하면 바로 실행할 수 있다.

```markdown
# Task: 나만의 블로그

개인 기술 블로그를 만들고 싶다.

## 오케스트레이터

| 단계 | 오케스트레이터  | 설명               |
| ---- | --------------- | ------------------ |
| 기획 | `planning-team` | 기획 및 설계       |

## 프로젝트 방향

- 개인 기술 블로그를 만든다.
- 마크다운으로 글을 쓰고 싶다.
- 깔끔하고 미니멀한 디자인.
- 다크모드 지원.
- 모바일 반응형.
```

**`## 프로젝트 방향`** 에 러프한 아이디어를 자유롭게 적으면 된다. 구체적일수록 좋지만, 대략적이어도 괜찮다.

- 원하는 기능, 분위기
- 기술 스택 선호 (예: "Next.js로 만들고 싶다")
- 일정 제약 (예: "2주 안에 MVP")
- 기타 제약 조건

### 4. 실행

```bash
npm run orchestrate -- <오케스트레이터> <태스크>
```

```bash
# 예시: planning-team으로 my-blog 태스크 실행
npm run orchestrate -- planning-team my-blog
```

오케스트레이터에 정의된 에이전트들이 협업하여 `runs/` 디렉토리에 산출물을 자동 생성한다.

### 5. 체이닝 (선택)

이전 실행 결과를 다음 오케스트레이터의 입력으로 연결할 수 있다.

```bash
npm run orchestrate -- dev-team my-blog --input-run 2026-02-25_001_planning-team_my-blog
```

## 프로젝트 구조

```
my-team/
├── orchestrators/       # 오케스트레이터 정의 (팀 구성, Phase, 산출물)
├── agents/              # 공유 에이전트 풀 (역할, 입출력, 프롬프트)
├── tasks/               # 태스크 (프로젝트 방향) ← 사용자가 작성
├── src/                 # 엔진 소스 코드
└── runs/                # 실행 결과 (자동 생성)
```

| 디렉토리 | 사용자가 편집 | 설명 |
|-----------|:------------:|------|
| `tasks/` | O | 프로젝트 방향, 사용할 오케스트레이터 지정 |
| `orchestrators/` | O | 팀 구성, Phase 순서, 실행 방식 정의 |
| `agents/` | O | 에이전트 역할, 입출력, 프롬프트 템플릿 |
| `runs/` | X | 실행 결과 (자동 생성) |
| `src/` | X | 엔진 코드 |

## 실행 모델

### Phase

워크플로우의 큰 단계. 순차 실행된다.

- 에이전트 1명 → **단독 실행 (Solo)**
- 에이전트 2명 이상 → **Turn 기반 실행**

### Turn (반복 리뷰)

복수 에이전트가 참여하는 Phase에서 산출물 품질을 높이기 위한 반복 구조.

```
Turn 1: 초안 작성 (병렬)
  ├── 에이전트 A → 산출물 A
  └── 에이전트 B → 산출물 B

Turn 2: 교차 리뷰 (순차)
  ├── 에이전트 A → 산출물 B 리뷰
  └── 에이전트 B → 산출물 A 리뷰

Turn 3: 반영 및 확정 (순차)
  ├── 에이전트 A → 리뷰 반영하여 수정
  └── 에이전트 B → 리뷰 반영하여 수정

(Turn 2~3을 최대 2라운드 반복, 변경 없으면 조기 종료)
```

## 실행 결과

```
runs/2026-02-25_001_planning-team_my-blog/
├── run-meta.json     # 실행 메타데이터 (상태, 비용, 에러)
├── artifacts/        # 산출물
├── reviews/          # 교차 리뷰 기록
└── logs/             # 에이전트별 JSONL 로그
```

## 마크다운 정의 파일 작성법

코드 수정 없이 마크다운 파일만으로 팀 구성과 워크플로우를 변경할 수 있다.

### 오케스트레이터 정의 (`orchestrators/*.md`)

```markdown
# Orchestrator: 오케스트레이터 이름

설명 문단.

## 팀 구성

| 에이전트         | 역할                 |
| ---------------- | -------------------- |
| `에이전트-이름`  | 역할 설명            |

## Phase 배정

| Phase | 에이전트           | 실행 방식                            |
| ----- | ------------------ | ------------------------------------ |
| 1     | 에이전트A          | 단독 실행                            |
| 2     | 에이전트B, 에이전트C | Turn 기반 (초안 → 교차 리뷰 → 반영) |

## 산출물 정의

| 산출물                   | 담당      | 설명         |
| ------------------------ | --------- | ------------ |
| `artifacts/파일명.md`    | 에이전트A | 설명         |

## 실행 흐름

(텍스트 다이어그램, 참고용)
```

**규칙**:
- 팀 구성의 에이전트 이름은 `agents/` 파일명과 일치해야 한다.
- Phase 배정에서 `단독 실행` → Solo 모드, 그 외 → Turn 모드.
- 에이전트가 2명 이상이면 쉼표로 구분한다.
- 산출물 경로는 `artifacts/` 접두사를 포함한다.

### 에이전트 정의 (`agents/*.md`)

```markdown
# Agent: 에이전트 이름

## 역할

에이전트가 수행할 역할에 대한 설명.

## 입력 조건

- `artifacts/의존-파일.md` (필수)

## 출력 규격

- 파일: `artifacts/출력-파일.md`
- 파일: `artifacts/추가-출력.json` (복수 출력 파일 가능)
- 포함 내용:
  - 항목 1
  - 항목 2

## 교차 리뷰 역할

(선택 사항 - Turn 기반 실행 시에만)

- Turn 2에서 `artifacts/리뷰대상.md`를 리뷰한다.
- 리뷰 기준을 여기에 기술한다.

## 프롬프트 템플릿

\```
에이전트에게 전달할 시스템 프롬프트 내용.
역할, 출력 형식, 주의 사항 등을 기술한다.
\```
```

**파싱 규칙**:

| 섹션 | 파싱 방식 |
|------|-----------|
| `## 입력 조건` | 백틱으로 감싼 `artifacts/...` 경로를 추출 |
| `## 출력 규격` | `파일: \`경로\`` 패턴에서 파일 경로 추출 (복수 가능) |
| `## 교차 리뷰 역할` | 첫 번째 `artifacts/...` 경로 = 리뷰 대상, 두 번째 줄 = 리뷰 기준 |
| `## 프롬프트 템플릿` | 코드 블록 내부 텍스트를 추출 |

### 에이전트 사용 가능 도구

| 도구 | 용도 |
|------|------|
| `Read` | 파일 읽기 |
| `Write` | 파일 생성/덮어쓰기 |
| `Edit` | 파일 수정 |
| `Glob` | 파일 패턴 검색 |
| `Grep` | 파일 내용 검색 |
| `WebSearch` | 웹 검색 |
| `WebFetch` | 웹 페이지 내용 가져오기 |

## 커스텀 팀 구성 예시

### 새 에이전트 추가

`agents/` 디렉토리에 마크다운 파일을 생성한다.

```markdown
# Agent: UX Designer

## 역할

사용자 경험을 설계하고 와이어프레임을 제작한다.

## 입력 조건

- `artifacts/project-vision.md` (필수)

## 출력 규격

- 파일: `artifacts/ux-wireframes.md`
- 포함 내용:
  - 사용자 플로우
  - 주요 화면 와이어프레임 (텍스트 기반)
  - UI/UX 가이드라인

## 프롬프트 템플릿

\```
너는 UX 디자인 전문가이다.
프로젝트 비전을 바탕으로 사용자 경험을 설계하라.
모바일 우선 접근으로 설계하라.
\```
```

### 새 오케스트레이터 추가

`orchestrators/` 디렉토리에 마크다운 파일을 생성하고, 기존 에이전트를 조합하거나 새 에이전트를 추가하여 팀을 구성한다.

```markdown
# Orchestrator: Design Team

UX 중심 기획 팀.

## 팀 구성

| 에이전트      | 역할             |
| ------------- | ---------------- |
| `planner`     | 요구사항 정의    |
| `ux-designer` | UX 설계          |
| `integrator`  | 통합 보고서      |

## Phase 배정

| Phase | 에이전트              | 실행 방식                            |
| ----- | --------------------- | ------------------------------------ |
| 1     | Planner               | 단독 실행                            |
| 2     | Planner, UX Designer  | Turn 기반 (초안 → 교차 리뷰 → 반영) |
| 3     | Integrator            | 단독 실행                            |

## 산출물 정의

| 산출물                        | 담당        | 설명           |
| ----------------------------- | ----------- | -------------- |
| `artifacts/project-vision.md` | Planner     | 요구사항       |
| `artifacts/ux-wireframes.md`  | UX Designer | UX 설계        |
| `artifacts/final-summary.md`  | Integrator  | 종합 보고서    |

## 실행 흐름

Phase 1 → Phase 2 (Turn 기반 협업) → Phase 3 (통합)
```

실행:

```bash
npm run orchestrate -- design-team blog-project
```

## 실행 결과 상세

### run-meta.json

```json
{
  "id": "2026-02-25_001_planning-team_blog-project",
  "orchestrator": "planning-team",
  "task": "blog-project",
  "status": "completed",
  "startedAt": "2026-02-25T10:00:00.000Z",
  "completedAt": "2026-02-25T10:15:00.000Z",
  "agents": ["planner", "research", "tech-architect", "integrator"],
  "phases": [
    { "phase": 1, "status": "completed" },
    { "phase": 2, "status": "completed" },
    { "phase": 3, "status": "completed" }
  ],
  "totalCostUsd": 0.1234,
  "errors": []
}
```

### 로그 파일 (JSONL)

각 에이전트별 `logs/{에이전트}.jsonl`에 실행 기록이 저장된다.

```json
{"timestamp":"...","agent":"planner","phase":1,"turn":1,"status":"in_progress","message":"에이전트 실행 시작"}
{"timestamp":"...","agent":"planner","phase":1,"turn":1,"status":"completed","message":"실행 완료","artifact":"artifacts/project-vision.md","costUsd":0.03,"durationMs":150000}
```

## CLI 레퍼런스

```
npm run orchestrate -- <orchestrator> <task> [--input-run <run-id>]
```

| 인자 | 필수 | 설명 |
|------|:----:|------|
| `orchestrator` | O | `orchestrators/` 디렉토리의 파일명 (확장자 제외) |
| `task` | O | `tasks/` 디렉토리의 파일명 (확장자 제외) |
| `--input-run` | X | 이전 Run ID. 해당 Run의 산출물을 입력으로 사용 |
