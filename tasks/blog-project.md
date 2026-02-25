# Task: 나만의 블로그 만들기

## 오케스트레이터

| 단계   | 오케스트레이터   | 설명                               |
| ------ | ---------------- | ---------------------------------- |
| 기획   | `planning-team`  | 아이디어 → 기획서, 기술 설계서     |
| 개발   | `dev-team`       | 기획서 → 코드 구현 (향후)          |

## 프로젝트 방향

- 개발자 대상 기술 블로그를 기본 방향으로 한다.
- 직접 운영하며, 장기적으로 수익화 가능성을 열어둔다.
- MVP 우선 접근: 최소 기능으로 빠르게 배포하고 점진적으로 확장한다.

## 실행 시나리오

```
1. 기획 실행
   $ npm run orchestrate -- planning-team blog-project
   → runs/2026-02-25_001_planning-team_blog-project/artifacts/ 에 기획 산출물 생성

2. 사용자 검토
   → 산출물 확인, 피드백 반영하여 재실행 또는 확정

3. 개발 실행 (향후)
   $ npm run orchestrate -- dev-team blog-project --input-run 2026-02-25_001_planning-team_blog-project
   → 기획 산출물을 입력으로 받아 코드 구현
```
