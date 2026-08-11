# Confluence ADF Markdown 도구

- 상태: Active
- 최종 갱신일: 2026-08-11
- 대상 버전: 0.2.x

## 한 줄 요약

사용자가 명시적으로 설정한 Atlassian API 인증으로 현재 Confluence 문서의 ADF 본문을 Markdown으로 내보내거나, 입력한 Markdown을 문서 맨 아래에 추가한다.

## 배경과 사용자 문제

렌더링된 DOM을 읽는 기존 `본문 Markdown 복사`는 설정 없이 빠르게 동작하지만 Confluence의 펼치기, 작업 목록, 업로드 이미지처럼 화면 표현만으로 원래 문서 구조를 정확히 복원하기 어려운 요소가 있다. 반대로 Markdown 문서를 Confluence에 옮길 때는 표, 목록, 코드 블록을 수동으로 다시 작성해야 한다.

ADF 도구는 Confluence의 문서 모델을 직접 읽고 쓰는 선택 기능으로 이 문제를 줄인다. 기존 한 번 클릭 DOM 복사를 대체하지 않는다.

## 기능 구성과 기본값

| 기능 | 기본값 | 역할 |
| --- | --- | --- |
| 본문 Markdown 고정밀 내보내기 | OFF | 현재 문서 ADF를 Markdown 일반 텍스트로 복사 |
| Markdown 본문 추가 | OFF | 입력한 Markdown을 ADF로 바꿔 현재 문서 맨 아래에 추가 |

두 기능은 Confluence 서비스 전체 기능이 ON이고 해당 기능도 ON일 때 Popup 기능 상세에서 사용할 수 있다.

## 목표

- 기존 DOM 복사보다 문서 구조에 가까운 Markdown 결과를 제공한다.
- Markdown의 제목, 문단, 목록, 작업 목록, 표, 코드와 기본 인라인 서식을 Confluence 본문으로 옮긴다.
- 원격 문서 변경 전 대상과 변경 방향을 사용자가 알 수 있게 한다.
- 인증 정보와 네트워크 권한을 필요한 origin과 extension context로 제한한다.
- 변환할 수 없는 요소를 숨기지 않고 경고한다.

## 비목표

- 기존 DOM 기반 `본문 Markdown 복사`를 제거하거나 자동으로 대체하지 않는다.
- 새 Confluence 페이지를 생성하지 않는다.
- 현재 문서의 기존 본문을 교체하지 않는다.
- 모든 Confluence 매크로와 서드파티 앱을 손실 없이 변환하지 않는다.
- 이미지 upload/download와 특정 Mermaid Forge 앱 삽입을 첫 텍스트 통합 범위에 포함하지 않는다.
- storage XML·ADF JSON 원문을 일반 사용자용 디버그 화면으로 제공하지 않는다.

## 대상 사이트와 페이지

- 서비스: `Confluence`
- 허용 origin: `https://pms-innogrid.atlassian.net`
- 대상: page ID를 식별할 수 있는 문서 조회, 편집, 초안 URL
- 다른 Atlassian tenant와 임의 origin은 지원하지 않는다.

## 인증 설정 계약

사용자는 Popup의 Confluence 기능 상세에서 Atlassian 계정 이메일과 API 토큰을 직접 저장한다.

- API 토큰은 `chrome.storage.local`에만 저장하고 sync하지 않는다.
- 로컬 저장소는 암호화된 비밀 저장소가 아니라는 안내를 표시한다.
- 저장 여부는 보여주되 저장된 토큰 문자열을 다시 UI로 반환하지 않는다.
- 사용자는 저장된 인증 정보를 삭제할 수 있다.
- token은 content script, 로그, 오류 메시지, spec, 테스트 fixture에 포함하지 않는다.
- REST 요청은 사내 Atlassian origin으로만 전송한다.

## 고정밀 내보내기 행동 계약

사용자가 `Markdown으로 복사`를 누르면 다음을 수행한다.

1. 현재 활성 탭에서 Confluence page ID를 식별한다.
2. 저장된 인증으로 현재 또는 draft 페이지의 ADF 본문을 조회한다.
3. 지원하는 ADF node를 Markdown으로 변환한다.
4. Markdown 일반 텍스트를 클립보드에 기록한다.
5. 성공, 실패, 손실 가능성을 기능 상세에 표시한다.

업로드 이미지 bytes는 텍스트 복사에 포함하지 않는다. 이미지 참조가 있으면 Markdown 경로와 함께 별도 다운로드 기능이 필요하다는 경고를 표시한다.

## Markdown 본문 추가 행동 계약

사용자는 Popup에서 Markdown을 붙여넣거나 `.md` 파일을 선택한다. 실행 전에 다음 정보를 확인할 수 있어야 한다.

