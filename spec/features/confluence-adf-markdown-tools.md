# Confluence Markdown -> ADF 변환기

- 상태: Active
- 최종 갱신일: 2026-08-12
- 대상 버전: 0.2.x

## 한 줄 요약

사용자가 입력한 Markdown을 네트워크 요청 없이 ADF로 변환한다. Popup에서는 JSON을 확인하고, Confluence 편집기에서는 코드블럭 안의 Markdown을 원래 위치의 편집 콘텐츠로 바꾼다.

## 배경과 사용자 문제

Markdown 문서를 Confluence 편집 형식으로 옮기려면 제목, 목록, 표, 코드 블록 같은 구조를 다시 작성해야 한다. 초기 통합안은 Atlassian API로 현재 문서를 읽고 쓰는 기능까지 포함했지만, 인증 정보 관리와 원격 문서 변경 위험이 단순 변환 요구에 비해 컸다.

현재 범위는 API를 사용하지 않는 로컬 변환 도구다. Popup에서는 변환 결과만 확인할 수 있고, Confluence `edit-v2` 화면에서는 코드블럭 안에 넣은 Markdown 원문을 해당 코드블럭 위치의 편집 콘텐츠로 바꿀 수 있다. 기존 `본문 Markdown 복사` 기능과 독립적이다.

## 목표

- Markdown의 주요 블록·인라인 구조를 ADF document JSON으로 변환한다.
- 변환 결과와 최상위 block 수를 Popup에서 확인할 수 있게 한다.
- Confluence 편집 화면에서 코드블럭 안의 Markdown 원문을 편집 가능한 ADF 구조로 바꾼다.
- Mermaid 선언이 들어 있는 기존 코드 블록만 찾아 사내 Confluence의 Mermaid ADF 매크로와 연결한다.
- 손실되거나 축약된 요소를 경고로 드러낸다.
- 입력과 결과를 브라우저 안에서만 처리한다.

## 비목표

- Confluence 문서를 API로 조회, 생성, 수정하거나 저장하지 않는다.
- 기존 본문 뒤에 내용을 추가하거나 본문 전체를 변환하지 않는다. 편집기 동작은 대상 코드블럭의 원위치 교체다.
- ADF를 Markdown으로 역변환하지 않는다.
- 결과 복사, 파일 다운로드, 자동 업로드 기능을 제공하지 않는다.
- Atlassian 이메일이나 API 토큰을 요구하지 않는다.
- 로컬 이미지 업로드를 지원하지 않는다.
- 사내 Confluence에 설치된 Mermaid 앱 외 다른 서드파티 매크로를 생성하지 않는다.
- 모든 Confluence node와 서드파티 매크로를 손실 없이 생성하지 않는다.

## 사용자 경험과 행동 계약

### Popup 변환기

사용자는 Confluence 서비스의 `Markdown -> ADF 변환` 기능 상세에서 Markdown을 직접 붙여넣거나 `.md`·`.markdown` 파일을 불러온다.

- 입력이 비어 있으면 변환 버튼을 사용할 수 없다.
- `ADF로 변환`을 누르면 읽기 전용 JSON 결과를 같은 화면에 표시한다.
- 결과 상단에는 최상위 block 수, Mermaid block 수, 경고 수를 표시한다.
- 입력을 바꾸면 이전 결과와 성공 안내를 현재 입력에 맞지 않는 결과로 간주해 숨긴다.
- 변환 가능한 내용이 없으면 결과 대신 오류를 표시한다.
- 기능 또는 Confluence 서비스가 OFF이면 입력값은 보존하되 변환 버튼을 사용할 수 없다.
- Popup을 닫으면 입력과 결과를 영구 저장하지 않는다.

### Confluence 편집기 변환

기능이 활성화되면 Confluence `edit-v2` 편집기 toolbar에 왼쪽부터 `Mermaid -> ADF`, `코드블럭 -> ADF` 버튼을 표시한다. 편집기 toolbar에는 본문 전체를 대상으로 하는 `Markdown -> ADF 변환` 버튼을 표시하지 않는다.

`코드블럭 -> ADF`는 현재 본문 안의 Confluence 코드 블록을 대상으로 한다.

