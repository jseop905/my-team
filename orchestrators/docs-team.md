# Orchestrator: Docs Team

문서화 팀 오케스트레이터. 프로젝트의 기술 문서를 작성하고 코드와의 정합성을 검증한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트           | 역할                                          |
| ------------------ | --------------------------------------------- |
| `technical-writer` | README, API 문서, 가이드 작성                 |
| `code-reviewer`    | 코드-문서 정합성 리뷰 (코드 수정 불가)        |

## Phase 배정

| Phase | 에이전트          | 실행 방식    |
| ----- | ----------------- | ------------ |
| 1     | Technical Writer  | 단독 실행    |
| 2     | Code Reviewer     | 단독 실행    |
| 3     | Technical Writer  | 단독 실행    |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.
문서 파일은 `runs/{run-id}/project/` 하위에 생성된다.

| 산출물                                 | 담당              | 설명                       |
| -------------------------------------- | ----------------- | -------------------------- |
| `artifacts/docs-manifest.md`           | Technical Writer  | 생성한 문서 파일 목록      |
| `artifacts/code-review.md`             | Code Reviewer     | 코드-문서 정합성 리뷰      |
| `artifacts/docs-revision-manifest.md`  | Technical Writer  | 리뷰 반영 수정 내역        |

## 실행 흐름

```
Phase 1: Technical Writer (단독) — 문서 작성
  ├── runs/{run-id}/project/ 에 문서 파일 생성
  │   ├── README.md
  │   ├── CONTRIBUTING.md (필요 시)
  │   └── docs/ 하위 문서 (필요 시)
  └── artifacts/docs-manifest.md 작성

Phase 2: Code Reviewer (단독) — 코드-문서 정합성 리뷰
  ├── 문서의 설치 가이드, API 레퍼런스가 실제 코드와 일치하는지 검토
  └── artifacts/code-review.md 작성

Phase 3: Technical Writer (단독) — 리뷰 반영
  ├── code-review.md의 Critical/Major 이슈 수정
  └── artifacts/docs-revision-manifest.md 작성
```

## 입력

- 개발 팀 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/project-vision.md`
  - `artifacts/tech-architecture.md`
  - `artifacts/file-manifest.md` 또는 `artifacts/backend-manifest.md`
  - `artifacts/api-spec.md` (있을 경우)
  - `artifacts/devops-manifest.md` (있을 경우)
- 개발 팀 run의 `project/` 디렉토리를 참조

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 `runs/{run-id}/project/`에 문서가 추가된 프로젝트이다.
프로젝트 전체 파이프라인의 마지막 단계로 사용한다.

```
planning-team → dev-team → qa-team → security-team → deploy-team → docs-team
```
