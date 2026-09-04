# 매직버튼 — 배경과 현재 구조

## 요청

편집기 toolbar의 버튼 2개(`Mermaid -> ADF`, `코드블럭 -> ADF`)를 사용자가 헷갈려한다.
하나의 버튼으로 합치고, 내부적으로 두 동작을 담당하되 **최상위가 코드블럭으로 감싸져 있을 때만
벗기도록** 조건을 검사한다. 이름은 미정이며 추천을 받는다.

## 현재 두 버튼이 하는 일

### `코드블럭 -> ADF`

본문 안 **모든** 코드블럭을 대상으로 한다.

1. `EDITOR_CODE_BLOCK`으로 코드블럭 전체를 모은다
2. `hasValidMermaidPair()`인 블록(= 이미 변환된 Mermaid 원본)만 제외한다
3. 나머지 전부의 원문을 브리지로 읽는다
4. `codeBlockMarkdownToAdfPayload()`로 Markdown -> ADF HTML을 만든다
5. 뒤에서부터 `replaceCodeBlockWithAdf()`로 원위치 교체한다

### `Mermaid -> ADF`

첫 유효 선언이 Mermaid diagram type인 코드블럭만 대상으로 한다.

1. `mayBeMermaidCodeBlock()`(DOM 원문)으로 후보를 좁힌다
2. 짝 없는 기존 Mermaid 컴포넌트가 있으면 **중단**한다
3. 후보 원문을 브리지로 읽고 `isMermaidCodeBlockSource()`로 확정한다
4. 뒤에서부터 `replaceMermaidCodeBlock()`으로 `extension + 접힌 원본` 교체한다

## 현재 구조에서 확인한 사실

### 사용 순서가 사실상 고정돼 있다

Markdown 원문에는 ` ```mermaid ` 펜스가 들어 있다. 그 펜스는 `코드블럭 -> ADF`를 거쳐야
비로소 **개별 Mermaid 코드블럭**이 된다. 따라서 항상 이 순서다.

```mermaid
flowchart LR
    P["Markdown 원문이 든 코드블럭"] --> A["코드블럭 -> ADF"]
    A --> B["본문 ADF + mermaid 코드블럭 N개"]
    B --> C["Mermaid -> ADF"]
    C --> D["extension + 접힌 원본"]
```

**두 버튼은 독립적인 선택지가 아니라 한 작업의 1단계·2단계다.** 사용자가 헷갈리는 것이 자연스럽다.

### `코드블럭 -> ADF`는 실제 코드까지 변환한다

spec이 이 한계를 명시하고 있다.

> `코드블럭 -> ADF`는 실제 코드와 Markdown 원문을 구분하지 않는다. 사용자가 버튼을 누르면
> 보호 대상 Mermaid 원본을 제외한 **모든** 코드 블록이 대상이 된다.

실측 문서(`edit-v2/2246476007`)의 코드블럭 18개 구성이다.

| 종류 | 개수 |
| --- | --- |
| Mermaid | 7 |
| Kotlin · YAML · JSON · HTTP 요청 등 **실제 코드** | 11 |

**이 문서에서 지금 `코드블럭 -> ADF`를 누르면 실제 코드 11개가 전부 산문으로 풀린다.**
사용자가 제안한 조건 검사는 편의 개선이 아니라 **이 사고를 막는 안전장치**다.

## 편집기 DOM 구조 (실측)

최상위 판정을 구현하려면 알아야 하는 사실이다.

편집 본문 최상위 자식 601개의 구성이다.

| 형태 | 개수 |
| --- | --- |
| `paragraph` | 502 |
| `heading` | 38 |
| `blockquote` | 22 |
| `rule` | 11 |
| **`.fabric-editor-breakout-mark > codeBlock`** | **11** |
| **`.fabric-editor-breakout-mark > expand`** | **7** |
| `extension` | 7 |
| `.ProseMirror-widget` | 3 |

두 가지가 함정이다.

1. **코드블럭은 최상위 직계 자식이 아니다.** `.fabric-editor-breakout-mark` 래퍼에 감싸여 있다.
   `editor.children`에서 `[data-prosemirror-node-name="codeBlock"]`를 찾으면 **하나도 안 나온다.**
   `findEditorTopLevelNode()`가 코드블럭에 대해 이 래퍼를 돌려주는 것과 같은 이유다.
2. **`.ProseMirror-widget`는 콘텐츠가 아니다.** 데코레이션이므로 "최상위 노드 수"를 셀 때 빼야 한다.

## 관련 파일

| 파일 | 역할 |
| --- | --- |
| `src/sites/confluence/features/editorMarkdownToAdf/runtime.ts` | 버튼 host, 두 핸들러, 교체·검증 로직 |
| `src/sites/confluence/features/editorMarkdownToAdf/code-block-to-adf.ts` | `codeBlockMarkdownToAdfPayload()` |
| `src/sites/confluence/features/editorMarkdownToAdf/mermaid.ts` | `isMermaidCodeBlockSource()` 등 |
| `src/sites/confluence/adf/markdown-to-adf.ts` | Markdown -> ADF 변환기 본체 |
| `spec/features/confluence-adf-markdown-tools.md` | 두 기능의 행동 계약 |

## 관련 이슈

- [Popup 결과는 Mermaid -> ADF로 변환할 수 없다](../../issue/2026-09-02-mermaid-conversion-fails-inside-expand.md)
- [30줄 넘는 코드블럭은 검증을 통과할 수 없다](../../issue/2026-09-04-mermaid-verification-reads-truncated-dom.md)
- [빈 줄이 있으면 표가 변환되지 않는다](../../issue/2026-09-04-markdown-table-broken-by-blank-lines.md)
