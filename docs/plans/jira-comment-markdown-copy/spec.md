# Jira 댓글 Markdown 복사 — 계획

- 상태: 진행 중
- 작성일: 2026-10-16
- 기능 ID: `commentMarkdownCopy`

## 목표

이미 달린 Jira 댓글 하나를 Markdown 으로 복사한다. 설명 Markdown 복사와 같은 변환기를 쓰고, 첨부
이미지는 같은 방식(`data:` URI)으로 넣는다. 주 사용처는 Jira → VS Code 다.

## 범위

| 포함 | 제외 |
| --- | --- |
| 읽기 상태 댓글 본문(`.ak-renderer-document`) | 편집 중인 댓글 — 렌더러가 없어 버튼이 빠진다 |
| 댓글마다 버튼 하나 | 여러 댓글 한꺼번에 복사 |
| 첨부 이미지를 `data:` URI 로 | 작성자·시각 머리글 |

## 화면

댓글 아래 동작 줄(답글 · 반응 · 편집 · 더보기) 끝에 `Markdown 복사` 버튼을 둔다. 설명 복사 버튼과
같은 모양이고, 결과는 라벨로 보인다(`복사됨` · `복사됨 · 이미지 n/m` · `복사 실패`).

## 네트워크

첨부 이미지가 있으면 누를 때만 `https://media-cdn.atlassian.com/file/…` 에서 GET 으로, 쿠키 없이 받는다.
설명 Markdown 복사에 허용한 예외(2026-10-12)와 같은 요청이다. 범위를 댓글까지 넓히므로 CLAUDE.md
표를 함께 고친다.

## 설계

- 렌더러 → Markdown + 이미지 넣기는 설명과 똑같다. `src/sites/jira/rendererMarkdown.ts` 로 빼서 둘이 쓴다.
- 댓글은 여러 개라 host 를 댓글 id 별로 들고 있는다. reconcile 은 "지금 읽기 상태인 댓글마다 버튼
  하나"만 맞춘다. 사라진 댓글의 버튼은 치운다.
- 판정(댓글 id 뽑기)은 DOM 과 떼어 단위 테스트한다.
