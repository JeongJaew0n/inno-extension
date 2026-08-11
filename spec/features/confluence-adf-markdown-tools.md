# Confluence Markdown -> ADF 변환기

- 상태: Active
- 최종 갱신일: 2026-08-11
- 대상 버전: 0.2.x

## 한 줄 요약

사용자가 입력한 Markdown을 네트워크 요청 없이 ADF로 변환하고, Popup에서 JSON을 확인하거나 Confluence 편집 본문에 적용한다.

## 배경과 사용자 문제

Markdown 문서를 Confluence 편집 형식으로 옮기려면 제목, 목록, 표, 코드 블록 같은 구조를 다시 작성해야 한다. 초기 통합안은 Atlassian API로 현재 문서를 읽고 쓰는 기능까지 포함했지만, 인증 정보 관리와 원격 문서 변경 위험이 단순 변환 요구에 비해 컸다.

현재 범위는 API를 사용하지 않는 로컬 변환 도구다. Popup에서는 변환 결과만 확인할 수 있고, Confluence `edit-v2` 화면에서는 본문에 붙여넣은 Markdown 원문을 현재 편집 콘텐츠로 바꿀 수 있다. 기존 `본문 Markdown 복사` 기능과 독립적이다.

## 목표

- Markdown의 주요 블록·인라인 구조를 ADF document JSON으로 변환한다.
- 변환 결과와 최상위 block 수를 Popup에서 확인할 수 있게 한다.
- Confluence 편집 화면에서 본문 전체의 Markdown 원문을 편집 가능한 문서 구조로 바꾼다.
- Confluence 편집 본문의 코드 블록을 일반 문단으로 되돌려 원문을 다시 편집하거나 변환할 수 있게 한다.
- 손실되거나 축약된 요소를 경고로 드러낸다.
- 입력과 결과를 브라우저 안에서만 처리한다.

## 비목표

- Confluence 문서를 API로 조회, 생성, 수정하거나 저장하지 않는다.
- 기존 본문 뒤에 내용을 추가하지 않는다. 편집기 동작은 본문 전체 교체다.
- ADF를 Markdown으로 역변환하지 않는다.
- 결과 복사, 파일 다운로드, 자동 업로드 기능을 제공하지 않는다.
- Atlassian 이메일이나 API 토큰을 요구하지 않는다.
- 로컬 이미지 업로드와 특정 Mermaid Forge 앱 매크로 생성을 지원하지 않는다.
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

기능이 활성화되면 Confluence `edit-v2` 편집기 toolbar에 `Markdown -> ADF 변환`과 `코드블럭 벗기기` 버튼을 표시한다.

- 사용자는 편집 본문에 Markdown 원문을 넣고 버튼을 누른다.
- 제목 입력란은 변환 대상에서 제외하고 본문 전체만 변환한다.
- 본문이 일반 문단과 줄바꿈만으로 구성된 경우에만 Markdown 원문으로 취급한다.
- 제목, 목록, 표, 인용, 코드 블록, 링크, 강조 등 Confluence 서식이 이미 적용된 본문은 손실 방지를 위해 변환하지 않는다.
- 변환은 현재 편집기 내용을 전체 선택한 뒤 한 번의 편집 transaction으로 교체한다.
- 변환 직후 Confluence의 실행 취소 기능으로 이전 본문을 복구할 수 있어야 한다.
- 확장은 `업데이트` 버튼을 누르지 않는다. 저장 여부는 사용자가 결정한다.
- 변환 경고가 있으면 버튼 상태와 hover 안내로 경고 수·내용을 확인할 수 있게 한다.

`코드블럭 벗기기`는 현재 본문 안의 모든 Confluence 코드 블록을 대상으로 한다.

- 코드 블록의 원문과 줄바꿈은 일반 문단으로 보존한다.
- 제목, 목록, 표, 인용, 매크로 등 코드 블록 밖의 기존 ADF 구조는 변환 대상으로 삼지 않는다.
- 코드 블록이 목록이나 다른 컨테이너 안에 있으면 그 컨테이너는 유지하고 코드 블록만 일반 문단으로 바꾼다.
- 실제 코드와 Markdown 원문을 자동으로 구분하지 않는다. 사용자가 버튼을 누르면 본문의 모든 코드 블록이 대상이 된다.
- 처리 개수와 실패 여부를 버튼 상태로 안내한다.
- 확장은 `업데이트` 버튼을 누르지 않으며, 사용자는 저장 전 결과를 검토하고 Confluence 실행 취소로 되돌릴 수 있다.

## 입력과 출력

- 입력: Popup의 UTF-8 Markdown 문자열·Markdown 파일 또는 현재 편집 본문의 일반 문단 텍스트
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

Mermaid fenced code block은 Mermaid 앱 매크로가 아니라 `expand` 안의 `codeBlock(language: mermaid)`로 변환한다. 따라서 ADF JSON을 다른 경로로 Confluence에 입력하더라도 서드파티 Mermaid 앱 렌더링을 보장하지 않는다.

이미 ADF인 본문의 Mermaid 자동 변환은 현재 범위에 포함하지 않는다. 조사된 Mermaid 기능은 Confluence 기본 node가 아니라 특정 Forge 앱의 `extension` node이며, 별도 코드 블록을 문서 내 순번으로 참조한다. API 없이 content script가 편집기 DOM만 조작하는 현재 구조에서는 외부 앱의 cross-origin 설정 iframe에 접근할 수 없고, 공개된 paste 계약으로 해당 `extension`을 안정적으로 생성할 수도 없다. Mermaid 문법 후보를 찾는 것까지는 가능하지만, 매크로 자동 생성은 공개 API 또는 검증된 editor extension 계약이 확보될 때 다시 검토한다.

