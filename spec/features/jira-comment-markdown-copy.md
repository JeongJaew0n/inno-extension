# Jira 댓글 Markdown 복사

- 상태: Active
- 최종 갱신일: 2026-10-16
- 내부 기능 ID: `commentMarkdownCopy`
- 기본값: ON

## 한 줄 요약

이미 달린 **댓글 하나**를 제목·표·목록·링크까지 Markdown으로 바꿔 클립보드에 넣는다. 첨부 이미지는
설명 Markdown 복사처럼 데이터로 함께 넣는다.

## 배경

설명 Markdown 복사는 설명만 옮긴다. 조사 결과나 남은 조치가 댓글에 쌓이는 업무가 많아 댓글도 같은
방식으로 옮길 수 있어야 한다. 댓글 본문도 설명과 같은 `.ak-renderer-document` 라 변환기를 그대로 쓴다.

## 화면

댓글 아래 동작 줄(답글 · 반응 · 편집 · 더보기) **끝**에 `Markdown 복사` 버튼이 댓글마다 하나 붙는다.

| 결과 | 라벨 |
| --- | --- |
| 성공 | `복사됨`, 이미지가 있으면 `복사됨 · 이미지 n/m` |
| 실패 | `복사 실패` (원인은 콘솔) |

## 동작 계약

- 대상은 `[data-testid="issue.activity.comments-list"]` 안의 댓글이다. 댓글 루트는
  `issue-comment-base.ui.comment.ak-comment.<숫자 id>` 이고, 같은 접두사의 `-header` · `-body` ·
  `-footer` 는 루트가 아니다.
- 복사하는 것은 그 댓글의 `-body` 안 렌더러뿐이다. 작성자·시각 머리글과 다른 댓글은 들어가지 않는다.
- **읽기 상태 댓글에만 붙는다.** 편집 중인 댓글은 렌더러가 없어 버튼이 빠지고, 편집을 닫으면 다시 붙는다.
- reconcile 은 멱등이다. 제자리에 있는 버튼은 두고, 사라진 댓글의 버튼은 치운다.
- 클릭 시점에 본문을 다시 찾는다. 그 사이 편집을 시작했으면 `복사 실패` 다.
- 변환과 이미지 넣기는 설명 복사와 같은 `src/sites/jira/rendererMarkdown.ts` 를 쓴다.

## 보내는 요청

| 언제 | 요청 |
| --- | --- |
| 첨부 이미지가 있는 댓글에서 버튼을 누를 때만 | `GET https://media-cdn.atlassian.com/file/…` — 화면에 그려진 주소 그대로, 쿠키 없이 |

설명 Markdown 복사에 허용한 예외(2026-10-12)와 같은 요청이다. 2026-10-16 에 범위를 댓글까지 넓혔다.
화면을 여는 것만으로는 요청하지 않는다.

## 비목표

- 편집 중인 댓글 복사
- 여러 댓글 한꺼번에 복사

## 알려진 리스크

- [가정] 답글(스레드) 댓글도 같은 `ak-comment.<id>` 구조일 것으로 본다. 답글이 달린 업무에서 재 보지 않았다.
- [미정] 실제 Jira 에서 버튼 위치·복사 결과를 확인하지 않았다. e2e 는 실측한 DOM 모양을 본뜬 가짜 화면이다.

## 변경 이력

- 2026-10-16: 추가.

## 관련 자료

- [계획](../../docs/plans/jira-comment-markdown-copy/spec.md)
- [조사 기록](../../docs/plans/jira-comment-markdown-copy/context.md)
- [설명 Markdown 복사](./jira-description-markdown-copy.md)
