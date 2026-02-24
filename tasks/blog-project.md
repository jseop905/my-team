# Task: 나만의 블로그 만들기

## 프로젝트 방향

- 개발자 대상 기술 블로그를 기본 방향으로 한다.
- 직접 운영하며, 장기적으로 수익화 가능성을 열어둔다.
- MVP 우선 접근: 최소 기능으로 빠르게 배포하고 점진적으로 확장한다.

## 팀 배정

| Phase | 에이전트 | 실행 방식 |
|-------|----------|-----------|
| 1 | Planner | 단독 실행 |
| 2 | Research, Tech Architect | Turn 기반 (초안 → 교차 리뷰 → 반영) |
| 3 | Integrator | 단독 실행 (모든 산출물 완료 후) |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.

| 산출물 | 담당 | 설명 |
|--------|------|------|
| `artifacts/project-vision.md` | Planner | 요구사항 및 MVP 범위 |
| `artifacts/market-analysis.md` | Research | 시장 및 유사 서비스 분석 |
| `artifacts/tech-architecture.md` | Tech Architect | 기술 스택 및 아키텍처 |
| `artifacts/final-summary.md` | Integrator | 종합 보고서 |
| `artifacts/decisions.json` | Integrator | 의사결정 이력 |

## 실행 흐름

```
Phase 1: Planner
  └── artifacts/project-vision.md 작성

Phase 2: Research + Tech Architect (Turn 기반)
  ├── Turn 1 - 초안 작성 (병렬)
  │   ├── Research → artifacts/market-analysis.md (draft)
  │   └── Tech Architect → artifacts/tech-architecture.md (draft)
  ├── Turn 2 - 교차 리뷰 (순차)
  │   ├── Tech Architect → reviews/phase2-tech-reviews-market.md
  │   └── Research → reviews/phase2-research-reviews-tech.md
  └── Turn 3 - 반영 및 확정 (순차)
      ├── Research → artifacts/market-analysis.md (확정)
      └── Tech Architect → artifacts/tech-architecture.md (확정)

Phase 3: Integrator
  ├── artifacts/final-summary.md 작성
  └── artifacts/decisions.json 작성
```
