# 편집 중 Markdown 복사 — 구현 체크리스트

## 1. 선행 측정

- [x] 편집기 DOM 에 렌더러 진입점(`renderer-code-block`)이 없음을 확인 — **0개**
- [x] 편집기 코드블럭이 CodeMirror 임을 확인
- [x] `EditorView.state.doc.toJSON()` 으로 ADF 를 꺼낼 수 있음을 확인

## 2. 공용 규칙

- [x] `platform/markdown/format.ts` 로 이스케이프·표·목록·코드 펜스 규칙을 모음
- [x] 렌더러 경로가 그 규칙을 쓰도록 바꿈 (동작 불변 — 기존 테스트 통과)

## 3. ADF -> Markdown

- [x] `platform/adf/adf-to-markdown.ts`
- [x] 제목·문단·강조·링크·인라인 코드
- [x] 목록·할 일 목록·중첩
- [x] 표 (GFM)
- [x] 코드블럭 (언어 유지)
- [x] 인용·구분선
- [x] `expand` 껍데기 벗기기 (제목은 굵은 줄로)
- [x] `panel`·`layout` 껍데기 벗기기
- [x] 매크로(`extension`) 버리고 안내 남기기
- [x] `status`·`mention`·`date`·`emoji` 를 글자로
- [x] 첨부 이미지는 `(이미지 첨부)`, external 은 `![](url)`
- [x] 모르는 노드는 글자만 건지고 안내

## 4. 브리지

- [x] `read-doc` 액션 (MAIN world)
- [x] `readProseMirrorDocument()` (ISOLATED)

## 5. 배선

- [x] 읽기 중이면 렌더러, 편집 중이면 ADF
- [x] 편집 중에도 버튼이 사라지지 않게
- [x] 새 버튼·새 설정 추가하지 않음

## 6. 테스트

- [x] ADF -> Markdown 단위 테스트
- [x] 매크로 제외 · 대응물 없는 노드 처리
- [x] 두 경로 분기 회귀 테스트
- [x] `npm run check`

## 7. 실사용 확인 (2026-09-18, Jira NPT-316)

- [x] **긴 코드블럭이 잘리지 않는다** — 40줄 코드블럭을 넣으니 DOM 에는 **32줄만** 렌더됐는데
      복사본에는 **40줄 전부** 들어왔다. `line 40` 까지 확인
- [x] 제목·표·코드 펜스가 살아 있다
- [x] 읽기 모드 복사가 여전히 동작한다
- [ ] Mermaid 매크로가 있는 문서에서 원본 코드블럭만 한 번 나오는지 — **Jira 에는 Mermaid 가
      없어 확인 못 했다.** Confluence 쪽 복사는 아직 읽기 전용이라 이 경로를 타지 않는다

> 프로그래밍으로 버튼을 누르면 문서에 포커스가 없어 클립보드 쓰기가 막히고 `복사 실패` 가 뜬다.
> **기능 문제가 아니다.** 실제 클릭으로는 정상 동작한다. 자동화로 확인할 때 헷갈리기 쉬워 남긴다.
