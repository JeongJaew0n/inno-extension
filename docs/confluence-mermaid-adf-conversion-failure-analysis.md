# Confluence Mermaid -> ADF 변환 실패 분석

- 작성일: 2026-08-24
- 분석 대상: Inno Extension, `editorMarkdownToAdf` 기능의 `Mermaid -> ADF` 버튼
- 신고 현상: 편집 화면에서 `Mermaid -> ADF`를 누르면 `변환 실패`가 자꾸 표시된다
- 분석 대상 문서: 개인 스페이스 `기획서` 페이지 `edit-v2/2202566692` (코드블럭 22개)
- 분석 방법: Claude in Chrome으로 로그인된 실제 편집 세션에서 ProseMirror 브리지 직접 호출, 두 읽기 경로 비교, 실제 변환 실행과 실행 취소

## 1. 결론

**이번 실측에서는 실패를 재현하지 못했다.** 같은 문서, 같은 버튼에서 변환이 두 번 모두 성공했다.

| 시도 | 조건 | 결과 라벨 | `title` |
| --- | --- | --- | --- |
| 1회 | 편집기 로드 후 충분히 대기 | `2개 변환` | 없음 |
| 2회 | 1회 직후 재클릭 | `변환 대상 없음` | `변환할 Mermaid 코드블럭이 없습니다.` |
| 3회 | 페이지 리로드 후 버튼이 나타나는 즉시 클릭 | `2개 변환` | 없음 |

세 시도 모두 `변환 실패`가 나오지 않았다. 따라서 이 문서의 현재 상태는 실패 조건이 아니다.

대신 다음을 확정했다.

1. 실패 원인 후보 중 **브리지 미설치, 원문 읽기 실패, 선택 실패, CodeMirror 가상화, 접힌 expand 렌더 누락은 모두 아니다.** 각각 실측으로 배제했다.
2. `변환 실패` 라벨을 만드는 코드 분기는 12개다. 그중 어느 분기인지는 버튼 `title`에 담긴다.
3. 신고 문구가 `변환 실패`이고 `N개 변환 · 일부 실패`가 아니라는 점에서, **처음 처리된 대상에서 이미 실패했거나 루프 진입 전에 실패했다**로 좁혀진다.

## 2. 처리 흐름과 실패 지점

`src/sites/confluence/features/editorMarkdownToAdf/runtime.ts`의 `mermaidButton` 클릭 처리 순서다. 아래는 **분석 시점(수정 전)** 흐름이다. 변경 내용은 8.1에 있다.

```text
1. EDITOR_BODY 조회
2. 모든 codeBlock 수집
3. 각 codeBlock의 원문을 MAIN world ProseMirror 브리지로 읽음  (Promise.all)
4. isMermaidCodeBlockSource()로 Mermaid 코드블럭 선별
5. hasValidMermaidPair()로 이미 변환된 것 제외 -> candidates
6. unpairedExtensionCount > 0 이면 중단
7. candidates.reverse() 순서로 replaceMermaidCodeBlock()
   7-1. selectEditorNode()      브리지 select-node
   7-2. pasteAndWaitForChange() ClipboardEvent + 검증 폴링
   7-3. 실패 시 rollbackMermaidReplacement()  실행 취소 버튼 클릭
```

3번이 `Promise.all`이라는 점이 중요하다. **코드블럭 22개 중 하나만 읽기에 실패해도 전체가 중단된다.** 이 구조는 8.1에서 순차 읽기로 교체했다.

7번은 `reverse()`로 뒤에서부터 처리한다. 앞선 교체가 뒤쪽 `codeBlockIndex`를 밀지 않게 하기 위한 순서다.

## 3. 라벨과 원인 대응표

수정 전 라벨 결정 로직은 다음과 같았다.

```ts
mermaidLabel.textContent = convertedCount > 0
  ? `${convertedCount}개 변환 · 일부 실패`
  : message.startsWith('변환할 Mermaid') ? '변환 대상 없음' : '변환 실패';
mermaidButton.title = message;
```

`변환 실패`를 만드는 메시지는 다음 12개다. 실제 원인은 버튼 `title`로 확정된다. 8.1 적용 후에는 라벨에도 짧은 원인이 함께 표시된다.