## 손실과 경고

- Markdown raw HTML은 안전한 ADF 대응을 보장할 수 없어 생략하고 경고한다.
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

ADF JSON을 편집기 내부 상태에 직접 주입하는 방식은 Confluence의 비공개 editor 객체에 의존한다. 현재는 브라우저의 HTML paste 표현으로 전달하고 Confluence가 내부 ADF로 수용하게 한다. 이 방식도 editor DOM과 paste 계약에 의존하지만 비공개 상태 객체를 직접 조작하지 않는다는 장점이 있다.

이미 서식화된 본문을 다시 Markdown으로 간주하면 표, 매크로, 링크, 코드 같은 정보를 평문으로 축약할 수 있다. 따라서 자동 추측보다 안전을 우선해 일반 문단 형태의 원문만 허용한다.

코드 블록 벗기기는 전체 문서를 Markdown으로 재해석하지 않고 명시적인 코드 블록 node만 일반 문단으로 바꾼다. 이 때문에 기존 ADF 구조를 유지할 수 있지만, 실제 소스 코드 블록도 함께 벗겨진다. 자동 추측 대신 사용자 클릭과 저장 전 검토를 안전 경계로 둔다.

Mermaid 매크로 자동 생성은 현재의 로컬·무API 원칙과 양립하지 않는다. Forge 앱 식별자와 순번 parameter를 하드코딩하거나 비공개 ProseMirror 상태를 주입하면 구현은 가능할 수 있지만, 앱 업데이트와 문서 재배치에 취약하고 외부 매크로 설정 iframe을 완료할 수 없다. 따라서 지금은 source 보존만 지원한다.

결과 복사와 다운로드도 편리하지만 변환 이외의 전달 경로와 사용자 행동을 제품 계약에 추가한다. 현재는 결과 확인만 제공하고 필요성이 확인될 때 별도 기능으로 검토한다.

## 수용 기준

- Markdown 입력과 파일 입력이 동일한 변환 경로를 사용한다.
- 지원 요소가 유효한 ADF document 구조로 변환된다.
- 경고, 최상위 block 수와 Mermaid 수가 결과와 함께 표시된다.
- `edit-v2` 화면의 편집기 toolbar에 기능 버튼이 한 번만 표시된다.
- 같은 toolbar에서 `코드블럭 벗기기`를 실행하면 모든 코드 블록의 원문과 줄바꿈이 일반 문단으로 남고 다른 기존 서식은 유지된다.
- 일반 문단 형태의 Markdown 본문은 제목·목록·표·코드 등 식별 가능한 편집 구조로 교체된다.
- 이미 서식이 적용된 본문에서는 변환을 중단하고 이유를 안내한다.
- 편집기 변환 후 실행 취소가 가능하며 확장이 페이지 저장을 실행하지 않는다.
- 변환 과정에서 네트워크 요청, 시스템 클립보드 쓰기 또는 다운로드가 발생하지 않는다.
- manifest에 API용 host permission과 background service worker가 없다.
- API 인증·조회·쓰기 코드가 배포 산출물에 포함되지 않는다.
- typecheck, unit test, production build가 성공한다.

## 알려진 리스크와 열린 질문

- ADF schema는 지원 node보다 넓어 변환 결과가 모든 Confluence 입력 경로에서 동일하게 수용된다고 보장할 수 없다.
- Popup 안에서 긴 입력과 JSON 결과를 함께 다루는 사용성은 제한적이다.
- Confluence editor toolbar, ProseMirror DOM 또는 paste 처리 방식이 바뀌면 버튼 표시나 본문 적용이 중단될 수 있다.
- Mermaid source는 일반 코드 표현으로 보존되며 Mermaid Forge 앱 매크로로 자동 변환되지 않는다.
- 코드블럭 벗기기는 실제 코드와 Markdown 원문을 구분하지 않고 모든 코드 블록에 적용되므로 저장 전 검토가 필요하다.
- 편집기 적용 결과는 실제 `업데이트` 전 사용자가 검토해야 한다.

## 변경 이력

- 2026-08-11: 별도 Jira·Confluence 도구의 ADF 양방향 변환과 API 기반 문서 추가를 기본 OFF 기능으로 통합했다.
- 2026-08-11: 사용자 요구를 변환 자체로 재확정해 ADF -> Markdown, 인증, API 조회·쓰기, 현재 문서 추가, 복사·다운로드를 제거하고 로컬 Markdown -> ADF JSON 변환기만 유지했다.
- 2026-08-11: Confluence `edit-v2` toolbar에서 현재 본문의 Markdown 원문을 편집 콘텐츠로 변환하는 동작을 추가했다. API 저장 대신 편집기의 paste·실행 취소·사용자 업데이트 흐름을 사용하고, 이미 서식화된 본문은 손실 방지를 위해 거부한다.
- 2026-08-11: 편집 본문의 모든 코드 블록을 일반 문단으로 되돌리는 `코드블럭 벗기기`를 추가했다. 이미 ADF인 Mermaid source의 자동 매크로 변환은 Forge 앱의 비공개 extension 계약과 cross-origin 설정 UI 때문에 현재 무API 범위에서 제외하기로 했다.

## 관련 문서

- [제품 개요](../product-overview.md)
- [Confluence 문서 본문 Markdown 복사](./confluence-page-markdown-copy.md)
- [Confluence Mermaid 동작 분석](../../docs/confluence-mermaid-runtime-analysis.md)
- [용어사전](../glossary.md)
