# Orchestrator: Dev Team

개발 전문 팀 오케스트레이터. 확정된 기획서와 기술 설계서를 바탕으로 Next.js 블로그 프로젝트를 구현한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트         | 역할                               |
| ---------------- | ---------------------------------- |
| `frontend-dev`   | Next.js 블로그 전체 구현           |
| `code-reviewer`  | 코드 품질 리뷰 (코드 수정 불가)    |

## Phase 배정

| Phase | 에이전트         | 실행 방식                              |
| ----- | ---------------- | -------------------------------------- |
| 1     | Frontend Dev     | 단독 실행                              |
| 2     | Code Reviewer    | 단독 실행                              |
| 3     | Frontend Dev     | 단독 실행                              |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.
코드 파일은 `runs/{run-id}/project/` 하위에 생성된다.

| 산출물                              | 담당            | 설명                       |
| ----------------------------------- | --------------- | -------------------------- |
| `artifacts/file-manifest.md`        | Frontend Dev    | 생성 파일 목록 및 구조     |
| `artifacts/code-review.md`          | Code Reviewer   | 코드 품질 리뷰 보고서      |
| `artifacts/revision-manifest.md`    | Frontend Dev    | 리뷰 반영 수정 내역        |

## 실행 흐름

```
Phase 1: Frontend Dev (단독) — 프로젝트 전체 구현
  ├── runs/{run-id}/project/ 에 Next.js 프로젝트 코드 생성
  └── artifacts/file-manifest.md 작성

Phase 2: Code Reviewer (단독) — 코드 리뷰
  ├── project/ 전체 코드 읽기 및 검토
  └── artifacts/code-review.md 작성

Phase 3: Frontend Dev (단독) — 리뷰 반영 수정
  ├── code-review.md의 Critical/Major 이슈 수정
  └── artifacts/revision-manifest.md 작성
```

## 입력

- 기획 팀 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/project-vision.md`
  - `artifacts/market-analysis.md`
  - `artifacts/tech-architecture.md`

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 `runs/{run-id}/project/` 디렉토리에 완성된 Next.js 프로젝트이다.
사용자가 해당 디렉토리에서 `pnpm install && pnpm dev`로 실행할 수 있다.