- 각 코드블럭의 전체 원문을 독립적인 Markdown 문서로 해석한다.
- 제목, 문단, 목록, 표, 인용, 코드, 링크 등 지원 Markdown 요소를 ADF로 변환하고, 원본 코드블럭을 같은 위치의 Confluence 편집 콘텐츠로 교체한다.
- 긴 코드 블록도 화면에 보이는 일부 줄이 아니라 ProseMirror 문서에 저장된 전체 원문을 사용한다.
- 제목, 목록, 표, 인용, 매크로 등 코드 블록 밖의 기존 ADF 구조는 변환 대상으로 삼지 않는다.
- 코드 블록이 목록이나 다른 컨테이너 안에 있으면 그 컨테이너를 유지하고 코드 블록만 변환 결과로 바꾼다.
- 실제 코드와 Markdown 원문을 자동으로 구분하지 않는다. 사용자가 버튼을 누르면 보호 대상 Mermaid 원본을 제외한 모든 코드 블록이 대상이 된다.
- 정상 Mermaid component가 참조하는 접힌 원본 코드블럭은 component 손상을 막기 위해 변환 대상에서 제외한다.
- 모든 코드블럭의 원문 읽기와 Markdown 변환 가능 여부를 먼저 확인한 뒤 뒤에서부터 교체한다.
- 원본 codeBlock이 실제로 제거된 경우만 성공으로 판단한다. 잘못된 위치에 적용된 경우 toolbar 실행 취소로 해당 변경을 복구한다.
- 처리 개수, 경고 수, 제외한 Mermaid 원본과 실패 여부를 버튼 상태·hover로 안내한다.
- 확장은 `업데이트` 버튼을 누르지 않으며, 사용자는 저장 전 결과를 검토하고 Confluence 실행 취소로 되돌릴 수 있다.

`Mermaid -> ADF`는 현재 본문의 코드 블록 중 첫 유효 선언이 Mermaid diagram type인 블록만 대상으로 한다.

- 빈 줄과 `%%` 주석·초기화 지시문을 건너뛴 첫 줄이 `flowchart LR`, `sequenceDiagram`, `stateDiagram-v2` 등 지원 Mermaid 선언과 일치해야 한다.
- 일반 JavaScript, shell, JSON 같은 코드 블록은 변경하지 않는다.
- MAIN world bridge가 해당 codeBlock의 ProseMirror document position에 실제 `NodeSelection` transaction을 적용한 뒤, 한 번의 paste transaction으로 사내 Confluence의 `Mermaid diagram` ADF `extension`과 접힌 source로 교체한다.
- 매크로의 `guestParams.index`에는 변환 직전 본문 전체 코드 블록에서 해당 원본이 차지하는 0부터 시작하는 순번을 넣는다.
- Forge 앱이 source codeBlock을 index로 참조하므로 node를 실제 삭제하지 않고 `Mermaid 원본` 접힌 영역 안에 보존한다.
- source가 `expand` 안에 있고 그 top-level node 바로 앞이 동일 Mermaid extension인 경우만 이미 변환된 정상 pair로 본다.
- 여러 후보는 뒤에서부터 처리해 앞쪽 삽입이 기존 코드 블록 순번에 영향을 주지 않게 한다.
- Confluence의 비동기 node view 생성을 최대 3초 기다리고, extension과 접힌 source가 원래 위치에서 인접한 경우에만 성공으로 판단한다.
- macro가 문서 최상단으로 이동하거나 원본이 그대로 남는 등 검증에 실패하면 Confluence toolbar의 실제 실행 취소 명령으로 해당 paste transaction을 되돌린다.
- source와 연결되지 않은 기존 Mermaid component가 있으면 추가 중복을 막기 위해 변환을 중단하고 정리를 안내한다.
- 처리 개수와 실패 여부를 버튼 상태로 안내하며, 확장은 페이지를 저장하지 않는다.

## 입력과 출력

- 입력: Popup의 UTF-8 Markdown 문자열·Markdown 파일 또는 현재 편집 본문의 코드블럭 원문
- Popup 출력: `type: "doc"`, `version: 1`, `content` 배열을 갖는 ADF JSON
- 편집기 출력: 변환된 ADF를 Confluence 편집기가 수용하는 paste 표현으로 전달한 현재 draft 본문
- 처리 위치: Extension Popup 또는 Confluence content script의 로컬 JavaScript 실행 환경
- 네트워크: 사용하지 않음
- 외부 상태 변경: 편집기 draft 상태만 변경하며 페이지 저장은 하지 않음

## 변환 지원 범위

