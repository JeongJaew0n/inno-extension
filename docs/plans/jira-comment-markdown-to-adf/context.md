# Jira 댓글 Markdown 변환 — 배경과 실측

## 요청

설명 편집기에 있는 `Markdown 변환` 버튼을 **댓글 편집기에도** 붙인다(2026-10-06 사용자 요청).
처음 기능을 만들 때(2026-09-17)는 댓글을 범위에서 뺐다.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-10-06 |
| 대상 | `/browse/NPT-316` 전체 화면 업무 보기의 **새 댓글 작성 칸** |
| 방법 | `댓글 추가...` 자리표시를 눌러 편집기를 열고 DOM 만 읽은 뒤 **취소**. 아무것도 입력하지 않았다 |
| 보조 | `/browse/NPT-682` 에서 기존 댓글이 어떻게 감싸이는지만 읽었다(남의 댓글이라 편집은 열지 않았다) |

## 1. 새 댓글 작성 칸

자리표시(`canned-comments.common.ui.comment-text-area-placeholder.textarea` 근처의 `댓글 추가...`)를
누르면 설명과 **같은 Atlassian 편집기**가 열린다.

```text
issue.activity.comment                       ← 작성 칸. 화면에 하나
└ common-components-arrow-keys-handler.div
  └ issue.component.editor.default-editor    ← 툴바 · 편집기 · 저장/취소가 모두 이 안
    └ confluence-editor-<uuid>
      └ click-wrapper
        └ editor-content-container
          └ .ProseMirror#ak-editor-textarea
```

| 항목 | 값 |
| --- | --- |
| 편집기 | `.ProseMirror[contenteditable="true"][role="textbox"]`, `id="ak-editor-textarea"` — 설명과 같다 |
| 툴바 | `[data-testid="editor-primary-toolbar"]` 가 **같은 `default-editor` 안**에 있다 |
| `default-editor` 안의 편집기 수 | 1 |
| 툴바 폭 | 670px, 마지막 버튼이 오른쪽 끝에서 약 190px 앞에서 끝난다. 설명과 같이 오른쪽 끝(`end`)에 둘 자리가 있다 |
| 저장·취소 | `comment-save-button` · `comment-cancel-button` (설명 편집도 같은 이름을 쓴다) |

## 2. 설명 편집기와의 공통점

설명 편집기의 조상 사슬(2026-09-17 실측)에도 `issue.component.editor.default-editor` 가 있다.

```text
issue.views.field.rich-text.editor-container
└ common-components-arrow-keys-handler.div
  └ issue.component.editor.default-editor
    └ confluence-editor-<uuid> …
```

**편집기마다 가장 가까운 `default-editor` 가 그 편집기 하나와 그 툴바를 담는다.** 편집기 단위로
짝을 지을 수 있는 공통 앵커다.

## 3. 기존 댓글

기존 댓글은 작성 칸과 **다른 곳**에 있다.

```text
issue.activity.comments-list
└ issue-comment-base.ui.comment.custom-comment.container
  └ comment-base-item-<id>
    └ issue-comment-base.ui.comment.ak-comment.<id>   (-header · -body · -footer)
```

댓글마다 `편집`·`답글` 버튼이 있다. **편집을 눌렀을 때 뜨는 편집기는 재지 못했다.** 최근 60일 NPT
업무에 내 댓글이 없어 열어 볼 대상이 없었다.

## 4. 확인하지 못한 것

- 기존 댓글 **편집** · **답글** 편집기가 `default-editor` 구조인지. 같은 편집기 컴포넌트를 쓸 것으로
  보지만 [가정]이다.
- 댓글 편집기에서 실제 붙여넣기 변환 결과. 남이 보는 업무의 댓글 칸이라 입력은 하지 않았다.
- 업무 모달(보드의 `selectedIssue`)의 댓글 작성 칸. 전체 화면 보기에서만 쟀다.
