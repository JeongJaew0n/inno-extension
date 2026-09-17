# Jira 편집기 Markdown 변환 — 배경과 실측

## 요청

Confluence 편집기에 있는 기능(코드블럭 벗기기 + Markdown 변환 + Mermaid 변환)을 **Jira에서도**
쓰고 싶다. 예시로 받은 화면은 업무 모달의 **설명** 필드다.

```
https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2145?selectedIssue=NPT-360
```

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-17 |
| 브라우저 | Chrome 152 |
| 대상 | `NPT` 보드 2145 업무 모달의 **설명** 편집기 |
| 측정 이슈 | **NPT-316** |
| 방법 | 편집기를 열어 DOM·ProseMirror 상태를 읽고, 붙여넣기 결과를 확인한 뒤 **취소** |

> **NPT-360은 쓰지 않았다.** 설명에 `저장하지 않은 변경 사항`(draft-indicator)이 걸려 있어
> 편집기를 열면 사용자의 초안을 건드릴 위험이 있었다. 초안이 없는 NPT-316으로 옮겨서 쟀다.
>
> 측정 후 NPT-316의 설명이 원래 값 그대로이고 초안도 남지 않은 것을 확인했다.

## 1. 편집기는 Confluence와 같은 물건이다

| 항목 | 값 |
| --- | --- |
| 편집기 | `.ProseMirror[contenteditable="true"][role="textbox"]` |
| `id` | **`ak-editor-textarea`** |
| 감싸는 클래스 | `.akEditor`, `.ak-editor-content-area` |
| 노드 속성 | `data-prosemirror-node-name`, `data-prosemirror-content-type` |

**Atlassian 공용 ADF 편집기다.** Confluence 기능이 기대는 DOM 계약이 대부분 그대로 있다.
조상 중에 `confluence-editor-<uuid>` 라는 `data-testid`까지 붙어 있다 — Jira가 같은 편집기
패키지를 쓴다는 뜻이다.

### 조상 사슬

```text
issue.views.field.rich-text.editor-container   ← 설명 필드를 가리키는 앵커
└ common-components-arrow-keys-handler.div
  └ issue.component.editor.default-editor
    └ confluence-editor-<uuid>
      └ .akEditor
        └ click-wrapper
          └ editor-content-container
            └ .ProseMirror#ak-editor-textarea
```

## 2. 버튼 자리가 있다 — `editor-primary-toolbar`

Confluence 기능이 버튼을 붙이는 `[data-testid="editor-primary-toolbar"]`가 **Jira에도 같은
이름으로 있다.** 선택자를 그대로 쓸 수 있다.

## 3. 붙여넣기 Markdown 변환이 **된다**

편집기에 `text/plain`으로 Markdown을 붙여넣고 결과 노드를 읽었다.

넣은 것

````markdown
# 제목1

## 제목2

| 솔루션 | 기능 |
| --- | --- |
| A | 가 |
| B | 나 |

```js
const x = 1;
```

- 항목 하나
- 항목 둘
````

나온 노드

```json
["paragraph", "heading", "table", "codeBlock", "bulletList", "paragraph"]
```

**제목·표·코드블럭·목록이 전부 변환됐다.** 코드블럭은 `js` 구문 강조까지 적용됐다.
Confluence와 같은 파서를 쓴다.

> 첫 줄 `# 제목1`은 heading이 되지 않고 앞 문단에 붙었다. 기존 문단 끝에 붙여넣어 첫 줄이
> 병합된 것으로, Confluence에서 이미 겪은 것과 같은 현상이다. 선택 구간을 문단 **안쪽**으로
> 잡아야 한다는 기존 결론이 Jira에도 그대로 적용된다.

## 4. MAIN world 브리지가 붙는다 — 단 폴백 경로로만

| 경로 | Confluence | **Jira** |
| --- | --- | --- |
| `pmViewDesc` 사슬을 거슬러 `view` 찾기 | 된다 | **안 된다** |
| **React fiber BFS 폴백** (`findEditorViewFromReact`) | 보조 | **이걸로 찾는다** |