- 제목과 문단
- 줄바꿈과 구분선
- 인용
- 순서 있는 목록, 순서 없는 목록, 작업 목록
- GFM 표
- fenced code block과 inline code
- 굵게, 기울임, 취소선
- 링크
- Markdown `<details><summary>` 형태의 펼치기 영역
- 외부 HTTP 이미지 참조
- Mermaid fenced code block의 source 보존

Popup의 Markdown 변환 결과에서 Mermaid fenced code block은 Mermaid 앱 매크로가 아니라 `expand` 안의 `codeBlock(language: mermaid)`로 보존한다. Popup 변환기는 tenant나 페이지 문맥을 모르기 때문에 서드파티 Mermaid 앱 렌더링을 보장하지 않는다.

편집 화면의 `Mermaid -> ADF`는 이미 코드 블록으로 구성된 본문을 별도로 처리한다. 조사된 Mermaid 기능은 Confluence 기본 node가 아니라 특정 Forge 앱의 `extension` node이며, 별도 코드 블록을 문서 내 순번으로 참조한다. 구현은 Atlassian ADF schema의 `data-node-type="extension"` DOM 표현을 paste payload로 사용하며, 현재 tenant가 이를 비동기로 실제 macro node로 수용하는 것을 저장 ADF에서 확인했다.

## 손실과 경고

- Markdown raw HTML은 안전한 ADF 대응을 보장할 수 없어 생략하고 경고한다.
- raw HTML 중 `<br>`, `<br/>`, `<br />`은 ADF `hardBreak`으로 보존한다.
- 문단 중간 이미지는 링크 텍스트로 축약하고 경고한다.
- 로컬·상대 경로 이미지는 업로드하지 않고 자리표시자 텍스트로 바꾸며 경고한다.
- 외부 HTTP 이미지는 external media 참조로 표현하지만 실제 Confluence 수용 여부는 이 기능이 보장하지 않는다.

## 설정과 호환성

- 기능 기본값은 OFF다.
- 서비스 gate와 기능 enabled 값이 모두 ON일 때만 변환할 수 있다.
- Popup 변환기와 편집기 버튼은 같은 기능 enabled 값을 공유한다.
- 기존 사용자 설정을 잃지 않기 위해 내부 기능 ID `pageMarkdownAppend`는 유지한다. 사용자에게 보이는 계약에는 문서 추가 동작이 없다.
- 일반 enabled 설정 외 인증 정보나 변환 결과는 저장하지 않는다.

## 보안과 권한

- 변환 기능은 `storage` 외 추가 Chrome 권한을 요구하지 않는다.
- Atlassian API, 로그인 쿠키, 인증 토큰에 접근하지 않는다.
- Markdown 입력과 ADF 결과를 외부 서버로 전송하지 않는다.
- 편집기 적용은 현재 `edit-v2` DOM에만 수행하고 확장이 페이지를 저장하지 않는다.
- 결과 JSON 안에는 사용자가 입력한 본문이 포함되므로 화면 공유나 수동 반출 시 사용자가 민감정보를 확인해야 한다.

## 결정과 트레이드오프

원격 문서 추가까지 자동화하면 작업 단계는 줄지만 API 토큰 보관, host permission, version conflict, 잘못된 문서 변경 복구가 필요하다. 편집기 안에서 변환하고 사용자가 저장하게 하면 같은 편집 세션의 실행 취소와 검토 흐름을 유지하면서 이 책임을 제거할 수 있다.

ADF JSON 자체는 편집기 내부 상태에 직접 주입하지 않는다. DOM Range만으로는 ProseMirror의 내부 selection이 바뀌지 않으므로 MAIN world bridge가 EditorView를 찾아 대상 codeBlock에 `NodeSelection` transaction을 적용한다. 코드 블록 원문도 CodeMirror의 가상화된 화면 DOM 대신 같은 bridge를 통해 ProseMirror node의 전체 `textContent`를 읽는다. 실제 콘텐츠는 HTML paste 표현으로 전달하고 Confluence가 내부 ADF로 수용한다. 따라서 REST API와 추가 Chrome 권한은 필요 없지만, Atlassian의 비공개 EditorView 구조에 대한 의존성은 명시적인 호환성 리스크다.

편집기 본문 전체를 Markdown으로 추정하는 기능은 제거했다. Markdown 원문을 코드블럭이라는 명시적인 경계 안에 넣게 하면 기존 제목·목록·표·매크로를 변환 대상으로 오인하지 않고, 교체 범위를 개별 NodeSelection으로 제한할 수 있다. 실제 코드 블록도 Markdown으로 해석될 수 있으므로 사용자 클릭과 저장 전 검토를 안전 경계로 둔다.

