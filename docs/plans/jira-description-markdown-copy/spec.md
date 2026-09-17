# Jira 설명 Markdown 복사 — 설계

- 상태: **구현 중**
- 작성일: 2026-09-17
- 실측: [context.md](./context.md)

## 1. 결론 먼저

**변환기를 그대로 쓴다.** Jira 설명 읽기 화면이 Confluence 문서 본문과 **같은 `.ak-renderer-document`** 다.
새로 만들 것은 버튼과 앵커뿐이다.

## 2. 공용화

`pageMarkdownCopy/markdown.ts`는 이름만 Confluence일 뿐 사이트 의존이 없다. `platform` 으로 올린다.

| 지금 | 옮길 곳 |
| --- | --- |
| `sites/confluence/features/pageMarkdownCopy/markdown.ts` | `platform/editor/renderer-to-markdown.ts` |
| `MARKDOWN_IGNORED_ELEMENTS` (confluence/selectors) | `platform/editor/selectors.ts` |
| `convertConfluenceBodyToMarkdown` | `convertRendererToMarkdown` |

ADF 렌더러는 Confluence만의 것이 아니다. 이름에서 사이트를 뗀다.

## 3. 동작 계약

| 항목 | 값 |
| --- | --- |
| 대상 | `[data-testid="issue.views.field.rich-text.description"] .ak-renderer-document` |
| 버튼 자리 | `설명` 라벨 안쪽 flex 줄 |
| 클립보드 | **평문 Markdown** (`writePlainText`) |
| 기본값 | **ON** — 복사는 아무것도 바꾸지 않는다 |

- 설명이 비어 있으면 버튼을 붙이지 않는다.
- **편집 중에는 붙이지 않는다.** 편집기가 열리면 렌더러가 사라지므로 자연히 빠진다.
- 댓글은 대상이 아니다. 설명 필드 **안에서만** 렌더러를 찾는다.

## 4. 하지 않는 것

| 항목 | 이유 |
| --- | --- |
| 제목·댓글 복사 | 요청 범위 밖 |
| 리치 텍스트(HTML) 클립보드 | Confluence 쪽과 같이 평문만 |
| Confluence 기능의 동작 변경 | 공용화는 **동작을 바꾸지 않는 리팩터링**이어야 한다 |
