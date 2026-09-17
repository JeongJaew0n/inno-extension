# Jira 설명 Markdown 복사 — 배경과 실측

## 요청

Confluence의 `본문 Markdown 복사`를 **Jira 업무 설명에도** 넣고 싶다.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-17 |
| 대상 | `NPT` 보드 2145 업무 모달의 **설명** 읽기 화면 (NPT-360) |
| 방법 | 읽기 전용 DOM 조회. **편집기를 열지 않았다** |

## 1. 렌더러가 Confluence와 같다

| 항목 | 값 |
| --- | --- |
| 본문 | **`.ak-renderer-document`** — Confluence 문서 본문과 같은 클래스 |
| 담는 곳 | `[data-testid="issue.views.field.rich-text.description"]` |
| 화면의 렌더러 수 | **1개.** 모두 설명 필드 안에 있었다 |
| 실제 노드 | `H2` · `TABLE` · `STRONG` · `A` · `UL` |

Confluence 변환기(`convertConfluenceBodyToMarkdown`)가 `.ak-renderer-document`를 받아 Markdown을
만든다. **같은 렌더러라 그대로 쓸 수 있다.**

코드 블록도 같은 앵커(`[data-testid="renderer-code-block"]`)를 쓴다.

> 조상은 전부 해시 클래스(`.css-1cjqwzk`, `._1bsb1osq`)다. **`data-testid`로만 잡는다.**

## 2. 버튼 자리

`설명` 라벨 줄이 비어 있다.

```
[data-testid="issue.views.issue-base.common.description.label"]   display: block
└ (해시 클래스 div)                                               display: flex, gap 8px, align-items center
  └ "설명 접기 · 설명 · • 저장하지 않은 변경 사항"    x 72 → 261
                                                     ↑ 여기부터 706 까지 445px 가 빈다
```

라벨 안쪽 flex 줄에 붙이면 `설명` 오른쪽에 자연스럽게 놓인다.

## 3. 확인하지 못한 것

- **댓글에도 `.ak-renderer-document`가 생기는지.** 이번 이슈에서는 설명 것 하나뿐이었다. 댓글이
  달린 이슈에서 다시 봐야 한다. 그래서 구현은 **설명 필드 안에서만** 찾는다.
- 전체 화면 업무 보기(`/browse/...`)의 구조.
- 라벨 안쪽 flex 줄이 해시 클래스라 구조가 바뀔 수 있다. `firstElementChild`에 기대는 부분이다.