- 대상 문서 제목과 page ID
- 문서 상태(current/draft)
- 추가될 최상위 block 수
- 변환 중 발생한 경고
- 기존 본문을 교체하지 않고 맨 아래에 추가한다는 사실

사용자가 명시적으로 실행하면 현재 ADF document의 `content` 끝에 변환된 node를 추가하고 같은 문서 상태로 저장한다.

- current 페이지는 현재 version 다음 번호로 쓴다.
- draft 페이지는 draft 상태와 허용되는 version 규칙을 보존한다.
- 조회 이후 문서가 바뀌어 version conflict가 발생하면 덮어쓰거나 자동 재시도하지 않고 중단한다.
- 성공 후 사용자가 대상 탭을 새로고침해 결과를 확인할 수 있게 한다.

## 변환 계약

### 공통 지원 요소

- 제목과 문단
- 줄바꿈과 구분선
- 인용
- 순서 있는 목록, 순서 없는 목록, 작업 목록
- GFM 표
- fenced code block과 inline code
- 굵게, 기울임, 취소선
- 링크
- 펼치기 영역
- 외부 HTTP 이미지 참조
- Mermaid source fenced code block 보존

### 손실과 경고

- 알 수 없는 ADF node는 가능한 경우 자식 텍스트를 보존하되 고유한 동작은 손실될 수 있다.
- Markdown raw HTML은 안전하게 그대로 옮길 수 없으므로 생략하고 경고한다.
- 문단 중간 이미지와 선택하지 않은 로컬 이미지는 link 또는 자리표시자로 축약될 수 있다.
- 서드파티 extension node는 해당 기능의 원본 source가 별도로 보존된 경우를 제외하고 생략될 수 있다.

## 권한과 네트워크 경계

- `storage`: 일반 설정과 로컬 인증 정보 저장
- 정확한 사내 Atlassian host permission: Confluence REST API 호출
- `scripting`: 사용하지 않음
- `downloads`: 텍스트 1차 범위에서는 사용하지 않음

API 요청은 background 경계에서 수행한다. Popup은 필요한 action과 page ID, 변환 결과를 typed message로 전달하고 background는 sender, origin, 입력 형식과 문서 상태를 검증한다.

## 실패와 복구

- 인증 정보가 없으면 저장 위치를 안내하고 요청하지 않는다.
- page ID를 식별하지 못하면 지원되는 Confluence 문서를 열도록 안내한다.
- 401/403은 인증 확인, 404는 문서 또는 접근 권한 확인, version conflict는 새로고침 후 재검토를 안내한다.
- ADF 응답이 유효한 문서가 아니면 복사·쓰기를 중단한다.
- 변환 결과가 비어 있으면 문서를 수정하지 않는다.
- API 기능 실패는 기존 DOM 기반 복사와 원본 Confluence UI에 영향을 주지 않는다.

## 수용 기준

- 기능을 켜지 않은 기존 사용자의 동작과 권한 외 사용자 흐름이 바뀌지 않는다.
- 저장된 API 토큰이 sync storage와 content script로 전달되지 않는다.
- published 문서와 draft 문서의 ADF를 읽을 수 있다.
- 지원 요소가 포함된 ADF를 식별 가능한 Markdown으로 복사할 수 있다.
- Markdown을 현재 문서 맨 아래에 추가하고 기존 본문을 보존한다.
- version conflict에서 기존 문서를 덮어쓰지 않는다.
- 미지원 요소와 이미지 제한을 사용자에게 경고한다.
- typecheck, unit test, production build가 성공한다.

## 알려진 리스크

- Atlassian API와 ADF schema 변경으로 조회·변환이 중단될 수 있다.
- `storage.local`은 운영체제 비밀 저장소가 아니므로 로컬 Chrome profile 접근 시 token이 노출될 수 있다.
- ADF는 지원 node보다 훨씬 넓어 매크로 semantics가 축약될 수 있다.
- 편집 화면의 저장 전 변경과 API write가 동시에 일어나면 충돌할 수 있다.
- Popup 크기 안에서 긴 Markdown과 경고를 다루는 사용성이 부족할 수 있다.

## 변경 이력

- 2026-08-11: 별도 Jira·Confluence 도구의 ADF 양방향 변환을 Inno Extension 구조로 통합하기로 결정했다. 기존 DOM 복사를 유지하고 인증·원격 write가 필요한 두 기능은 기본 OFF로 분리했다.

## 관련 문서

- [제품 개요](../product-overview.md)
- [Confluence 문서 본문 Markdown 복사](./confluence-page-markdown-copy.md)
- [용어사전](../glossary.md)
