# 맥락 — Mermaid 를 넣기 전에 서버 초안을 기다린다

## 요청 (2026-10-01)

> 코드블럭으로 감싸진 내용 → 마크다운 변환 시 flowchart 는 에러 → ctrl+z 로 flowchart 만 원래 코드블럭으로
> 롤백 → 다시 마크다운 변환 누름 → 잘 변환됨.
>
> 오류: `No diagram type detected matching given configuration for text: { "id": 1, "tenant_id": … }`

## 측정 기록

1. 실험 페이지를 비우고 코드블럭 하나에 Markdown(json · mermaid · bash 블록)을 넣고 변환
   → 변환 0.65초, 직후 `Code block under with position 2 not found`. 15초 뒤에도 그대로.
2. 같은 문서를 새로고침 → 정상 렌더 (기존 기록과 같음).
3. 편집 후 서버 초안(GET draft) 코드블럭 수가 바뀌는 시점: 편집 +10.7초.
4. Mermaid 앞 순번에 코드블럭(`echo hi`)을 끼운 뒤 새로고침 → `No diagram type detected … for text: echo hi`.
   **매크로가 순번으로 서버 초안을 읽는다**는 것을 가르는 실험이었다.
5. `/wiki/rest/api/content/{id}?status=draft&expand=body.atlas_doc_format` 의 코드블럭 순서
   = [json, echo hi, flowchart(접힌 원본 안), kubectl] — 매크로가 센 순서와 같다.

## 기존 결론과의 관계

`docs/troubleshootings/reusable/2026-09-18-confluence-mermaid-macro-renders-before-document-settles.md`
는 "가라앉지 않은 문서 상태를 본다"까지만 확정하고 우리 코드 밖 문제로 두었다. 이번에 **무엇이**
늦는지(서버 초안, 약 10초)를 쟀고, 그것은 우리가 넣기 전에 기다릴 수 있다.

## 기각한 대안

| 대안 | 기각 이유 |
| --- | --- |
| 고정 대기 12초 | 늦을 때는 모자라고, 이미 맞을 때도 매번 12초를 쓴다 |
| 헤더 `저장됨` 표시를 기다림 | 실측에서 `저장됨` 인데도 서버 초안은 옛것이었다 |
| 넣은 뒤 매크로를 다시 그리게 함 | 매크로를 다시 그리게 할 수단이 문서 변경뿐이다 |