| # | `title` 메시지 | 발생 지점 | 의미 |
| --- | --- | --- | --- |
| 1 | `Confluence 편집 본문을 찾을 수 없습니다.` | 1번 | 편집기 DOM 미발견 |
| 2 | `문서 다른 위치에 Mermaid 컴포넌트 N개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.` | 6번 | 짝 없는 컴포넌트 존재 |
| 3 | `Confluence codeBlock 식별자를 찾을 수 없습니다.` | 브리지 요청 | `data-local-id` 없음 |
| 4 | `Confluence 편집기 상태 브리지가 응답하지 않았습니다.` | 브리지 요청 | 1000ms 무응답 |
| 5 | `Confluence codeBlock 전체 원문을 읽지 못했습니다.` | 3번 | 응답에 text 없음 |
| 6 | `Confluence 편집기 상태 처리에 실패했습니다.` | 브리지 응답 | success=false, 메시지 없음 |
| 7 | `Confluence ProseMirror codeBlock 원문을 찾을 수 없습니다.` | MAIN 브리지 | PM 노드 textContent 없음 |
| 8 | `Confluence ProseMirror 편집기 상태를 찾을 수 없습니다.` | MAIN 브리지 | EditorView 탐색 실패 |
| 9 | `Confluence ProseMirror codeBlock 위치를 찾을 수 없습니다.` | MAIN 브리지 | posBefore/nodeSize 없음 |
| 10 | `Confluence ProseMirror codeBlock 선택이 적용되지 않았습니다.` | MAIN 브리지 | 선택 dispatch 미반영 |
| 11 | `Mermaid 코드블럭을 원래 위치의 컴포넌트로 교체하지 못했습니다.` | 7-2 | 3000ms 안에 검증 미통과 |
| 12 | `Mermaid 변환 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Confluence 실행 취소를 한 번 눌러주세요.` | 7-3 | 되돌리기까지 실패 |

2번과 12번은 서로 이어진다. 12번이 발생하면 문서에 짝 없는 컴포넌트가 남고, 이후 클릭은 모두 2번으로 실패한다. **`자꾸` 반복되는 증상은 이 연쇄로 설명된다.** 한 번 12번을 겪으면 문서를 정리하기 전까지 계속 `변환 실패`가 뜬다.

## 4. 실측으로 배제한 원인

### 4.1 MAIN world 브리지 미설치 — 배제

| 항목 | 값 |
| --- | --- |
| `__innoExtensionConfluenceProseMirrorBridgeInstalled` | `true` |

### 4.2 원문 읽기 실패 — 배제

22개 코드블럭 전부에 대해 `read-node`를 직접 호출했다.

| 항목 | 값 |
| --- | --- |
| 요청 수 | 22 |
| 성공 | 22 |
| 실패 | 0 |
| `data-local-id` 보유 | 22 / 22 |
| Mermaid로 판정된 블록 | 2 (index 0, 6) |
| 두 블록의 선언부 | 둘 다 `flowchart` |
| 원문 길이 | 362자, 320자 |

### 4.3 두 읽기 경로 불일치 — 배제

검증 단계 `isMermaidReplacementAtOriginalPosition()`은 `readConfluenceCodeBlockText()`로 **DOM**에서 읽고, 이를 브리지가 준 **ProseMirror** 원문과 비교한다. 경로가 다르므로 불일치 가능성을 의심했으나 실측 결과 완전히 일치했다.

| index | DOM 길이 | PM 길이 | 일치 | DOM 행 수 | PM 행 수 |
| --- | --- | --- | --- | --- | --- |
| 0 | 362 | 362 | `true` | 6 | 6 |
| 6 | 320 | 320 | `true` | 5 | 5 |

### 4.4 CodeMirror 가상화 — 배제

`readConfluenceCodeBlockText()`는 `.cm-content .cm-line`에서 읽으므로, CodeMirror가 화면 밖 코드블럭을 렌더하지 않으면 빈 문자열이 나올 수 있다고 의심했다.

| 항목 | 값 |
| --- | --- |
| 코드블럭 수 | 22 |
| `.cm-content` 없는 블록 | 0 |
| `.cm-line` 0개인 블록 | 0 |
| 뷰포트 안에 있는 블록 | 0 |
| 뷰포트 높이 | 828px |
| 가장 아래 블록 offsetTop | 약 4000px 이상 |

**뷰포트에 하나도 없는데 22개 전부 렌더돼 있다.** 이 편집기는 코드블럭을 가상화하지 않는다.

### 4.5 접힌 expand 안 원문 렌더 누락 — 배제

변환 결과의 원본은 `data-expanded="false"` expand 안에 들어간다. 접혀 있으면 CodeMirror가 마운트되지 않아 검증이 영구히 실패한다고 의심했다. 변환 성공 직후 측정 결과 정상적으로 읽혔다.

