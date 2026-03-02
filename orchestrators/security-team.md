# Orchestrator: Security Team

보안 감사 팀 오케스트레이터. 구현된 프로젝트에 대한 보안 및 성능 감사를 수행하고 종합 리포트를 작성한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트              | 역할                                    |
| --------------------- | --------------------------------------- |
| `security-auditor`    | 보안 취약점 분석 (코드 수정 불가)       |
| `performance-analyst` | 성능 분석 및 최적화 제안 (코드 수정 불가)|
| `integrator`          | 감사 결과 종합 리포트 작성              |

## Phase 배정

| Phase | 에이전트                              | 실행 방식                              |
| ----- | ------------------------------------- | -------------------------------------- |
| 1     | Security Auditor, Performance Analyst | Turn 기반 (분석 → 교차 리뷰 → 반영)   |
| 2     | Integrator                            | 단독 실행                              |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.

| 산출물                              | 담당                | 설명                     |
| ----------------------------------- | ------------------- | ------------------------ |
| `artifacts/security-audit.md`       | Security Auditor    | 보안 취약점 보고서       |
| `artifacts/performance-analysis.md` | Performance Analyst | 성능 분석 보고서         |
| `artifacts/final-summary.md`        | Integrator          | 종합 감사 리포트         |
| `artifacts/decisions.json`          | Integrator          | 우선순위별 조치 사항     |

## 실행 흐름

```
Phase 1: Security Auditor + Performance Analyst (Turn 기반) — 병렬 감사
  ├── Turn 1 - 분석 (병렬)
  │   ├── Security Auditor → artifacts/security-audit.md (초안)
  │   └── Performance Analyst → artifacts/performance-analysis.md (초안)
  ├── Turn 2 - 교차 리뷰 (순차)
  │   ├── Security Auditor → 성능 최적화가 보안에 미치는 영향 리뷰
  │   └── Performance Analyst → 보안 조치가 성능에 미치는 영향 리뷰
  └── Turn 3 - 반영 및 확정 (순차)
      ├── Security Auditor → artifacts/security-audit.md (확정)
      └── Performance Analyst → artifacts/performance-analysis.md (확정)

Phase 2: Integrator (단독) — 종합 리포트
  ├── 보안/성능 보고서를 통합하여 우선순위 정리
  ├── artifacts/final-summary.md 작성
  └── artifacts/decisions.json 작성
```

## 입력

- 직전 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/file-manifest.md` 또는 `artifacts/backend-manifest.md` (필수)
  - `artifacts/tech-architecture.md` (pass-through로 자동 포함)
- 직전 run의 `project/` 디렉토리를 참조

> 선행 run의 artifacts는 pass-through로 자동 전파되므로, 직전 run만 지정하면 된다.

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 보안/성능 종합 감사 리포트이다.
개발 팀이 Critical/High 이슈를 수정한 후 `deploy-team`으로 진행할 수 있다.

```
dev-team run → security-team run → (이슈 수정) → deploy-team run
```