폴백 실측값은 **218개 노드 탐색 / depth 6 / 4ms**다. 이미 있는 코드가 그대로 동작한다.

`pmViewDesc` 자체는 살아 있어서 위치·원문은 바로 읽힌다.

```json
{ "posBefore": 0, "nodeSize": 27, "text": "이 페이지가 어떤 역할을 하는지 정의되지 않음" }
```

## 5. 막히는 지점 — `data-local-id`가 없다

Confluence 브리지는 노드를 **`data-local-id`로 주소 지정**한다. isolated world에서 그 id를
읽어 MAIN world로 넘기고, MAIN world가 같은 id를 가진 요소를 찾는 방식이다.

**Jira에서 막 불러온 문서의 노드에는 `data-local-id`가 없다.**

```html
<p data-prosemirror-content-type="node" data-prosemirror-node-name="paragraph" ...>
```

붙여넣기로 **새로 만들어진** 노드에는 붙어 있었다(`data-local-id="86ee049ffd02"`). 즉 이
속성은 Jira에서 **있을 때도 있고 없을 때도 있다.** 주소 지정 수단으로 신뢰할 수 없다.

### 대안

우리가 **직접 표식을 단다.** isolated world에서 대상 요소에 임시 속성을 붙이고, MAIN world가
그 속성으로 찾는다. 두 world는 같은 DOM을 보므로 동작한다. 끝나면 지운다.

이 방식은 Confluence에도 그대로 쓸 수 있어 브리지가 한 가지 주소 방식으로 통일된다.

## 6. Mermaid는 **불가능하다**

편집기 삽입 메뉴(`+`)에서 검색했다.

| 검색어 | 결과 |
| --- | --- |
| `mermaid` | **일치하는 검색 결과 없음** |
| `diagram` | **일치하는 검색 결과 없음** |
| `code` | `코드 조각` — 검색 자체는 정상 동작 |

**Jira에는 Mermaid 앱이 설치돼 있지 않다.** Confluence 기능이 넣는 Forge 확장
(`com.atlassian.ecosystem` / `.../static/mermaid-diagram`)은 Confluence 쪽 설치에 묶여 있다.

Jira에서 Mermaid 코드블럭은 **코드블럭으로 남는다.** 다이어그램으로 바뀌지 않는다.

## 7. 편집기가 한 화면에 여럿이다

Confluence는 편집 화면에 편집기가 하나다. **Jira는 설명과 댓글이 동시에 열릴 수 있고, 각각
자기 `editor-primary-toolbar`를 만든다.**

| 편집기 | 구분되는 조상 `data-testid` |
| --- | --- |
| 설명 | `issue.views.field.rich-text.editor-container` |
| 댓글 | `issue.activity.comment` |

버튼을 붙일 때 **편집기 단위로 짝을 지어야 한다.** 화면에 하나뿐이라고 가정하면 안 된다.

`aria-label`("설명 영역입니다…")은 한국어라 언어 설정에 따라 바뀐다. **앵커로 쓰지 않는다.**

## 8. 확인하지 못한 것

- **전체 화면 이슈 보기**(`/browse/NPT-360`)가 같은 구조인지. 모달에서만 쟀다.
- 30줄이 넘는 코드블럭의 CodeMirror 잘림이 Jira에서도 같은지. Confluence와 같은 컴포넌트로
  보이나 실제로 긴 코드블럭을 넣어보지 않았다.
- 백로그 화면의 상세 패널에서도 설명 편집기가 뜨는지.
- Jira 편집기에 `expand`(확장) 노드가 있는지. Mermaid가 불가능해 지금은 쓸 데가 없다.

## 9. 관련 자료

- `docs/plans/confluence-magic-button/` — Confluence 쪽 설계와 실측
- `src/sites/confluence/features/editorMarkdownToAdf/` — 옮겨올 구현
- `src/sites/confluence/main.ts` — MAIN world 브리지
