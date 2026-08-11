# Confluence Markdown -> ADF 변환기

- 상태: Active
- 최종 갱신일: 2026-08-11
- 대상 버전: 0.2.x

## 한 줄 요약

사용자가 Extension Popup에 입력한 Markdown을 네트워크 요청 없이 ADF JSON 문서로 변환해 화면에 보여준다.

## 배경과 사용자 문제

Markdown 문서를 Confluence 편집 형식으로 옮기려면 제목, 목록, 표, 코드 블록 같은 구조를 다시 작성해야 한다. 초기 통합안은 Atlassian API로 현재 문서를 읽고 쓰는 기능까지 포함했지만, 인증 정보 관리와 원격 문서 변경 위험이 단순 변환 요구에 비해 컸다.

현재 범위는 변환 결과 자체를 확인하는 로컬 도구로 축소한다. 기존 `본문 Markdown 복사` 기능과 독립적이며 Confluence 페이지를 열어 둘 필요가 없다.

## 목표

- Markdown의 주요 블록·인라인 구조를 ADF document JSON으로 변환한다.
- 변환 결과와 최상위 block 수를 Popup에서 확인할 수 있게 한다.
- 손실되거나 축약된 요소를 경고로 드러낸다.
- 입력과 결과를 브라우저 안에서만 처리한다.

## 비목표

- Confluence 문서를 API로 조회, 생성, 수정하거나 기존 본문에 추가하지 않는다.
- ADF를 Markdown으로 역변환하지 않는다.
- 결과 복사, 파일 다운로드, 자동 업로드 기능을 제공하지 않는다.
- Atlassian 이메일, API 토큰 또는 현재 탭 정보를 요구하지 않는다.
- 로컬 이미지 업로드와 특정 Mermaid Forge 앱 매크로 생성을 지원하지 않는다.
- 모든 Confluence node와 서드파티 매크로를 손실 없이 생성하지 않는다.

## 사용자 경험과 행동 계약

사용자는 Confluence 서비스의 `Markdown -> ADF 변환` 기능 상세에서 Markdown을 직접 붙여넣거나 `.md`·`.markdown` 파일을 불러온다.

- 입력이 비어 있으면 변환 버튼을 사용할 수 없다.
- `ADF로 변환`을 누르면 읽기 전용 JSON 결과를 같은 화면에 표시한다.
- 결과 상단에는 최상위 block 수, Mermaid block 수, 경고 수를 표시한다.
- 입력을 바꾸면 이전 결과와 성공 안내를 현재 입력에 맞지 않는 결과로 간주해 숨긴다.
- 변환 가능한 내용이 없으면 결과 대신 오류를 표시한다.
- 기능 또는 Confluence 서비스가 OFF이면 입력값은 보존하되 변환 버튼을 사용할 수 없다.
- Popup을 닫으면 입력과 결과를 영구 저장하지 않는다.

## 입력과 출력

- 입력: UTF-8 Markdown 문자열 또는 사용자가 선택한 Markdown 텍스트 파일
- 출력: `type: "doc"`, `version: 1`, `content` 배열을 갖는 ADF JSON
- 처리 위치: Extension Popup의 로컬 JavaScript 실행 환경
- 네트워크: 사용하지 않음
- 외부 상태 변경: 없음

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

## 손실과 경고

- Markdown raw HTML은 안전한 ADF 대응을 보장할 수 없어 생략하고 경고한다.
- 문단 중간 이미지는 링크 텍스트로 축약하고 경고한다.
- 로컬·상대 경로 이미지는 업로드하지 않고 자리표시자 텍스트로 바꾸며 경고한다.
- 외부 HTTP 이미지는 external media 참조로 표현하지만 실제 Confluence 수용 여부는 이 기능이 보장하지 않는다.

## 설정과 호환성

- 기능 기본값은 OFF다.
- 서비스 gate와 기능 enabled 값이 모두 ON일 때만 변환할 수 있다.
- 기존 사용자 설정을 잃지 않기 위해 내부 기능 ID `pageMarkdownAppend`는 유지한다. 사용자에게 보이는 계약에는 문서 추가 동작이 없다.
- 일반 enabled 설정 외 인증 정보나 변환 결과는 저장하지 않는다.

## 보안과 권한

- 변환 기능은 `storage` 외 추가 Chrome 권한을 요구하지 않는다.
- Atlassian API, 현재 탭 URL, 로그인 쿠키, 인증 토큰에 접근하지 않는다.
- Markdown 입력과 ADF 결과를 외부 서버로 전송하지 않는다.
- 결과 JSON 안에는 사용자가 입력한 본문이 포함되므로 화면 공유나 수동 반출 시 사용자가 민감정보를 확인해야 한다.

## 결정과 트레이드오프

원격 문서 추가까지 자동화하면 작업 단계는 줄지만 API 토큰 보관, host permission, version conflict, 잘못된 문서 변경 복구가 필요하다. 사용자의 현재 요구는 변환 결과만이므로 이 책임을 제거하고 로컬 변환기로 범위를 제한했다.

결과 복사와 다운로드도 편리하지만 변환 이외의 전달 경로와 사용자 행동을 제품 계약에 추가한다. 현재는 결과 확인만 제공하고 필요성이 확인될 때 별도 기능으로 검토한다.

## 수용 기준

- Markdown 입력과 파일 입력이 동일한 변환 경로를 사용한다.
- 지원 요소가 유효한 ADF document 구조로 변환된다.
- 경고, 최상위 block 수와 Mermaid 수가 결과와 함께 표시된다.
- 변환 과정에서 네트워크 요청, 클립보드 쓰기, 다운로드, Confluence 문서 변경이 발생하지 않는다.
- manifest에 API용 host permission과 background service worker가 없다.
- API 인증·조회·쓰기 코드가 배포 산출물에 포함되지 않는다.
- typecheck, unit test, production build가 성공한다.

## 알려진 리스크와 열린 질문

- ADF schema는 지원 node보다 넓어 변환 결과가 모든 Confluence 입력 경로에서 동일하게 수용된다고 보장할 수 없다.
- Popup 안에서 긴 입력과 JSON 결과를 함께 다루는 사용성은 제한적이다.
- 결과를 실제 Confluence에 전달하는 방식은 현재 범위 밖이며 확정하지 않았다.

## 변경 이력

- 2026-08-11: 별도 Jira·Confluence 도구의 ADF 양방향 변환과 API 기반 문서 추가를 기본 OFF 기능으로 통합했다.
- 2026-08-11: 사용자 요구를 변환 자체로 재확정해 ADF -> Markdown, 인증, API 조회·쓰기, 현재 문서 추가, 복사·다운로드를 제거하고 로컬 Markdown -> ADF JSON 변환기만 유지했다.

## 관련 문서

- [제품 개요](../product-overview.md)
- [Confluence 문서 본문 Markdown 복사](./confluence-page-markdown-copy.md)
- [Confluence Mermaid 동작 분석](../../docs/confluence-mermaid-runtime-analysis.md)
- [용어사전](../glossary.md)