| 항목 | 값 |
| --- | --- |
| expand 안 코드블럭 수 | 2 |
| DOM 읽기 길이 | 362, 320 |
| `.cm-line` 수 | 6, 5 |

접힘 여부는 읽기에 영향을 주지 않는다.

### 4.6 로드 직후 조급한 클릭 — 이번 조건에서는 배제

리로드 후 버튼이 나타나는 즉시(폴링 시작 1ms 시점) 클릭했다.

| 항목 | 값 |
| --- | --- |
| 클릭 시점 편집기 존재 | `true` |
| 클릭 시점 코드블럭 수 | 22 |
| 클릭 시점 `.cm-content` 보유 | 22 / 22 |
| 클릭 시점 브리지 설치 | `true` |
| 결과 | `2개 변환` |

단, `navigate`는 로드 완료 후 반환하므로 **사람이 수동으로 누를 수 있는 것보다 이른 시점은 시험하지 못했다.** 더 이른 순간의 경합은 배제하지 못했다.

## 5. 성공 경로 실측 기록

변환 성공 시 문서 변화는 다음과 같았다.

| 항목 | 변환 전 | 변환 후 | 실행 취소 후 |
| --- | --- | --- | --- |
| Mermaid extension 수 | 0 | 2 | 0 |
| expand 수 | 0 | 2 | 0 |
| codeBlock 수 | 22 | 22 | 22 |
| 실행 취소 버튼 | 비활성 | 활성 | 비활성 |

codeBlock 수가 22로 유지되는 것이 정상이다. 원본 코드블럭이 expand 안으로 들어가므로 총 개수는 변하지 않는다.

실행 취소는 컴포넌트 1개씩 되돌린다. 2개 변환은 2회 실행 취소로 완전히 복구됐다. 분석 중 발생시킨 두 번의 변환은 모두 원상 복구했고, **발행하지 않았다.**

## 6. 남은 가설

| 순위 | 가설 | 근거 | 확인 방법 |
| --- | --- | --- | --- |
| 1 | 표 3의 2번 — 문서에 짝 없는 Mermaid 컴포넌트가 남아 있다 | 한 번 발생하면 계속 반복되는 `자꾸` 증상과 일치한다. 이 문서의 발행본에 과거 변환 잔여물이 있으면 편집 진입 즉시 이 상태가 된다 | 버튼 `title`이 `문서 다른 위치에...`인지 확인 |
| 2 | 표 3의 11번 — 3000ms 안에 검증이 통과하지 못한다 | 문서가 크고 저사양·고부하 상황에서 paste 반영이 느릴 수 있다. 이 문서는 코드블럭 22개로 작지 않다 | `title`이 `원래 위치의 컴포넌트로 교체하지 못했습니다`인지 확인 |
| 3 | 표 3의 4번 — 브리지 1000ms 무응답 | 22개를 `Promise.all`로 동시에 던지므로 부하가 몰린다. `PROSEMIRROR_SELECTION_TIMEOUT_MS`가 1000ms로 짧다 | `title`이 `브리지가 응답하지 않았습니다`인지 확인 |
| 4 | 확장 재로드 후 기존 탭의 context 무효화 | 별도 분석 문서의 확인된 현상. 다만 이 경우 버튼 자체가 동작하지 않을 가능성이 높다 | 콘솔에 `Extension context invalidated` 확인 |

가설 1이 가장 유력하다. 이번 실측에서는 문서에 컴포넌트가 0개였으므로 이 조건이 성립하지 않았고, 그래서 재현되지 않았다고 보는 것이 자연스럽다.

## 7. 다음 확인에 필요한 정보

실패가 재현되는 순간에 다음 두 가지만 있으면 표 3에서 원인이 한 번에 확정된다.

1. `Mermaid -> ADF` 버튼에 마우스를 올렸을 때 나오는 tooltip 전문
2. DevTools 콘솔의 `[Inno Extension] Confluence Mermaid -> ADF 변환 실패` 로그와 그 뒤의 Error 객체

콘솔에서 아래를 실행하면 판정에 필요한 상태를 한 번에 얻을 수 있다. 문서 본문은 출력하지 않는다.

