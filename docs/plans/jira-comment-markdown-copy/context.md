# Jira 댓글 Markdown 복사 — 조사 기록

## 댓글 DOM (실측 2026-10-16, NPT-630, 읽기만)

```
[data-testid="issue.activity.comments-list"]
  [data-testid="issue-comment-base.ui.comment.ak-comment.<id>"]           ← 댓글 하나
    [data-testid="issue-comment-base.ui.comment.ak-comment.<id>-header"]  ← 아바타 · 링크 복사 · 시각
    [data-testid="issue-comment-base.ui.comment.ak-comment.<id>-body"]    ← .ak-renderer-document 하나
    [data-testid="issue-comment-base.ui.comment.ak-comment.<id>-footer"]
      [data-testid="issue-comment-base.ui.comment.custom-comment.<id>.comment-actions"]  ← display:flex, gap 8px
        답글 · 반응 · 편집 · 더보기 (각 24px 아이콘 버튼)
```

- `<id>` 는 숫자다. 같은 접두사로 `-header` · `-body` · `-footer` 가 함께 잡히므로 댓글 루트는 접미사가
  없는 것으로 고른다.
- 본문은 설명과 같은 `.ak-renderer-document` 다. 렌더러 → Markdown 변환기를 그대로 쓴다.
- 커밋 언급 같은 자동 댓글도 같은 구조다.

## 결정

- 버튼은 동작 줄 끝. 머리글에도 `링크 복사` 아이콘이 있지만 결과 라벨을 보여 줄 폭이 없다.
