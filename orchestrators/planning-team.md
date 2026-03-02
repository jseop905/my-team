# Orchestrator: Planning Team

기획 전문 팀 오케스트레이터. 아이디어를 구체적인 기획서와 기술 설계서로 변환한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트         | 역할                       |
| ---------------- | -------------------------- |
| `planner`        | 요구사항 정의, MVP 범위    |
| `research`       | 시장 분석, 유사 서비스     |
| `tech-architect` | 기술 스택, 아키텍처 설계   |
| `integrator`     | 산출물 통합, 의사결정 정리 |

## Phase 배정

| Phase | 에이전트                   | 실행 방식                              |
| ----- | -------------------------- | -------------------------------------- |
| 1     | Planner                    | 단독 실행                              |
| 2     | Research, Tech Architect   | Turn 기반 (초안 → 교차 리뷰 → 반영)   |
| 3     | Integrator                 | 단독 실행 (모든 산출물 완료 후)        |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.

| 산출물                          | 담당           | 설명                 |
| ------------------------------- | -------------- | -------------------- |
| `artifacts/project-vision.md`   | Planner        | 요구사항 및 MVP 범위 |
| `artifacts/market-analysis.md`  | Research       | 시장 및 유사 서비스  |
| `artifacts/tech-architecture.md`| Tech Architect | 기술 스택 및 아키텍처|
| `artifacts/final-summary.md`    | Integrator     | 종합 보고서          |
| `artifacts/decisions.json`      | Integrator     | 의사결정 이력        |

## 실행 흐름

```
Phase 1: Planner (단독)
  └── artifacts/project-vision.md 작성

Phase 2: Research + Tech Architect (Turn 기반)
  ├── Turn 1 - 초안 작성 (병렬)
  │   ├── Research → artifacts/market-analysis.md (draft)
  │   └── Tech Architect → artifacts/tech-architecture.md (draft)
  ├── Turn 2 - 교차 리뷰 (순차)
  │   ├── Tech Architect → reviews/phase2-tech-architect-reviews-market-analysis.md
  │   └── Research → reviews/phase2-research-reviews-tech-architecture.md
  └── Turn 3 - 반영 및 확정 (순차)
      ├── Research → artifacts/market-analysis.md (확정)
      └── Tech Architect → artifacts/tech-architecture.md (확정)

Phase 3: Integrator (단독)
  ├── artifacts/final-summary.md 작성
  └── artifacts/decisions.json 작성
```

## 입력

- 태스크 명세(`tasks/*.md`)의 "프로젝트 방향" 섹션

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 사용자가 검토한 뒤, 개발 팀 오케스트레이터(`dev-team`)의 입력으로 전달할 수 있다.

```
planning-team run → 사용자 검토/피드백 → (재실행 or 확정) → dev-team run
```
