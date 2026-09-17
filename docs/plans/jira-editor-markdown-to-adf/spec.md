# Jira 편집기 Markdown 변환 — 설계

- 상태: **결정 완료(2026-09-17) · 구현 중**
- 작성일: 2026-09-17
- 실측: [context.md](./context.md)

## 1. 결론 먼저

**된다. 단 Mermaid는 빼야 한다.**

| 관문 | 결과 |
| --- | --- |
| 편집기가 같은 물건인가 | **같다.** Atlassian 공용 ADF 편집기 |
| 버튼 붙일 자리가 있는가 | **있다.** `editor-primary-toolbar` 가 같은 이름으로 존재 |
| 붙여넣기 Markdown 변환이 되는가 | **된다.** 제목·표·코드블럭·목록 모두 |
| MAIN world 브리지가 붙는가 | **붙는다.** 기존 React fiber 폴백 경로로 |
| Mermaid 다이어그램이 되는가 | **안 된다.** Jira에 Mermaid 앱이 없다 |

Confluence 기능의 **세 단계 중 두 단계**를 옮긴다.

| 단계 | Confluence | Jira |
| --- | --- | --- |
| 1. 코드블럭 벗기기 | O | **O** |
| 2. 문단 Markdown 변환 | O | **O** |
| 3. Mermaid 변환 | O | **X — 불가** |

## 2. Mermaid를 뺀다는 것의 의미

Jira 편집기 삽입 메뉴에 `mermaid`·`diagram` 어느 것도 없다. Confluence 기능이 심는 Forge 확장은
Confluence 쪽 앱 설치에 묶여 있어, Jira에 같은 노드를 넣어도 렌더링할 주체가 없다.

**Mermaid 코드블럭은 코드블럭으로 남는다.** 원문이 사라지지 않으므로 손해는 없고, 다이어그램이
되지 않을 뿐이다.

> 앱을 깔면 되는 문제가 아니다. Marketplace 설치는 사이트 관리자 권한이고 이 확장의 범위 밖이다.

## 3. 옮기는 방법 — 복사가 아니라 공용화

Confluence 구현은 `src/sites/confluence/` 안에 있다. 그대로 복사하면 같은 코드가 두 벌이 되고,
한쪽만 고치는 사고가 난다. **사이트와 무관한 부분을 `src/platform/` 으로 올린다.**

| 지금 위치 | 옮길 곳 | 이유 |
| --- | --- | --- |
| `adf/markdown-to-adf.ts` | `platform/` | 사이트와 무관한 순수 변환기 |
| `editorMarkdownToAdf/markdown-detection.ts` | `platform/` | 순수 판정. 사이트 의존 없음 |
| `editorMarkdownToAdf/adf-to-editor-html.ts` | `platform/` | ADF → 편집기 HTML. 공용 |
| `editorMarkdownToAdf/code-block.ts` | `platform/` | 코드블럭 DOM 읽기 |
| `confluence/main.ts` (브리지) | `platform/` + 사이트별 얇은 진입점 | 같은 ProseMirror다 |
| `editorMarkdownToAdf/mermaid.ts` | **Confluence에 남긴다** | Confluence 전용 |
| `editorMarkdownToAdf/runtime.ts` | 공통 뼈대 + 사이트별 설정 | 단계 구성이 사이트마다 다르다 |

런타임은 **단계 목록을 주입받는 형태**로 바꾼다.

```text
Confluence : [코드블럭 벗기기] → [문단 Markdown] → [Mermaid]
Jira       : [코드블럭 벗기기] → [문단 Markdown]
```

## 4. 브리지의 주소 지정을 바꾼다

지금 브리지는 노드를 `data-local-id` 로 찾는다. **Jira에는 그 속성이 없을 때가 있다.**

대신 **우리가 표식을 단다.**

```text
isolated world                      MAIN world
─────────────────────────────       ──────────────────────────
node.setAttribute(MARK, uuid)
  → CustomEvent(mark: uuid)  ───▶   document.querySelector(`[MARK="uuid"]`)
                                    pmViewDesc 로 위치·원문 처리
  ◀───────────────  응답
node.removeAttribute(MARK)
```

두 world는 같은 DOM을 본다. `data-local-id` 유무와 무관하게 동작하고, **Confluence도 같은 길로
통일된다.**

## 5. 적용 범위

| 화면 | 포함 | 비고 |
| --- | --- | --- |
| 업무 모달의 **설명** 편집기 | **포함** | 요청받은 화면 |
| 전체 화면 업무 보기(`/browse/...`)의 설명 | **포함 예정** | 같은 컴포넌트로 보이나 **미측정** |
| **댓글** 편집기 | **결정 필요** | 5-1 참조 |
| 업무 **제목** | 제외 | 편집기가 아니다 |

앵커는 `[data-testid="issue.views.field.rich-text.editor-container"]` 안의 편집기로 잡는다.
`aria-label` 은 한국어라 언어 설정에 따라 바뀐다. **쓰지 않는다.**

### 5-1. 편집기가 여럿이다

Jira는 설명과 댓글이 **동시에 열릴 수 있고**, 각각 `editor-primary-toolbar` 를 만든다.
Confluence처럼 "화면에 편집기 하나"를 가정하면 버튼이 엉뚱한 편집기에 붙는다.

**툴바와 편집기를 짝지어 관리한다.** 툴바에서 위로 올라가 자기 편집기를 찾고, 그 편집기만
대상으로 삼는다.

## 6. 위험

| 위험 | 완화 |
| --- | --- |
| 사용자의 **저장하지 않은 초안**을 건드림 | 버튼은 편집기가 열려 있을 때만 나타난다. 변환은 사용자가 누를 때만 일어나고, `저장` 은 우리가 누르지 않는다 |
| 엉뚱한 편집기(댓글)에 버튼이 붙음 | 편집기 단위로 짝지어 관리(5-1) |
| Mermaid를 기대한 사용자가 실망 | **기능 설명과 실패 라벨에 "Jira는 Mermaid 미지원"을 명시한다** |
| 긴 코드블럭의 DOM 잘림 | Confluence와 같은 대응(브리지 `read-node` 로 원문 읽기)을 그대로 쓴다. Jira에서 재측정 필요 |
| 공용화 과정에서 Confluence 기능이 깨짐 | Confluence 동작을 먼저 회귀 확인한 뒤 Jira를 붙인다 |

## 7. 하지 않는 것

| 항목 | 이유 |
| --- | --- |
| Jira에 Mermaid 렌더링을 흉내내기 | 이미지·링크로 대체하려면 외부 요청이 필요하다. **이 확장은 네트워크 요청을 하지 않는다** |
| 업무 제목·다른 필드 변환 | 편집기가 아니다 |
| Confluence 기능의 동작 변경 | 공용화는 **동작을 바꾸지 않는 리팩터링**이어야 한다 |

## 8. 결정이 필요한 것

| # | 항목 | 권장 |
| --- | --- | --- |
| Q1 | Mermaid 불가를 받아들이고 두 단계만 옮길 것인가 | **수용.** 다른 길이 없다 |
| Q2 | **댓글** 편집기에도 버튼을 붙일 것인가 | **설명만.** 댓글은 제외 |
| Q3 | 기능 기본값 | **OFF.** Confluence 쪽과 같다 |
| Q4 | 기능 ID·이름 | `editorMarkdownToAdf` 동일 |

**2026-09-17 전부 확정.** 아래 8절 제목을 `결정이 필요한 것` 에서 바꾸지 않은 것은 이력을
남기기 위해서다.