Mermaid 매크로 콘텐츠는 ADF schema의 DOM 표현을 사용한다. 원위치 선택에만 MAIN world의 ProseMirror transaction을 사용하며, 매크로 node 자체를 transaction으로 직접 만들지는 않는다. 실제 tenant에서 원위치 extension과 `expand` pair가 생성되는 것을 확인했지만, 선택 bridge와 paste 표현 모두 공개 API가 아니므로 Confluence editor 변경에 취약하다. source를 실제 삭제할 수 없는 앱 계약은 접힌 원본 영역으로 해결한다.

결과 복사와 다운로드도 편리하지만 변환 이외의 전달 경로와 사용자 행동을 제품 계약에 추가한다. 현재는 결과 확인만 제공하고 필요성이 확인될 때 별도 기능으로 검토한다.

## 수용 기준

- Markdown 입력과 파일 입력이 동일한 변환 경로를 사용한다.
- 지원 요소가 유효한 ADF document 구조로 변환된다.
- 경고, 최상위 block 수와 Mermaid 수가 결과와 함께 표시된다.
- `edit-v2` 화면의 편집기 toolbar에 기능 버튼이 한 번만 표시된다.
- 같은 toolbar에서 `코드블럭 -> ADF`를 실행하면 각 코드블럭의 Markdown이 원래 위치의 제목·문단·목록·표·코드 등 식별 가능한 편집 구조로 교체된다.
- 긴 코드 블록도 화면 DOM 일부가 아닌 전체 원문을 변환한다.
- 정상 Mermaid component가 참조하는 접힌 원본 코드블럭은 변경하지 않는다.
- `Mermaid -> ADF`는 Mermaid 후보만 골라 원래 top-level 위치에 `Mermaid diagram` extension을 만든다.
- raw codeBlock은 화면에 그대로 노출되지 않고 접힌 `Mermaid 원본` 안에 보존된다.
- 정상 pair가 아닌 기존 Mermaid component가 있으면 중복 생성 없이 중단한다.
- 편집기 변환 후 실행 취소가 가능하며 확장이 페이지 저장을 실행하지 않는다.
- 변환 과정에서 네트워크 요청, 시스템 클립보드 쓰기 또는 다운로드가 발생하지 않는다.
- manifest에 API용 host permission과 background service worker가 없다.
- MAIN world bridge는 현재 편집기의 codeBlock 원문 읽기와 codeBlock 선택만 허용하며 임의 콘텐츠나 ADF를 직접 주입하지 않는다.
- API 인증·조회·쓰기 코드가 배포 산출물에 포함되지 않는다.
- typecheck, unit test, production build가 성공한다.

## 알려진 리스크와 열린 질문

- ADF schema는 지원 node보다 넓어 변환 결과가 모든 Confluence 입력 경로에서 동일하게 수용된다고 보장할 수 없다.
- Popup 안에서 긴 입력과 JSON 결과를 함께 다루는 사용성은 제한적이다.
- Confluence editor toolbar, ProseMirror DOM 또는 paste 처리 방식이 바뀌면 버튼 표시나 본문 적용이 중단될 수 있다.
- 과거 대상 페이지 version 4에는 문서 맨 앞의 중복 Mermaid component 6개가 저장됐지만 version 5에서 정리됐다. 다른 문서에 unpaired component가 남아 있으면 자동 삭제하지 않고 사용자의 정리를 요구한다.
- Mermaid extension key와 `guestParams.index` 계약이 앱 업데이트로 바뀌면 새 매크로가 렌더링되지 않을 수 있다.
- 코드 블록을 삽입·삭제·재정렬한 뒤 Forge 앱이 저장된 index를 자동 보정하는지는 추가 검증이 필요하다.
- `코드블럭 -> ADF`는 실제 코드와 Markdown 원문을 구분하지 않는다. fence가 없는 실제 소스 코드도 Markdown 문단으로 해석될 수 있으므로 저장 전 검토가 필요하다.
- 편집기 적용 결과는 실제 `업데이트` 전 사용자가 검토해야 한다.

## 변경 이력

