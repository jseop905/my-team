# Orchestrators

팀 단위 워크플로우 정의. 각 오케스트레이터는 에이전트를 조합하여 Phase 단위로 실행한다.

## 전체 목록

| 오케스트레이터 | 파일 | 역할 | 에이전트 |
|---|---|---|---|
| Planning Team | `planning-team.md` | 기획 및 설계 | planner, research, tech-architect, integrator |
| Dev Team | `dev-team.md` | 프론트엔드 구현 | frontend-dev, code-reviewer |
| Fullstack Team | `fullstack-team.md` | 프론트+백엔드 동시 구현 | api-designer, frontend-dev, backend-dev, code-reviewer |
| QA Team | `qa-team.md` | 테스트 코드 작성 | test-engineer, code-reviewer |
| Security Team | `security-team.md` | 보안/성능 감사 | security-auditor, performance-analyst, integrator |
| Deploy Team | `deploy-team.md` | CI/CD 및 배포 구성 | devops, security-auditor |
| Docs Team | `docs-team.md` | 프로젝트 문서화 | technical-writer, code-reviewer |
| Blog Team | `blog-team.md` | 기술 블로그 작성 | research, blog-writer, code-reviewer |

## 실행 흐름 요약

### Planning Team
```
Phase 1: Planner (단독) → project-vision.md
Phase 2: Research + Tech Architect (Turn) → market-analysis.md, tech-architecture.md
Phase 3: Integrator (단독) → final-summary.md, decisions.json
```

### Dev Team
```
Phase 1: Frontend Dev (단독) → 코드 생성 + file-manifest.md
Phase 2: Code Reviewer (단독) → code-review.md
Phase 3: Frontend Dev (단독) → 리뷰 반영 + revision-manifest.md
```

### Fullstack Team
```
Phase 1: API Designer (단독) → api-spec.md
Phase 2: Frontend Dev + Backend Dev (Turn) → 병렬 구현 + 교차 리뷰
Phase 3: Code Reviewer (단독) → code-review.md
Phase 4: Frontend Dev + Backend Dev (Turn) → 리뷰 반영
```

### QA Team
```
Phase 1: Test Engineer (단독) → 테스트 작성 + test-manifest.md
Phase 2: Code Reviewer (단독) → code-review.md
Phase 3: Test Engineer (단독) → 리뷰 반영 + test-revision-manifest.md
```

### Security Team
```
Phase 1: Security Auditor + Performance Analyst (Turn) → 병렬 감사 + 교차 리뷰
Phase 2: Integrator (단독) → final-summary.md, decisions.json
```

### Deploy Team
```
Phase 1: DevOps (단독) → 배포 설정 + devops-manifest.md
Phase 2: Security Auditor (단독) → security-audit.md
Phase 3: DevOps (단독) → 리뷰 반영 + devops-revision-manifest.md
```

### Docs Team
```
Phase 1: Technical Writer (단독) → 문서 작성 + docs-manifest.md
Phase 2: Code Reviewer (단독) → code-review.md
Phase 3: Technical Writer (단독) → 리뷰 반영 + docs-revision-manifest.md
```

### Blog Team
```
Phase 1: Research (단독) → topic-research.md
Phase 2: Blog Writer (단독) → 블로그 게시글 + blog-manifest.md
Phase 3: Code Reviewer (단독) → blog-review.md
Phase 4: Blog Writer (단독) → 리뷰 반영 + blog-revision-manifest.md
```

## 파이프라인 체이닝

`--input-run` 옵션으로 이전 run의 산출물을 다음 오케스트레이터에 전달한다.

```
planning-team → dev-team → qa-team → security-team → deploy-team → docs-team
                    │
                    └─ 또는 fullstack-team (프론트+백엔드 동시)

blog-team (단독 실행 또는 planning-team 이후 체이닝)
```

### Artifacts Pass-through

`--input-run`으로 지정한 선행 run의 artifacts는 현재 run의 artifacts 디렉토리에 자동 복사(pass-through)된다.
따라서 각 단계에서 직전 run만 지정하면 선행 단계의 artifacts가 자동으로 전파된다.

### 실행 예시

```bash
# 1. 기획
npm run orchestrate -- planning-team my-project

# 2. 개발 (기획 결과를 입력으로 → planning artifacts가 dev run에 pass-through)
npm run orchestrate -- dev-team my-project --input-run 2026-02-26_001_planning-team_my-project

# 3. 테스트 (직전 dev run 지정 → planning artifacts도 자동 포함)
npm run orchestrate -- qa-team my-project --input-run 2026-02-26_002_dev-team_my-project

# 4. 보안 감사 (직전 qa run 지정)
npm run orchestrate -- security-team my-project --input-run 2026-02-26_003_qa-team_my-project

# 5. 배포 설정 (직전 security run 지정)
npm run orchestrate -- deploy-team my-project --input-run 2026-02-26_004_security-team_my-project

# 6. 문서화 (직전 deploy run 지정)
npm run orchestrate -- docs-team my-project --input-run 2026-02-26_005_deploy-team_my-project
```

## 오케스트레이터 구조

모든 오케스트레이터 파일은 동일한 마크다운 구조를 따른다:

```
# Orchestrator: {이름}
{한 줄 설명}
## 팀 구성         — 사용하는 에이전트 목록
## Phase 배정      — Phase별 에이전트 + 실행 방식 (단독/Turn)
## 산출물 정의     — 생성되는 아티팩트 목록
## 실행 흐름       — Phase별 상세 흐름도
## 입력            — 필요한 선행 산출물
## 출력 → 다음 단계 — 후속 오케스트레이터 연결
```
