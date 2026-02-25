# Orchestrator: Dev Team

개발 전문 팀 오케스트레이터. 확정된 기획서와 기술 설계서를 바탕으로 코드를 구현한다.

> **상태**: 향후 설계 예정. 기획 팀 오케스트레이터를 시험 실행한 뒤 구체화한다.

## 팀 구성 (초안)

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트        | 역할                       | 상태        |
| --------------- | -------------------------- | ----------- |
| `frontend-dev`  | UI/페이지 구현             | 향후 정의   |
| `backend-dev`   | API/서버 구현              | 향후 정의   |
| `qa`            | 테스트 코드 작성 및 실행   | 향후 정의   |
| `code-reviewer` | 코드 품질 검토             | 향후 정의   |
| `devops`        | 인프라/배포 설정           | 향후 정의   |

## Phase 배정 (초안)

| Phase | 에이전트                     | 실행 방식                      |
| ----- | ---------------------------- | ------------------------------ |
| 1     | Frontend Dev, Backend Dev    | Turn 기반 (구현 → 리뷰 → 수정)|
| 2     | QA, Code Reviewer            | Turn 기반 (검증 → 피드백)      |
| 3     | DevOps                       | 단독 실행                      |

## 입력

- 기획 팀 run의 산출물 (`--input-run`으로 지정)
  - `artifacts/project-vision.md`
  - `artifacts/market-analysis.md`
  - `artifacts/tech-architecture.md`
  - `artifacts/final-summary.md`
  - `artifacts/decisions.json`

## 미결 설계 사항

기획 팀 시험 실행 결과를 본 뒤 구체화할 항목:

- [ ] 코드 산출물 관리 전략 (Git worktree vs 디렉토리 격리)
- [ ] 에이전트별 허용 도구 범위 (Bash, Write, Edit 등)
- [ ] 빌드/테스트 자동 실행 방법
- [ ] Phase 간 반복 루프 (QA 실패 → 개발자 수정 → 재검증)
- [ ] 코드 통합 방법 (Git merge vs 수동)