- 2026-08-11: 별도 Jira·Confluence 도구의 ADF 양방향 변환과 API 기반 문서 추가를 기본 OFF 기능으로 통합했다.
- 2026-08-11: 사용자 요구를 변환 자체로 재확정해 ADF -> Markdown, 인증, API 조회·쓰기, 현재 문서 추가, 복사·다운로드를 제거하고 로컬 Markdown -> ADF JSON 변환기만 유지했다.
- 2026-08-11: Confluence `edit-v2` toolbar에서 현재 본문의 Markdown 원문을 편집 콘텐츠로 변환하는 동작을 추가했다. API 저장 대신 편집기의 paste·실행 취소·사용자 업데이트 흐름을 사용하고, 이미 서식화된 본문은 손실 방지를 위해 거부한다.
- 2026-08-11: 편집 본문의 모든 코드 블록을 일반 문단으로 되돌리는 `코드블럭 벗기기`를 추가했다. 이미 ADF인 Mermaid source의 자동 매크로 변환은 Forge 앱의 비공개 extension 계약과 cross-origin 설정 UI 때문에 현재 무API 범위에서 제외하기로 했다.
- 2026-08-11: Atlassian ADF schema의 extension paste 계약을 확인해 기존 결정을 갱신했다. `Mermaid -> ADF`가 Mermaid 선언 코드 블록만 탐지하고 원본 뒤에 현재 tenant의 `Mermaid diagram` extension을 생성하도록 추가했다.
- 2026-08-12: 저장 ADF에서 실제 extension 6개를 확인해 앞선 실패 결론을 정정했다. 비동기 생성을 기다리고 editor top-level wrapper 앞에 삽입하며, source를 접힌 영역에 보존하고 unpaired 기존 component가 있으면 중복 생성을 막도록 계약을 수정했다.
- 2026-08-12: macro 삽입 후 source를 별도로 접는 두 단계 paste가 selection을 잃어 macro와 원문을 문서 최상단에 남기는 문제를 확인했다. 원본 codeBlock을 `extension + 접힌 source`로 한 번에 교체하고 위치 검증 실패 시 자동 실행 취소하도록 수정했다.
- 2026-08-12: DOM Range와 `selectionchange` 대기로도 ProseMirror 내부 selection이 바뀌지 않는 것을 Chrome에서 재확인했다. MAIN world bridge가 codeBlock의 ViewDesc position과 React fiber의 EditorView를 찾아 실제 `NodeSelection` transaction을 적용하도록 수정했다. `<details>` 대신 공식 ADF schema가 인식하는 `data-node-type="expand"`를 사용하고, 실제 toolbar 실행 취소와 엄격한 pair 판정을 적용했다. 대상 문서에서 두 후보가 각각 원래 문맥의 top-level `extension + expand`로 생성되고 재실행 시 중복되지 않음을 확인했다.
- 2026-08-12: 코드블럭 벗기기가 CodeMirror 화면 DOM만 읽어 긴 원문의 일부를 잃을 수 있는 문제를 수정했다. ProseMirror codeBlock node의 전체 원문을 읽고 연속 빈 줄을 단일 문단의 `<br>` 구조로 보존한다.
- 2026-08-12: Markdown 편집기 변환의 DOM Range 전체 선택을 ProseMirror `AllSelection`으로 교체하고, 원본 top-level node가 모두 교체된 경우만 성공으로 판정하도록 강화했다. 잘못 적용된 변경은 toolbar 실행 취소로 자동 복구한다. 줄 끝 공백과 literal `<br>`을 보존하고 code language·expand의 Confluence schema HTML 표현도 보강했다.
- 2026-08-12: 편집기 toolbar의 본문 전체 `Markdown -> ADF 변환` 버튼을 제거했다. 기존 `코드블럭 벗기기`는 `코드블럭 -> ADF`로 변경하고, 코드블럭 원문을 단순 문단으로 푸는 대신 Markdown -> ADF 변환 결과로 원위치 교체하도록 행동 계약을 변경했다. 정상 Mermaid component가 참조하는 접힌 원본은 보호한다.
- 2026-08-12: 편집기 toolbar에서 `Mermaid -> ADF`를 왼쪽, `코드블럭 -> ADF`를 오른쪽에 배치했다.

## 관련 문서

- [제품 개요](../product-overview.md)
- [Confluence 문서 본문 Markdown 복사](./confluence-page-markdown-copy.md)
- [Confluence Mermaid 동작 분석](../../docs/confluence-mermaid-runtime-analysis.md)
- [코드블럭 벗기기 및 Markdown -> ADF 데이터 유실 분석](../../docs/confluence-markdown-adf-data-loss-analysis.md)
- [용어사전](../glossary.md)