```js
(() => {
  const ed = document.querySelector('[data-testid="editor-wrapper"] .ProseMirror[contenteditable="true"][role="textbox"]');
  const key = n => n.getAttribute('extensionkey') ?? n.getAttribute('data-extension-key') ?? '';
  const isExt = n => n.getAttribute('data-prosemirror-node-name') === 'extension'
    && key(n).endsWith('mermaid-diagram');
  const cbs = [...ed.querySelectorAll('[data-prosemirror-node-name="codeBlock"]')];
  const host = [...document.querySelectorAll('[data-inno-extension-feature]')]
    .find(h => h.shadowRoot?.querySelector('[data-action="mermaid"]'));
  const btn = host?.shadowRoot.querySelector('[data-action="mermaid"]');
  return {
    label: btn && btn.textContent.trim(),
    title: btn && btn.getAttribute('title'),
    mermaidExtensions: [...ed.querySelectorAll('[data-prosemirror-node-name="extension"]')].filter(isExt).length,
    codeBlocks: cbs.length,
    withoutLocalId: cbs.filter(c => !c.dataset.localId).length,
    withoutCmContent: cbs.filter(c => !c.querySelector('.cm-content')).length,
    expands: ed.querySelectorAll('[data-prosemirror-node-name="expand"]').length,
    bridge: !!window.__innoExtensionConfluenceProseMirrorBridgeInstalled,
  };
})()
```

`mermaidExtensions`가 0보다 크고 `expands`가 그보다 적으면 가설 1이 확정된다.

## 8. 개선 후보

원인 확정 전이라 수정하지 않는다. 다만 표 3의 구조 자체에서 드러나는 개선 여지를 남긴다.

| 후보 | 내용 | 이유 |
| --- | --- | --- |
| a | `Promise.all` 대신 순차 읽기 또는 동시 실행 수 제한 | 코드블럭 22개를 1000ms 타임아웃으로 동시에 던진다. 하나만 늦어도 전체가 실패한다 |
| b | Mermaid 후보만 원문을 읽는다 | 현재는 22개 전부 읽는다. Mermaid는 2개뿐이었다. 불필요한 읽기가 실패 표면을 넓힌다 |
| c | 라벨과 별도로 실패 이유를 눈에 보이게 노출 | 지금은 tooltip을 올려야 원인을 알 수 있다. `변환 실패` 한 문구로는 12개 분기를 구분할 수 없다 |
| d | 짝 없는 컴포넌트를 안내가 아니라 정리 동작으로 처리 | 표 3의 2번은 사용자가 수동으로 컴포넌트를 찾아 지워야 해제된다 |

후보 b는 효과가 크고 위험이 낮다. `isMermaidCodeBlockSource()` 판정에 원문 전체가 필요하다는 제약이 있으나, 선언부는 첫 비주석 행이므로 DOM의 첫 행만으로 후보를 좁힌 뒤 그 후보만 브리지로 읽는 2단계 구성이 가능하다.

## 8.1 적용 내용 (2026-08-24)

후보 a, b, c를 적용했다. 후보 d는 사용자 문서를 자동으로 변경하는 동작이라 제품 결정이 필요해 보류했다.

### a. 순차 읽기

`readCodeBlockSources()`를 도입해 `Promise.all` 동시 읽기를 순차 읽기로 바꿨다. 브리지 타임아웃이 1000ms인데 코드블럭 22개를 동시에 던지면 하나만 늦어도 전체가 실패하던 구조를 없앴다.

개별 실패는 더 이상 전체를 중단시키지 않는다. 실패한 블록은 건너뛰고 `failures`로 수집해 호출자가 판단한다.

```text
이전: Promise.all(22개) -> 하나 실패 = 전부 실패
이후: 순차 -> 실패한 블록만 제외, 나머지는 변환
```

읽을 대상이 하나도 남지 않았고 실패가 있었다면, `변환 대상 없음`으로 오분류하지 않고 읽기 실패임을 명시한 오류를 던진다.

### b. 후보 한정 읽기

`mayBeMermaidCodeBlock()`으로 DOM 원문을 먼저 확인해 브리지 요청을 Mermaid 후보로 한정한다. 이 문서에서는 22개 중 2개만 읽으면 된다.

DOM 원문을 읽을 수 없는 코드블럭은 판정을 보류하고 후보로 남긴다. 4.4와 4.5에서 DOM 읽기가 신뢰할 수 있음을 확인했지만, 렌더되지 않은 블록을 잘못 제외하면 변환 대상이 사라지므로 확실히 Mermaid가 아닌 경우에만 걸러낸다.

코드블럭 -> ADF 경로에도 같은 원칙을 적용했다. 보호 대상인 Mermaid 원본은 애초에 읽지 않는다. 변환하지 않을 블록을 읽던 낭비를 없앴다.

