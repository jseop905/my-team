# Agents

공유 에이전트 풀. 각 에이전트는 오케스트레이터에서 조합하여 사용한다.

## 기획 계열

| 에이전트 | 파일 | 역할 | 출력 |
|---|---|---|---|
| Planner | `planner.md` | 요구사항 정의, MVP 범위 설정 | `project-vision.md` |
| Research | `research.md` | 시장 분석, 경쟁 서비스 조사 | `market-analysis.md` |
| Tech Architect | `tech-architect.md` | 기술 스택, 시스템 아키텍처 설계 | `tech-architecture.md` |
| Integrator | `integrator.md` | 범용 산출물 통합, 의사결정 정리 | `final-summary.md`, `decisions.json` |

## 구현 계열

| 에이전트 | 파일 | 역할 | 출력 |
|---|---|---|---|
| Frontend Dev | `frontend-dev.md` | 프론트엔드 전체 구현 | `file-manifest.md` |
| Backend Dev | `backend-dev.md` | 백엔드 API 서버 구현 | `backend-manifest.md` |
| Test Engineer | `test-engineer.md` | 단위/통합/E2E 테스트 작성 | `test-manifest.md` |
| DevOps | `devops.md` | CI/CD, 컨테이너화, 배포 설정 | `devops-manifest.md` |

## 검증 계열

| 에이전트 | 파일 | 역할 | 출력 |
|---|---|---|---|
| Code Reviewer | `code-reviewer.md` | 코드 품질 리뷰 (읽기 전용) | `code-review.md` |
| Security Auditor | `security-auditor.md` | OWASP 기준 보안 취약점 감사 (읽기 전용) | `security-audit.md` |
| Performance Analyst | `performance-analyst.md` | 성능 분석, Lighthouse 예측 (읽기 전용) | `performance-analysis.md` |

## 설계 계열

| 에이전트 | 파일 | 역할 | 출력 |
|---|---|---|---|
| UX Designer | `ux-designer.md` | UI/UX, 와이어프레임, 디자인 시스템 | `ux-design.md` |
| API Designer | `api-designer.md` | API 엔드포인트, 스키마 설계 | `api-spec.md` |
| Data Modeler | `data-modeler.md` | ERD, DB 스키마, 인덱스 전략 | `data-model.md` |

## 콘텐츠 계열

| 에이전트 | 파일 | 역할 | 출력 |
|---|---|---|---|
| Blog Writer | `blog-writer.md` | 기술 블로그 게시글 작성 | `blog-manifest.md` |

## 문서 계열

| 에이전트 | 파일 | 역할 | 출력 |
|---|---|---|---|
| Technical Writer | `technical-writer.md` | README, API 문서, 기여 가이드 | `docs-manifest.md` |

## 에이전트 구조

모든 에이전트 파일은 동일한 마크다운 구조를 따른다:

```
# Agent: {이름}
## 역할           — 에이전트의 책임 범위
## 입력 조건       — 필요한 아티팩트 목록
## 출력 규격       — 생성하는 아티팩트와 포함 내용
## 교차 리뷰 역할  — Turn 기반 실행 시 리뷰 대상 (선택)
## 프롬프트 템플릿  — 에이전트에 주입되는 지침
```
