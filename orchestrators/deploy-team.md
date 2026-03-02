# Orchestrator: Deploy Team

배포 파이프라인 팀 오케스트레이터. CI/CD 및 배포 설정을 구성하고 보안 관점에서 검증한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트           | 역할                                       |
| ------------------ | ------------------------------------------ |
| `devops`           | CI/CD, Dockerfile, 배포 설정 구성          |
| `security-auditor` | 배포 설정 보안 리뷰 (코드 수정 불가)       |

## Phase 배정

| Phase | 에이전트          | 실행 방식    |
| ----- | ----------------- | ------------ |
| 1     | DevOps            | 단독 실행    |
| 2     | Security Auditor  | 단독 실행    |
| 3     | DevOps            | 단독 실행    |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.
설정 파일은 `runs/{run-id}/project/` 하위에 생성된다.

| 산출물                                  | 담당             | 설명                        |
| --------------------------------------- | ---------------- | --------------------------- |
| `artifacts/devops-manifest.md`          | DevOps           | 생성한 설정 파일 목록       |
| `artifacts/security-audit.md`           | Security Auditor | 배포 설정 보안 리뷰 보고서  |
| `artifacts/devops-revision-manifest.md` | DevOps           | 보안 리뷰 반영 수정 내역    |

## 실행 흐름

```
Phase 1: DevOps (단독) — CI/CD 및 배포 설정 구성
  ├── runs/{run-id}/project/ 에 설정 파일 생성
  │   ├── .github/workflows/ (GitHub Actions)
  │   ├── Dockerfile, docker-compose.yml (필요 시)
  │   └── 환경별 설정 파일
  └── artifacts/devops-manifest.md 작성

Phase 2: Security Auditor (단독) — 배포 설정 보안 리뷰
  ├── CI/CD 파이프라인, Docker 설정, 환경변수 관리 검토
  └── artifacts/security-audit.md 작성

Phase 3: DevOps (단독) — 보안 리뷰 반영
  ├── security-audit.md의 Critical/High 이슈 수정
  └── artifacts/devops-revision-manifest.md 작성
```

## 입력

- 직전 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/tech-architecture.md` (pass-through로 자동 포함)
  - `artifacts/file-manifest.md` 또는 `artifacts/backend-manifest.md` (필수)
- 직전 run의 `project/` 디렉토리를 참조

> 선행 run의 artifacts는 pass-through로 자동 전파되므로, 직전 run만 지정하면 된다.

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 `runs/{run-id}/project/`에 CI/CD 및 배포 설정이 추가된 프로젝트이다.
이후 `docs-team`으로 문서화를 진행하거나 바로 배포에 활용할 수 있다.

```
dev-team run → deploy-team run → docs-team run
```
