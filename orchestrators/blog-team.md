# Orchestrator: Blog Team

기술 블로그 작성 팀 오케스트레이터. 아이디어를 리서치하고 기술 블로그 게시글로 변환한다.

## 팀 구성

공유 에이전트 풀(`agents/`)에서 다음 에이전트를 사용한다:

| 에이전트        | 역할                                          |
| --------------- | --------------------------------------------- |
| `research`      | 주제 리서치, 관련 자료 및 사례 조사           |
| `blog-writer`   | 블로그 게시글 작성                            |
| `code-reviewer` | 게시글 리뷰 (기술 정확성, 가독성, 구조)       |

## Phase 배정

| Phase | 에이전트      | 실행 방식 |
| ----- | ------------- | --------- |
| 1     | Research      | 단독 실행 |
| 2     | Blog Writer   | 단독 실행 |
| 3     | Code Reviewer | 단독 실행 |
| 4     | Blog Writer   | 단독 실행 |

## 산출물 정의

모든 산출물은 `runs/{run-id}/artifacts/` 하위에 생성된다.
블로그 게시글은 `runs/{run-id}/project/` 하위에 생성된다.

| 산출물                                  | 담당          | 설명                       |
| --------------------------------------- | ------------- | -------------------------- |
| `artifacts/topic-research.md`           | Research      | 주제 리서치 결과           |
| `artifacts/blog-manifest.md`            | Blog Writer   | 생성한 게시글 파일 목록    |
| `artifacts/blog-review.md`              | Code Reviewer | 게시글 품질 리뷰           |
| `artifacts/blog-revision-manifest.md`   | Blog Writer   | 리뷰 반영 수정 내역        |

## 실행 흐름

```
Phase 1: Research (단독) — 주제 리서치
  ├── 블로그 주제에 대한 기술 트렌드, 사례, 레퍼런스 조사
  └── artifacts/topic-research.md 작성

Phase 2: Blog Writer (단독) — 블로그 게시글 초안 작성
  ├── runs/{run-id}/project/ 에 블로그 파일 생성
  │   └── blog-post.md
  └── artifacts/blog-manifest.md 작성

Phase 3: Code Reviewer (단독) — 게시글 리뷰
  ├── 기술적 정확성, 코드 예시 검증, 가독성, 구조 검토
  └── artifacts/blog-review.md 작성

Phase 4: Blog Writer (단독) — 리뷰 반영
  ├── blog-review.md의 Critical/Major 이슈 수정
  └── artifacts/blog-revision-manifest.md 작성
```

## 입력

- 태스크 명세(`tasks/*.md`)의 "블로그 주제" 섹션
  - 블로그 아이디어 또는 주제 키워드
  - 대상 독자 (선택)
  - 원하는 깊이/분량 (선택)

## 출력 → 다음 단계

이 오케스트레이터의 산출물은 `runs/{run-id}/project/`에 블로그 게시글이 포함된 결과물이다.
독립 실행하거나, 기획 팀 이후에 체이닝하여 사용할 수 있다.

```
단독 실행: blog-team (아이디어 → 블로그 게시글)
체이닝:    planning-team → blog-team (기획 → 블로그 게시글)
```
