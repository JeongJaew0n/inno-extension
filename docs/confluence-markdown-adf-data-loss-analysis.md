# Confluence 코드블럭 벗기기 및 Markdown -> ADF 데이터 유실 분석

- 분석 일자: 2026-08-12 (Asia/Seoul)
- 분석 대상: Confluence `edit-v2` 편집기의 `코드블럭 벗기기`, `Markdown -> ADF 변환`
- 분석 범위: 원문 추출, Markdown 재구성, ADF 변환, Confluence 편집기 적용 경계
- 분석 방법: 현재 구현과 단위 테스트를 추적하고, 로그인된 Confluence 편집기의 CodeMirror·ProseMirror DOM을 대조했다.
- 상태: 원인 분석 및 수정 반영 완료

## 1. 결론

두 기능에는 서로 다른 데이터 유실 경계가 있으며, 연속해서 실행하면 문제가 누적될 수 있다.

1. `코드블럭 벗기기`는 CodeMirror의 화면 DOM에 렌더링된 줄만 원문으로 읽는다. 긴 코드 블록에서는 화면 밖 줄이 DOM에 없을 수 있으므로 원문 일부만 일반 문단으로 교체될 수 있다.
2. 코드 블록을 일반 문단 HTML로 만드는 과정에서 연속 빈 줄 개수가 보존되지 않는다.
3. `Markdown -> ADF 변환`은 Confluence의 문단들을 무조건 빈 줄 하나가 포함된 `\n\n`으로 연결하고 각 문단 끝 공백을 제거한다. 이 단계에서 Markdown 표, 코드, 강제 개행, 들여쓰기 구조가 ADF 파싱 전에 이미 달라질 수 있다.
4. 문서 전체 교체는 브라우저 DOM Range만 변경하고 ProseMirror 내부 selection을 갱신하지 않는다. 따라서 변환 결과가 본문 전체를 대체하지 않고 이전 커서 위치나 문서 최상단에 삽입될 수 있다.
5. ADF를 Confluence 붙여넣기 HTML로 바꾸는 과정에서도 코드 언어, task node, expand 같은 의미가 축약된다. raw HTML과 인라인 `<br>`은 변환 단계에서 생략된다.

따라서 현재 문제를 단일 변환 라이브러리의 오작동으로 보면 안 된다. 다음 네 경계를 각각 분리해서 다뤄야 한다.

```text
CodeMirror 원문 추출
  → 일반 문단에서 Markdown 원문 재구성
  → Markdown을 ADF로 변환
  → ProseMirror 현재 위치에 결과 적용
```

## 2. 코드블럭 벗기기 분석

### 2.1 현재 처리 흐름

현재 기능은 본문의 코드 블록을 뒤에서부터 순회하면서 다음 순서로 처리한다.

```text
CodeMirror codeBlock DOM 탐색
  → `.cm-content .cm-line`의 textContent 결합
  → 일반 문단용 HTML 생성
  → MAIN world bridge로 원본 codeBlock NodeSelection
  → paste event로 원본 node 교체
```

원본 위치를 선택하는 단계는 Mermaid 원위치 문제를 해결하면서 ProseMirror `NodeSelection` 방식으로 보강되어 있다. 이번 데이터 유실의 핵심은 선택 위치보다 그 앞의 원문 추출 단계다.

### 2.2 1순위 원인: CodeMirror 화면 DOM만 읽음

원문 추출은 다음 두 DOM 경로에 의존한다.

- `.cm-content .cm-line`이 있으면 각 줄의 `textContent`를 `\n`으로 결합한다.
- 줄을 찾지 못한 경우에만 `.cm-content`의 `innerText`를 읽는다.

CodeMirror는 큰 문서를 전부 DOM에 올려두는 일반 textarea가 아니다. 성능을 위해 현재 보이는 범위와 그 주변만 렌더링할 수 있다. 따라서 긴 코드 블록의 실제 문서가 500줄이어도 DOM에는 현재 화면 주변 줄만 존재할 수 있다.

이 상태에서 `.cm-line`만 수집하면 다음과 같이 동작한다.

