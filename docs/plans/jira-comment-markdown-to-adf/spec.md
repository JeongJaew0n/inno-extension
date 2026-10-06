# Jira 댓글 Markdown 변환 — 설계

- 상태: 구현 완료 · 실사용 확인 중
- 작성일: 2026-10-06
- 실측: [context.md](./context.md)

## 1. 결론

**설명용 기능을 넓힌다. 새 기능을 만들지 않는다.**

| 결정 | 내용 | 이유 |
| --- | --- | --- |
| 기능 | 기존 `editorMarkdownToAdf` 를 넓힌다. 이름만 `설명·댓글 Markdown 변환` 으로 바꾼다 | 같은 편집기·같은 단계다. 스위치가 둘이면 쓰는 사람이 헷갈린다. 기능 ID 는 저장 키라 유지한다 |
| 대상 | 화면에 열린 **모든** 댓글 편집기 | 새 댓글 · 기존 댓글 편집 · 답글이 동시에 열릴 수 있다 |
| 단계 | 설명과 같다. 코드블럭 벗기기 → 문단 Markdown 변환. Mermaid 없음 | Jira 에 Mermaid 앱이 없다 |
| 저장 | 누르지 않는다 | 확장은 저장·제출을 하지 않는다 |

## 2. 공용 런타임을 여러 대상으로 넓힌다

`createEditorMarkdownToAdfRuntime` 은 지금 대상을 **하나**만 다룬다(`resolveTarget` → host 하나).
한 화면에 편집기가 여럿일 수 있으니 `resolveTargets` 가 대상 **목록**을 돌려주게 바꾼다.

- host 는 툴바마다 하나다. 이미 그 툴바에 같은 `key` 로 붙어 있으면 그대로 둔다.
- 목록에 없는 툴바의 host 는 걷어낸다.
- Confluence 는 대상이 0 또는 1개인 목록을 돌려준다. 동작은 그대로다.

## 3. Jira 대상 고르기

1. **설명** — 지금과 같다. `issue.views.field.rich-text.editor-container` 안의 툴바·편집기.
2. **댓글** — 문서의 편집기 중 조상에 `issue.activity.comment`(작성 칸) 또는
   `issue.activity.comments-list`(기존 댓글)가 있는 것.
   - 컨테이너는 그 편집기에서 가장 가까운 `issue.component.editor.default-editor`.
   - 툴바는 **그 컨테이너 안에서** 찾는다. 컨테이너가 없거나 툴바가 없으면 대상에서 뺀다.
   - 설명 컨테이너 안의 편집기는 댓글로 치지 않는다(설명은 1번이 맡는다).

변환 중에 본문을 다시 잡을 때도 컨테이너 안에서만 찾는다. 그래서 다른 편집기를 건드리지 않는다.

## 4. 바뀌는 것

| 자리 | 변경 |
| --- | --- |
| `src/platform/editor/markdown-to-adf-runtime.ts` | `resolveTarget` → `resolveTargets`, host 여러 개 |
| `src/sites/confluence/features/editorMarkdownToAdf/runtime.ts` | 목록으로 감싼다 |
| `src/sites/jira/features/editorMarkdownToAdf/runtime.ts` | 댓글 대상 추가 |
| `src/sites/jira/selectors.ts` | 댓글 작성 칸 · 댓글 목록 · `default-editor` 선택자 |
| 카탈로그 · README · spec | 이름과 범위 |
| 테스트 | 단위(대상 고르기 소스 계약) · e2e(댓글 편집기 대역) |

## 5. 비목표

- Mermaid
- 댓글 **저장**·등록
- 댓글 읽기 화면의 Markdown 복사(별개 기능이다)
