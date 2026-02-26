# Orchestrator: QA Team

테스트 및 품질 보증 팀 오케스트레이터. 구현된 프로젝트에 대한 테스트 코드를 작성하고 리뷰한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트          | 역할                                  |
| ----------------- | ------------------------------------- |
| `test-engineer`   | 단위/통합/E2E 테스트 코드 작성        |
| `code-reviewer`   | 테스트 코드 품질 리뷰 (코드 수정 불가)|

## Phase 배정

| Phase | 에이전트        | 실행 방식    |
| ----- | --------------- | ------------ |
| 1     | Test Engineer   | 단독 실행    |
| 2     | Code Reviewer   | 단독 실행    |
| 3     | Test Engineer   | 단독 실행    |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.
테스트 코드는 `runs/{run-id}/project/` 하위에 생성된다.

| 산출물                                | 담당            | 설명                      |
| ------------------------------------- | --------------- | ------------------------- |
| `artifacts/test-manifest.md`          | Test Engineer   | 테스트 파일 목록 및 전략  |
| `artifacts/code-review.md`            | Code Reviewer   | 테스트 코드 리뷰 보고서   |
| `artifacts/test-revision-manifest.md` | Test Engineer   | 리뷰 반영 수정 내역       |

## 실행 흐름

```
Phase 1: Test Engineer (단독) — 테스트 코드 작성
  ├── runs/{run-id}/project/ 에 테스트 파일 생성
  └── artifacts/test-manifest.md 작성

Phase 2: Code Reviewer (단독) — 테스트 코드 리뷰
  ├── project/ 의 테스트 코드 읽기 및 검토
  └── artifacts/code-review.md 작성

Phase 3: Test Engineer (단독) — 리뷰 반영 수정
  ├── code-review.md의 Critical/Major 이슈 수정
  └── artifacts/test-revision-manifest.md 작성
```

## 입력

- 직전 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/file-manifest.md` 또는 `artifacts/backend-manifest.md` (필수)
  - `artifacts/tech-architecture.md` (pass-through로 자동 포함)
- 직전 run의 `project/` 디렉토리를 참조

> 선행 run의 artifacts는 pass-through로 자동 전파되므로, 직전 run만 지정하면 된다.

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 `runs/{run-id}/project/`에 테스트 코드가 추가된 프로젝트이다.
이후 `security-team` 또는 `deploy-team`의 입력으로 전달할 수 있다.
