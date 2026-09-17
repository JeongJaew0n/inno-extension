# 설명 편집 버튼 — 배경과 실측

## 요청

설명은 **본문을 클릭하면 곧바로 편집 상태**가 된다. 그런데 되돌리려면 문서 끝까지 스크롤해서
아래쪽 `취소`를 눌러야 한다. `설명` 제목 옆에도 같은 `취소`를 두고 싶다.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-17 |
| 대상 | `NPT` 보드 2145 업무 모달 (NPT-316) |
| 방법 | 설명 편집기를 열어 DOM 조회. **저장하지 않고 취소로 되돌렸다** |

## 1. 읽기와 편집의 컨테이너가 다르다

| 상태 | `data-testid` |
| --- | --- |
| 읽기 | `issue.views.field.rich-text.description` |
| 편집 | `issue.views.field.rich-text.editor-container` |

편집을 시작하면 읽기 쪽 testid는 **사라진다.** 그래서 편집 여부를 이 둘로 구분할 수 있다.

## 2. `설명` 라벨은 편집 중에도 남아 있다

```
labelStillPresentWhileEditing : true
```

읽기·편집 양쪽에서 같은 자리를 앵커로 쓸 수 있다. `Markdown 복사` 버튼이 이미 이 줄을 쓴다.

## 3. 아래쪽 버튼의 정체 — 이름이 함정이다

```
저장 : data-testid="comment-save-button"
취소 : data-testid="comment-cancel-button"
```

**`comment-` 접두사지만 댓글 것이 아니다.** Jira가 설명 편집에도 댓글 편집기 컴포넌트를
재사용해서 붙은 이름이다. 조상 사슬이 그것을 보여준다.

```text
issue.component.editor.default-editor
└ confluence-editor-<uuid>
  └ ak-editor-secondary-toolbar
    └ comment-cancel-button
```

**진짜 댓글 편집기에도 같은 `comment-cancel-button`이 있다.** 실제로 설명을 편집하지 않는
상태에서도 문서에 이 testid가 하나 존재하는 것을 확인했다(댓글 입력창의 것).

> 그래서 **반드시 설명 편집 컨테이너 안에서 찾아야 한다.** 문서 전체에서 찾으면 남의 댓글
> 입력을 취소시킨다.

## 4. 확인하지 못한 것

- 변경 사항이 있을 때 `취소`가 확인 대화상자를 띄우는지. **우리는 아래쪽 버튼을 그대로 누르므로
  Jira가 정하던 대로 동작한다.**
- 전체 화면 업무 보기(`/browse/...`)의 구조.