```text
CodeMirror 내부 문서: 1 ~ 500행
현재 DOM 렌더 범위: 180 ~ 240행
확장이 읽은 원문: 180 ~ 240행
교체 후 일반 문단: 180 ~ 240행만 남음
```

이는 사용자가 보고한 “코드 블럭을 벗기니 내용 일부가 유실됨”과 직접 일치하는 실패 형태다.

관련 공식 자료:

- [CodeMirror System Guide](https://codemirror.net/docs/guide/)
- [CodeMirror view 구현](https://github.com/codemirror/view/blob/main/src/editorview.ts)

현재 조사한 페이지의 코드 블록은 최대 14줄로 짧았으며 각 블록의 전체 `.cm-line`이 DOM에 존재했다. 따라서 현재 남아 있는 페이지 상태에서는 유실을 직접 재현하지 못했다. 다만 DOM에 렌더링된 줄만 읽는 구현과 CodeMirror의 가상 렌더링 계약은 확인됐다.

### 2.3 2순위 원인: 연속 빈 줄 축약

추출된 텍스트를 일반 문단 HTML로 바꿀 때 둘 이상의 개행을 정규식 `/\n{2,}/`로 나눈다. 이 과정에서는 다음 입력들이 같은 출력 구조로 축약될 수 있다.

```text
A\n\nB
A\n\n\nB
A\n\n\n\nB
```

즉, 텍스트 문자는 남더라도 빈 줄 개수와 Markdown의 수직 구조는 보존되지 않는다. 코드 블록 안에 Markdown 원문을 넣어둔 경우에는 이 차이가 후속 파싱 결과에 영향을 줄 수 있다.

### 2.4 현재 검증의 한계

- 유실되기 전의 긴 원본 코드 블록과 변환 후 결과를 동일 세션에서 확보하지 못했다.
- 현재 페이지의 짧은 코드 블록에서는 CodeMirror 가상 렌더링이 발생하지 않았다.
- 따라서 사용자가 겪은 특정 유실 범위를 행 단위로 대조하지는 못했다.

그러나 긴 CodeMirror 문서에서 DOM 줄 수와 실제 문서 줄 수가 다를 수 있다는 점, 현재 구현이 DOM 줄만 읽는다는 점은 확인된 사실이다.

## 3. Markdown -> ADF 변환 분석

### 3.1 현재 처리 흐름

```text
ProseMirror top-level node 수집
  → 일반 paragraph만 있는지 검사
  → paragraph별 평문 추출
  → paragraph를 `\n\n`으로 결합
  → marked lexer로 Markdown token 생성
  → 내부 ADF document 생성
  → ADF를 붙여넣기용 HTML로 직렬화
  → DOM Range로 편집기 전체 선택
  → synthetic paste event로 적용
```

문제는 파서 하나가 아니라 입력 재구성과 결과 적용 양쪽에 존재한다.

### 3.2 1순위 원인: Markdown 원문 재구성 과정의 구조 변경

Confluence 본문의 각 top-level paragraph는 다음 규칙으로 하나의 Markdown 문자열이 된다.

1. 각 paragraph의 텍스트 끝에 `trimEnd()` 적용
2. 모든 paragraph를 `\n\n`으로 연결
3. 전체 문자열에 `trim()` 적용

이 규칙은 편집 화면의 paragraph 경계가 Markdown의 빈 줄 경계와 정확히 같다는 전제를 둔다. 실제로는 사용자가 붙여넣은 한 줄 한 줄이 별도 paragraph가 될 수 있으므로 원문에 없던 빈 줄이 삽입된다.

영향은 다음과 같다.

| Markdown 요소 | 구조 변경 | 가능한 결과 |
| --- | --- | --- |
| GFM 표 | 모든 행 사이에 빈 줄 삽입 | 표가 여러 일반 문단으로 파싱됨 |
| fenced code | 코드 행 사이에 빈 줄 삽입 | 코드 내용에 불필요한 빈 줄이 생김 |
| hard break | 줄 끝 공백 두 개 제거 | 강제 개행 의미 소실 |
| 들여쓰기 코드 | 앞뒤 trim 영향 | code block 또는 중첩 의미 변경 |
| 목록 | 항목 사이 빈 줄 삽입 | loose list로 바뀌거나 문단 구조 변경 |

실제 `marked` lexer에 표 행 사이를 `\n\n`으로 연결한 입력을 전달하면 table token이 아니라 여러 paragraph token으로 나뉘는 것을 확인했다. 즉 ADF 변환기가 표를 놓치는 것이 아니라, 변환기에 전달되기 전에 이미 표 문법이 깨진다.

### 3.3 2순위 원인: DOM Range와 ProseMirror selection 불일치

문서 전체 교체는 브라우저 Selection에 DOM Range를 설정한 뒤 paste event를 발생시킨다. 그러나 Confluence 편집기는 ProseMirror 기반이므로 실제 삽입 위치와 교체 범위는 내부 `EditorState.selection`의 영향을 받는다.

Mermaid 원위치 삽입 문제를 조사할 때 다음 동작을 실제 편집기에서 확인했다.

- 화면 DOM에서는 원하는 노드가 선택된 것처럼 보인다.
- ProseMirror 내부 selection은 기존 커서 위치에 남는다.
- paste 결과는 DOM Range가 아니라 내부 selection 위치에 적용된다.
- 그 결과 새 component가 문서 최상단이나 이전 커서 위치에 생긴다.

코드 블록 하나를 선택하는 기능은 이후 MAIN world bridge를 통해 실제 `NodeSelection` transaction을 적용하도록 변경됐다. 반면 `Markdown -> ADF 변환`의 문서 전체 선택은 여전히 DOM Range만 사용한다.

따라서 다음 오동작이 가능하다.

- 본문 전체가 그대로 남고 변환 결과가 문서 최상단에 추가됨
- 기존 커서가 있던 문단만 교체됨
- 일부 내용만 변경됨
- 잘못된 위치에 삽입됐지만 성공으로 안내됨

### 3.4 성공 판정이 실제 요구사항보다 약함

현재 성공 조건은 paste 전후의 `editor.innerHTML`이 달라졌는지다. 이 조건은 “본문 전체가 변환 결과로 정확히 교체됐다”는 것을 검증하지 않는다.

```text
기대 결과: 기존 본문 전체 제거 + 변환 결과가 같은 위치에 삽입
현재 판정: 편집기 HTML 어딘가가 조금이라도 변경됨
```

따라서 문서 최상단에 결과가 추가되거나 일부만 변환돼도 기능은 성공으로 판단할 수 있다.

### 3.5 변환 단계에서 명시적으로 생략되는 데이터

Markdown -> ADF 변환기는 지원할 수 없는 raw HTML을 경고와 함께 생략한다.

- block HTML: 전체 node 생략
- inline HTML: 해당 token 생략
- 문단 중간 이미지: 실제 media 대신 링크 텍스트로 축약

조사에 사용한 실제 Markdown 샘플에는 표 셀 내부 줄바꿈을 나타내는 literal `<br>`이 47개 있었다. 현재 변환 규칙에서는 이 `<br>`들이 inline HTML로 분류되어 없어지므로 셀 내부의 여러 문장이 서로 붙을 수 있다.

이 경우 경고는 생성되지만, 편집 화면 적용 과정에서는 사용자가 어느 위치의 내용이 축약됐는지 바로 비교하기 어렵다.

### 3.6 ADF 붙여넣기 HTML 직렬화의 의미 축약

내부적으로 유효한 ADF document를 만들었더라도 Confluence 편집기에는 ADF JSON을 직접 전달하지 않는다. ADF를 일반 HTML로 다시 만든 뒤 paste event로 전달한다.

이 경계에서 확인된 축약은 다음과 같다.

| ADF node | 현재 붙여넣기 표현 | 손실 또는 위험 |
| --- | --- | --- |
| `codeBlock` | `<pre><code>` | `attrs.language`가 전달되지 않음 |
| `taskList`·`taskItem` | 일반 `<ul><li>`와 `☐`·`☑` 문자 | Confluence task node 의미 소실 |
| `expand` | `<details><summary>` | Confluence가 ADF expand로 수용하지 않음 |
| external media | `<img>` | tenant의 paste parser와 보안 정책에 따라 결과가 달라질 수 있음 |

특히 Mermaid fenced block은 내부 ADF에서 `expand` 안의 `codeBlock(language: mermaid)`로 만들어지지만, 붙여넣기 단계에서는 `<details>`와 언어 없는 `<pre><code>`가 된다. Popup에서 표시되는 ADF JSON과 실제 편집기에 적용되는 구조가 같다고 보장할 수 없다.

### 3.7 변환 불가 판정과의 관계

편집 본문이 일반 paragraph와 줄바꿈 외의 node를 하나라도 포함하면 `Markdown -> ADF 변환`은 안전을 위해 중단한다. 이는 기존 ADF 구조를 평문으로 덮어쓰지 않기 위한 의도된 보호 장치다.

다만 Confluence가 Markdown 붙여넣기 과정에서 제목, 목록, 링크 등을 자동 서식화하면 사용자가 원문이라고 생각하는 본문도 이미 paragraph-only 조건을 벗어날 수 있다. 이 경우 기능은 데이터 유실 대신 `변환 불가`를 표시한다.

## 4. 두 문제의 연쇄 가능성

사용자가 긴 Markdown 문서를 하나의 코드 블록에 넣고 다음 순서로 작업하면 문제가 누적될 수 있다.

```text
긴 Markdown codeBlock
  → 코드블럭 벗기기
     → CodeMirror DOM에 보이는 일부 줄만 추출될 가능성
     → 연속 빈 줄 축약
  → Markdown -> ADF 변환
     → paragraph마다 `\n\n` 삽입
     → 줄 끝 공백 제거
     → HTML `<br>` 생략
     → 불완전한 ProseMirror selection에 paste
```

최종 결과에서 내용이 사라졌더라도 어느 단계에서 발생했는지 화면만 보고 구분하기 어렵다. 분석과 검증에서는 각 단계 직전·직후의 원문을 별도로 비교해야 한다.

## 5. 테스트 공백

현재 단위 테스트는 다음 범위를 충분히 검증하지 않는다.

- CodeMirror 실제 문서 줄 수와 렌더링된 `.cm-line` 수가 다른 긴 코드 블록
- 세 개 이상 연속된 빈 줄의 정확한 보존
- paragraph 단위로 나뉜 GFM 표 원문 재구성
- 줄 끝 공백 두 개를 사용하는 Markdown hard break
- ProseMirror 내부 selection과 DOM Range가 다른 상태에서의 전체 교체
- 변환 결과가 원래 본문 전체를 정확히 대체했는지에 대한 구조 검증
- ADF `expand`, task node, code language가 Confluence paste 후 유지되는지
- literal `<br>`이 포함된 표 셀과 문단

현재 테스트가 통과하더라도 위 런타임 문제는 남을 수 있다. 데이터 모델 변환 테스트와 실제 Confluence 편집기 적용 테스트의 경계가 분리되어 있기 때문이다.

## 6. 확인된 사실, 추론, 미확정 사항

### 확인된 사실

- 코드 블록 원문은 CodeMirror의 `.cm-line` DOM만 수집한다.
- 일반 문단 HTML 생성 과정에서 둘 이상의 연속 개행을 같은 paragraph 경계로 취급한다.
- Markdown 원문 재구성은 paragraph마다 `\n\n`을 삽입하고 trailing whitespace를 제거한다.
- 문서 전체 선택은 DOM Range만 사용하며 MAIN world의 ProseMirror selection bridge를 사용하지 않는다.
- 성공 판정은 전체 교체 결과가 아니라 `innerHTML` 변경 여부만 본다.
- inline·block HTML은 ADF 변환 시 생략된다.
- 코드 언어, task node, expand는 붙여넣기 HTML 단계에서 동일한 ADF 의미로 보존되지 않는다.
- 현재 조사 페이지의 짧은 코드 블록들은 전체 줄이 DOM에 렌더링되어 있었다.

### 높은 신뢰도의 추론

- 긴 코드 블록에서 화면 밖 `.cm-line`이 생성되지 않으면 `코드블럭 벗기기` 결과에 해당 줄들이 포함되지 않는다.
- paragraph가 Markdown의 각 행에 대응하는 상태에서는 `\n\n` 결합 때문에 GFM 표와 코드 내용이 달라진다.
- ProseMirror 내부 selection이 이전 위치에 남아 있으면 Markdown 변환 결과가 본문 전체 대신 이전 커서 위치에 적용될 수 있다.

### 추가 확인이 필요한 사항

- 사용자가 실제로 유실한 원문의 전체 행 수와 유실된 정확한 구간
- 해당 시점 CodeMirror DOM의 렌더 범위와 실제 내부 document 길이
- Confluence가 Markdown 붙여넣기 시 paragraph를 나누는 조건과 tenant별 차이
- 긴 문서, 중첩 목록, 복합 표에서 Confluence paste parser가 수용하는 정확한 HTML 계약
- 실제 변환 후 저장 ADF에서 각 node 의미가 어느 수준까지 유지되는지

## 7. 수정 반영 결과

2026-08-12에 다음 변경을 반영했다.

### 코드블럭 벗기기

- CodeMirror의 `.cm-line` DOM을 원문 정본으로 사용하지 않는다.
- MAIN world bridge가 ProseMirror `codeBlock` node의 전체 `textContent`를 반환한다.
- 모든 코드 블록의 전체 원문을 먼저 확보한 뒤 뒤에서부터 원본 node를 교체한다.
- 원문 전체를 하나의 paragraph 안에서 `<br>`로 표현해 연속 빈 줄 개수를 축약하지 않는다.
- 전체 원문을 읽지 못하면 DOM 일부 내용으로 대체 실행하지 않고 실패 처리한다.

### Markdown -> ADF 변환

- paragraph 끝의 공백을 제거하지 않아 Markdown hard break용 공백을 보존한다.
- 빈 paragraph 경계는 유지하되 문서 바깥의 불필요한 개행만 제거한다.
- literal `<br>` 계열은 생략하지 않고 ADF `hardBreak`으로 변환한다.
- code language를 붙여넣기 HTML의 `data-language`로 전달한다.
- ADF `expand`는 `<details>` 대신 Confluence schema parser가 인식하는 `div[data-node-type="expand"]`로 전달한다.
- 문서 전체 선택에 DOM Range를 사용하지 않고 MAIN world의 ProseMirror `AllSelection` transaction을 사용한다.
- 기존 top-level node 전체가 제거된 경우만 교체 성공으로 판단한다.
- 부분 삽입 등 잘못된 변경이 감지되면 Confluence toolbar의 실행 취소로 자동 복구한다.

### 검증

- 연속 빈 줄, 줄 끝 공백, literal `<br>`, code language, expand 직렬화 회귀 테스트를 추가했다.
- TypeScript typecheck와 전체 단위 테스트를 통과했다.
- 프로덕션 extension 빌드를 완료했다.
- 사용자의 실제 긴 원문을 대상으로 한 저장 전후 행 단위 비교는 아직 수행하지 않았다.

### 후속 제품 변경

같은 날 편집기 toolbar의 본문 전체 `Markdown -> ADF 변환` 버튼을 제거했다. 기존 `코드블럭 벗기기`는 `코드블럭 -> ADF`로 대체했다.

- 코드블럭 원문을 일반 문단 HTML로 바꾸는 단계는 더 이상 사용하지 않는다.
- 각 코드블럭의 전체 원문을 Markdown -> ADF 변환기에 전달한다.
- 변환 결과를 해당 codeBlock의 `NodeSelection` 위치에 붙여넣는다.
- 정상 Mermaid component가 참조하는 접힌 source codeBlock은 변환하지 않는다.
- 이에 따라 본문 전체 paragraph 재구성과 `AllSelection` 경로는 편집기 기능에서 제거됐다.

## 8. 관련 문서

- [Confluence Markdown -> ADF 변환기 기능 spec](../spec/features/confluence-adf-markdown-tools.md)
- [Confluence Mermaid 동작 방식 분석](./confluence-mermaid-runtime-analysis.md)