부수 효과로 짝 판정이 더 견고해졌다. 이전에는 `pairedCount`를 Mermaid 원문 판정 결과에서 역산했으므로 읽기가 실패하면 `unpairedExtensionCount`가 부풀어 표 3의 2번 오류가 잘못 발생할 수 있었다. 이제 `hasValidMermaidPair()`의 DOM 구조 판정만 사용해 읽기 성공 여부와 무관하다.

### c. 실패 원인 노출

`summarizeConversionFailure()`가 메시지를 짧은 원인으로 매핑해 라벨에 덧붙인다. tooltip을 열지 않아도 어느 단계에서 막혔는지 구분된다.

| 라벨 | 의미 |
| --- | --- |
| `변환 실패 · 기존 컴포넌트 정리 필요` | 표 3의 2번 |
| `변환 실패 · 편집기 응답 없음` | 표 3의 4번 |
| `변환 실패 · 교체 확인 실패` | 표 3의 11번 |
| `변환 실패 · 되돌리기 실패` | 표 3의 12번 |
| `변환 실패 · 원문 읽기 실패` | 표 3의 5, 7번 |
| `변환 실패 · 블록 선택 실패` | 표 3의 10번 |
| `변환 실패 · 편집기 미발견` | 표 3의 1, 8번 |
| `변환 실패 · 블록 식별 실패` | 표 3의 3, 9번 |

원인을 특정하지 못하면 기존 `변환 실패` 문구를 유지한다. 제외된 블록이 있으면 성공 라벨에도 `N개 변환 · 제외 M`으로 드러낸다.

### 테스트

`tests/unit.test.ts`에 5건을 추가했다. 자동화 테스트 50건 통과.

- 후보 사전 판정이 확실히 아닌 블록만 제외한다
- DOM 원문을 읽을 수 없으면 후보로 남긴다
- 읽기가 **순차로** 실행된다 (동시 요청 수 최대 1 확인) 그리고 개별 실패를 건너뛴다
- Error가 아닌 예외도 실패로 수집한다
- 실패 원인 요약이 12개 분기를 서로 다른 문구로 구분한다

순차 실행 검증은 실제 동시 실행 수를 세어 `maxInFlight === 1`을 단정한다. `Promise.all`로 되돌리면 실패하는 회귀 가드다.

### 한계

이 개선은 표 3의 4번(브리지 무응답)과 5번(원문 읽기 실패)이 전체를 중단시키던 문제를 해소한다. 그러나 **가설 1(짝 없는 컴포넌트, 표 3의 2번)은 해소하지 않는다.** 그 상태에 빠진 문서는 여전히 사용자가 컴포넌트를 직접 지워야 한다. 후보 d가 필요한 부분이다.

## 9. 검증 공백

- **실패 자체를 재현하지 못했다.** 이 문서의 모든 판정은 성공 경로 실측과 코드 경로 분석에 기반한다. 실패 시점의 실측은 없다.
- 사용자가 실제로 본 `title` 문구를 확인하지 못했다. 표 3의 12개 분기 중 어느 것인지 미확정이다.
- 사람이 수동으로 누를 수 있는 가장 이른 시점보다 더 이른 경합은 시험하지 못했다.
- 발행본에 과거 변환 잔여물이 있는지는 편집 화면 DOM만 봤으므로 확인하지 못했다. 편집 진입 시점의 컴포넌트 수는 0이었다.
- 저사양·고부하 환경에서의 타임아웃 초과는 재현하지 않았다.

## 10. 관련 코드와 문서

- `src/sites/confluence/features/editorMarkdownToAdf/runtime.ts` — 클릭 처리, 브리지 요청, 교체와 되돌리기
- `src/sites/confluence/features/editorMarkdownToAdf/code-block.ts` — `readConfluenceCodeBlockText()` (DOM 읽기)
- `src/sites/confluence/features/editorMarkdownToAdf/mermaid.ts` — 선언부 판정, 치환 HTML 생성
- `src/sites/confluence/main.ts` — MAIN world ProseMirror 브리지
- `src/sites/confluence/selectors.ts` — `EDITOR_BODY`, `EDITOR_CODE_BLOCK`
- `docs/confluence-mermaid-runtime-analysis.md` — Mermaid 컴포넌트 구조와 과거 위치 오류 분석
- `docs/confluence-markdown-adf-data-loss-analysis.md`
- `spec/features/confluence-adf-markdown-tools.md`

## 11. 상수

| 상수 | 값 |
| --- | --- |
| `PROSEMIRROR_SELECTION_TIMEOUT_MS` | 1000 |
| `MERMAID_EXTENSION_INSERT_TIMEOUT_MS` | 3000 |
