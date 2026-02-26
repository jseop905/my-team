# Orchestrator: Fullstack Team

풀스택 개발 팀 오케스트레이터. API 설계 후 프론트엔드와 백엔드를 병렬로 구현하고 통합 리뷰를 수행한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트        | 역할                                  |
| --------------- | ------------------------------------- |
| `api-designer`  | API 스펙 설계                         |
| `frontend-dev`  | 프론트엔드 구현                       |
| `backend-dev`   | 백엔드 API 구현                       |
| `code-reviewer` | 통합 코드 리뷰 (코드 수정 불가)       |

## Phase 배정

| Phase | 에이전트                     | 실행 방식                              |
| ----- | ---------------------------- | -------------------------------------- |
| 1     | API Designer                 | 단독 실행                              |
| 2     | Frontend Dev, Backend Dev    | Turn 기반 (초안 → 교차 리뷰 → 반영)   |
| 3     | Code Reviewer                | 단독 실행                              |
| 4     | Frontend Dev, Backend Dev    | Turn 기반 (수정 → 교차 리뷰 → 반영)   |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.
코드 파일은 `runs/{run-id}/project/` 하위에 생성된다.

| 산출물                                   | 담당           | 설명                      |
| ---------------------------------------- | -------------- | ------------------------- |
| `artifacts/api-spec.md`                  | API Designer   | API 엔드포인트 명세       |
| `artifacts/file-manifest.md`             | Frontend Dev   | 프론트엔드 파일 목록      |
| `artifacts/backend-manifest.md`          | Backend Dev    | 백엔드 파일 목록          |
| `artifacts/code-review.md`               | Code Reviewer  | 통합 코드 리뷰 보고서     |
| `artifacts/revision-manifest.md`         | Frontend Dev   | 프론트엔드 수정 내역      |
| `artifacts/backend-revision-manifest.md` | Backend Dev    | 백엔드 수정 내역          |

## 실행 흐름

```
Phase 1: API Designer (단독) — API 스펙 설계
  └── artifacts/api-spec.md 작성

Phase 2: Frontend Dev + Backend Dev (Turn 기반) — 병렬 구현
  ├── Turn 1 - 초안 작성 (병렬)
  │   ├── Frontend Dev → project/ 에 프론트엔드 코드 생성, artifacts/file-manifest.md
  │   └── Backend Dev → project/ 에 백엔드 코드 생성, artifacts/backend-manifest.md
  ├── Turn 2 - 교차 리뷰 (순차)
  │   ├── Frontend Dev → Backend Dev의 API 구현이 스펙과 일치하는지 리뷰
  │   └── Backend Dev → Frontend Dev의 API 호출이 스펙과 일치하는지 리뷰
  └── Turn 3 - 반영 및 확정 (순차)
      ├── Frontend Dev → 리뷰 반영
      └── Backend Dev → 리뷰 반영

Phase 3: Code Reviewer (단독) — 통합 코드 리뷰
  ├── 프론트엔드 + 백엔드 전체 코드 읽기 및 검토
  └── artifacts/code-review.md 작성

Phase 4: Frontend Dev + Backend Dev (Turn 기반) — 리뷰 반영
  ├── Turn 1 - 수정 (병렬)
  │   ├── Frontend Dev → code-review.md의 프론트엔드 이슈 수정
  │   └── Backend Dev → code-review.md의 백엔드 이슈 수정
  ├── Turn 2 - 교차 리뷰 (순차)
  │   ├── Frontend Dev → Backend Dev 수정 사항 확인
  │   └── Backend Dev → Frontend Dev 수정 사항 확인
  └── Turn 3 - 반영 및 확정 (순차)
      ├── Frontend Dev → artifacts/revision-manifest.md 작성
      └── Backend Dev → artifacts/backend-revision-manifest.md 작성
```

## 입력

- 기획 팀 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/project-vision.md`
  - `artifacts/market-analysis.md`
  - `artifacts/tech-architecture.md`

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 `runs/{run-id}/project/`에 프론트엔드+백엔드가 통합된 프로젝트이다.
이후 `qa-team`, `security-team`, `deploy-team`의 입력으로 전달할 수 있다.
