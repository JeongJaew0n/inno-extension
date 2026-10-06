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

## 4. 댓글 편집기는 우리 붙여넣기를 받아 주지 않는다

`/jira/software/c/projects/NPT/boards/2145?selectedIssue=NPT-671` 업무 모달의 새 댓글 칸에서 쟀다
(2026-10-06, 사용자가 지정한 업무). 저장하지 않고 취소로 닫았고, 댓글이 0개 그대로인 것을
`GET /rest/api/3/issue/NPT-671/comment` 로 확인했다.

버튼 자체는 모달 댓글 칸 툴바 오른쪽 끝에 하나 붙었다. 그런데 문단 단계가 **두 번 모두 실패**했다
(`문단으로 남은 Markdown을 원래 위치에서 교체하지 못했습니다`). 실행 취소는 눌리지 않았고 문단은
그대로였다.

같은 이벤트를 페이지에서 직접 보내 갈랐다.

| 넣은 방법 | 넣은 것 | 결과 |
| --- | --- | --- |
| 평문 붙여넣기 (`text/plain`) | 표 3줄 | 이벤트는 처리됐지만(`defaultPrevented`) **같은 문단 3개** — 표가 안 됨 |
| 평문 붙여넣기 | `#` 제목 · `-` 목록 · `` ``` `` 코드 | 목록만 `bulletList`, 제목·코드는 **글자 그대로** |
| HTML 붙여넣기 (`text/html` + `text/plain`) | 제목·표·코드·목록 HTML | **HTML 을 버리고 평문만** 들어갔다 |
| **트랜잭션** (`schema.nodeFromJSON(adf)` → `tr.replaceWith`) | 제목·표·코드블럭 ADF | **`heading` · `table` · `codeBlock` 그대로.** 실행 취소 한 번으로 되돌아갔다 |

편집기 스키마에는 `heading` · `table` · `codeBlock` 이 모두 있다. **노드를 못 넣는 게 아니라 댓글
편집기의 붙여넣기 처리가 우리 이벤트를 다르게 다룬다.** 설명 편집기(2026-09-17)는 평문 붙여넣기로
제목·표·코드블럭이 다 됐다.

결정: **댓글 편집기는 트랜잭션으로 넣는다.** 설명은 실측으로 되는 붙여넣기를 유지한다.

실행 취소 버튼도 툴바마다 있다. 문서 전체에서 첫 번째를 잡으면 함께 열린 다른 편집기의 실행
취소를 누를 수 있어, 편집기에서 가장 가까운 것을 누르게 바꿨다.

## 5. 확인하지 못한 것

- 기존 댓글 **편집** · **답글** 편집기가 `default-editor` 구조인지. 같은 편집기 컴포넌트를 쓸 것으로
  보지만 [가정]이다.
- 설명 편집기와 댓글 편집기를 **함께 열어 둔 채** 변환·되돌리기. e2e 대역에서만 봤다.

## 6. 확장 코드로 다시 잰 결과 (트랜잭션)

같은 NPT-671 모달 댓글 칸에서 새 빌드로 쟀다(2026-10-06). 저장하지 않고 취소했고 댓글은 0개 그대로다.

| 넣은 것 | 버튼 문구 | 결과 |
| --- | --- | --- |
| 문단 3줄: `\| 항목 \| 범위 \|` · 구분선 · `\| 문서 \| 1~3장 그리고 4~5장 \|` | `문단 Markdown 0/1 → 1/1 → 문단 1 변환` | 표 2×2. 물결표 그대로, 취소선 0 |
| (위 결과에서) 편집기 실행 취소 1회 | — | 문단 3줄로 돌아감 |
| 코드블럭 안에 `## 제목` · 빈 줄 · 목록 2줄 | `코드블럭 변환 중 → 코드블럭 1 변환` | `heading` + `bulletList` |
