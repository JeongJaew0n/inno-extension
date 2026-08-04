# Jira CONE-Chain 보드 Chrome Extension 사전 분석

- 분석 대상: <https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146>
- 분석 일자: 2026-08-03 (Asia/Seoul)
- 목적: Jira 보드 위에서 동작하는 Chrome Extension을 설계하기 위한 화면·데이터·기술 경계 파악
- 분석 방법: 로그인된 Chrome에서 실제 보드와 이슈 상세 패널을 관찰하고, Jira API로 프로젝트 메타데이터를 교차 확인했다.

## 1. 결론

이 보드는 Jira Cloud의 회사 관리형(classic) Software 프로젝트 안에 있는 Scrum 보드다. Chrome Extension의 1차 구현은 **Manifest V3 + 격리된 content script + Shadow DOM 패널 + DOM 기반 읽기 전용 추출**이 가장 안전하다.

초기 버전에서 Jira 내부 네트워크 요청이나 비공개 API를 가로채지 않는 편이 좋다. 현재 화면은 이슈 키, 상태, 담당자 그룹, 우선순위, 기한, 이슈 유형, 선택된 이슈 상세 등 MVP에 필요한 정보를 접근성 속성과 링크에서 상당 부분 노출한다. DOM으로 부족한 데이터가 명확해진 뒤에만 Jira 공식 REST API와 OAuth를 추가한다.

핵심 구현 원칙은 다음과 같다.

1. CSS 클래스명은 사용하지 않는다. 현재 클래스는 빌드마다 바뀔 수 있는 난독화 토큰이다.
2. URL, `href`, ARIA role/name, 시맨틱 heading을 1차 계약으로 사용한다.
3. `data-testid`는 보조 계약으로만 사용한다.
4. Jira가 SPA이므로 최초 로드만 처리하지 말고 DOM 변경과 URL 변경을 함께 감지한다.
5. 보드가 담당자별 swimlane으로 반복 렌더링되므로 이슈 키로 반드시 중복 제거한다.
6. 읽기 전용 MVP에는 사이트 전체 권한, 쿠키 접근, 원격 코드, 광범위한 데이터 저장이 필요하지 않다.

## 2. 확인된 Jira 환경

### 2.1 프로젝트와 보드

| 항목 | 확인값 |
| --- | --- |
| Jira Cloud 사이트 | `pms-innogrid.atlassian.net` |
| 프로젝트 키 | `NPT` |
| 프로젝트명 | 네이티브 플랫폼팀 |
| 프로젝트 ID | `12443` |
| 프로젝트 유형 | Software |
| 관리 방식 | 회사 관리형 / classic (`simplified: false`, `style: classic`) |
| 보드 ID | `2146` |
| 보드명 | CONE-Chain |
| 보드 유형 | Scrum |
| 현재 화면 | 활성 스프린트 |

프로젝트에 등록된 이슈 유형은 에픽, 작업, 하위 작업, 버그, 문서다. 현재 활성 보드 화면에서는 작업과 하위 작업 카드가 확인됐다.

### 2.2 현재 활성 스프린트

분석 시점에 표시된 활성 스프린트는 다음과 같다.

| 항목 | 값 |
| --- | --- |
| 스프린트명 | `CONE-Chain Sprint 1` |
| 시작일 | 2026-08-03 |
| 종료일 | 2026-08-31 |
| 설명 | `TBD: 작성 필요` |

보드 상단에 `스프린트 완료`, `스프린트 세부 정보`, `스프린트 인사이트`가 노출되므로 활성 스프린트를 중심으로 운영되는 Scrum 보드임을 화면에서도 확인할 수 있다.

### 2.3 보드 구성

현재 보드는 `담당자` 기준으로 그룹화되어 있다. 화면에는 6개의 담당자 swimlane과 총 10개의 이슈가 보였다.

| 컬럼 | 화면상 이슈 수 |
| --- | ---: |
| To Do | 1 |
| In Progress | 5 |
| IN-REVIEW | 0 |
| Done | 4 |
| 합계 | 10 |

이 수치는 2026-08-03 당시 활성 스프린트의 렌더링 상태를 기준으로 한 스냅샷이며, 보드 필터·접힌 swimlane·가상 스크롤·후속 변경에 따라 달라질 수 있다.

### 2.4 사용자 조작 지점

보드 상단에서 확인된 주요 조작 지점은 다음과 같다.

- 보드 검색
- 담당자 필터
- 버전 필터
- 이슈 유형 필터
- 빠른 필터
- 담당자 그룹화
- 스프린트 세부 정보 및 인사이트
- 보드 설정
- 이슈 카드 열기
- 카드 내 요약, 담당자, 시간 추적, 추가 작업

보드 주변에는 백로그, 타임라인, 캘린더, 보고서, 목록, 릴리스, 컴포넌트, 개발, 코드 화면으로 이동하는 프로젝트 탐색 메뉴가 있다. Extension의 초기 URL 범위는 보드 화면으로 좁히고, 백로그나 목록 지원은 별도 adapter로 추가하는 편이 안전하다.

## 3. 화면과 DOM 동작 분석

### 3.1 SPA 라우팅

Jira는 전체 페이지를 새로 여는 대신 SPA 방식으로 이슈 상세를 띄운다.

```text
보드 기본 URL
/jira/software/c/projects/NPT/boards/2146

NPT-2 카드 선택 후
/jira/software/c/projects/NPT/boards/2146?selectedIssue=NPT-2
```

카드를 선택하면 보드 위에 상세 dialog가 열리고 `selectedIssue` 쿼리 파라미터가 추가된다. 따라서 Extension은 다음 세 상태를 구분해야 한다.

1. 대상 보드가 아님
2. 대상 보드지만 선택된 이슈가 없음
3. 대상 보드이며 `selectedIssue`가 있고 상세 dialog가 열림

`DOMContentLoaded` 한 번만 처리하면 카드 선택, 필터 변경, swimlane 접기/펼치기, 보드 내부 이동을 놓친다. `MutationObserver`를 debounce하여 다시 스캔하고, 매 스캔 시작 시 `location.href`를 이전 값과 비교하는 구조가 적합하다.

### 3.2 확인된 안정 후보

아래 값은 실제 화면에서 확인했다. 단, Atlassian이 공식적으로 Extension용 DOM 계약을 제공한 것은 아니므로 회귀 테스트가 필요하다.

| 대상 | 확인된 식별자 또는 구조 | 사용 권고 |
| --- | --- | --- |
| 이슈 키 | `a[href="/browse/NPT-2"]` | 최우선. `NPT-2`는 예시이며 정규식으로 키 추출 |
| 보드 검색 | `input[aria-label="현재 페이지에서 검색"]` | locale 의존성이 있음 |
| 보드 검색 보조 | `data-testid="software-filters.ui.stateless.search-field"` | 보조 selector |
| 컬럼 제목 | `h2[aria-label="To Do, 총 이슈 수: 1개"]` | 상태명과 카운트 추출 가능 |
| 컬럼 제목 보조 | `data-testid="platform-board-kit.common.ui.column-header.editable-title.column-title.column-title"` | 반복 요소이므로 반드시 swimlane 범위로 한정 |
| 카드 키 영역 | `data-testid="platform-card.common.ui.key.key"` | `href`가 없을 때 보조 |
| 카드 외곽 | `data-testid="platform-board-kit.ui.card.ripple.div"` 아래 `draggable="true"` 요소 | 강조 표시나 badge 삽입 지점 후보 |
| 카드 footer | `data-testid="platform-card.ui.card.card-content.footer"` | 키·시간 추적 주변 UI 삽입 후보 |
| 상세 dialog | `section[role="dialog"]` | 상세 패널 존재 여부 확인 |
| 상세 dialog 보조 | `data-testid="issue.views.issue-details.issue-modal.modal-dialog"` | 보조 selector |
| 상세 이슈 키 | dialog 내부 `a[href^="/browse/"]` | 선택 이슈 검증 |
| 상세 제목 | dialog 내부 `h1` | 요약 읽기 |

### 3.3 피해야 할 selector

- `_16jlidpf`, `_1o9zkb7n`, `css-e3hw33` 같은 CSS 클래스
- React 렌더 트리의 위치에 의존한 `div > div:nth-child(...)`
- 한국어 화면 문자열 하나에만 의존하는 전역 text 검색
- `boardkit-swimlane-header----` ID
- 순서 기반 `.first()` 또는 `.nth()`

특히 한국어 담당자명의 swimlane heading ID가 여러 행에서 `boardkit-swimlane-header----`로 중복됐다. 반면 영문 담당자명은 slug가 포함된 ID를 가졌다. 이 ID는 고유성 계약으로 사용할 수 없다.

### 3.4 중복과 범위 문제

이슈 링크는 카드, 하위 이슈 미리보기, 상세 breadcrumb, 상세 본문 테이블 등 여러 위치에 동시에 나타난다. 전역으로 `/browse/NPT-2` 링크를 찾으면 동일 이슈가 여러 번 잡힐 수 있다.

권장 추출 순서는 다음과 같다.

1. 현재 보드 영역 안에서 카드 후보를 찾는다.
2. 카드 후보 내부의 `/browse/{KEY}` 링크에서 이슈 키를 추출한다.
3. `Map<issueKey, IssueCard>`로 중복 제거한다.
4. 상세 dialog는 별도 extractor로 처리한다.
5. 화면에 렌더링되지 않은 이슈까지 필요하면 DOM 수집을 확장하지 말고 REST API로 전환한다.

### 3.5 상세 dialog에서 확인된 데이터

이슈 상세 dialog에는 다음 데이터와 조작 지점이 노출된다.

- 이슈 유형과 이슈 키
- 요약과 설명
- 하위 작업 목록 및 진행률
- 연결된 이슈와 웹 링크
- 활동, 댓글, 기록, 업무 로그
- 상태
- 우선순위
- 담당자와 보고자
- 시작 날짜와 기한
- Sprint
- 수정 버전과 레이블
- 개발, 자동화, Checklist, 외부 앱 섹션
- 생성·수정 시각

읽기 전용 Extension은 이 영역에 상태 badge, 누락 필드 경고, 링크 복사 같은 보조 UI를 추가할 수 있다. 상태 변경, 댓글 추가, 담당자 변경 같은 쓰기 기능은 별도 권한과 사용자 확인 UX를 설계한 뒤에만 추가해야 한다.

## 4. 권장 Extension 아키텍처

### 4.1 기본 구조

```text
manifest.json (Manifest V3)
  ├─ content script
  │    ├─ route detector
  │    ├─ board extractor
  │    ├─ issue dialog extractor
  │    ├─ MutationObserver + debounce
  │    └─ Shadow DOM UI mount
  ├─ service worker (선택)
  │    ├─ 메시지 라우팅
  │    ├─ export/download
  │    └─ REST API/OAuth 연동
  └─ options/popup (선택)
       └─ 사용자 설정 및 기능 on/off
```

Content script는 기본값인 `ISOLATED` world에서 실행한다. 페이지의 React 객체나 전역 변수에 접근하려고 `MAIN` world를 사용하지 않는다. Atlassian 페이지 스크립트와 Extension 스크립트의 충돌 및 변조 가능성을 줄일 수 있다.

Extension UI는 Shadow DOM 안에 렌더링하여 Atlaskit 전역 스타일과 충돌하지 않게 한다. Jira 본문에 style tag를 직접 주입하거나 기존 컴포넌트의 class를 재사용하지 않는다.

### 4.2 최소 권한 초안

DOM 기반 MVP라면 다음 수준으로 시작할 수 있다.

```json
{
  "manifest_version": 3,
  "name": "NPT Jira Board Helper",
  "version": "0.1.0",
  "content_scripts": [
    {
      "matches": [
        "https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/*"
      ],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle",
      "world": "ISOLATED"
    }
  ],
  "permissions": ["storage"]
}
```

고려사항:

- 설정 저장이 없다면 초기에는 `storage`도 제거할 수 있다.
- 정적 content script만으로 충분하면 `scripting`, `activeTab`, `tabs`는 필요 없다.
- Jira REST API를 service worker에서 호출할 때만 사이트 `host_permissions`와 인증 설계를 추가한다.
- `https://*.atlassian.net/*`처럼 모든 Atlassian 사이트에 대한 광범위한 권한은 피한다.
- 원격 JavaScript를 로드하지 않는다. Manifest V3에서는 배포 패키지에 포함된 코드만 실행하는 구조를 유지한다.

### 4.3 라우트와 렌더링 처리

권장 처리 흐름은 다음과 같다.

```text
content script 시작
  → URL이 지원 대상인지 판별
  → 기존 Extension root 존재 여부 확인
  → 보드 DOM을 읽어 정규화
  → UI render/update
  → MutationObserver 등록
  → 변경 이벤트 debounce
  → URL 비교 + 영향 영역 재추출
```

구현 시 지켜야 할 세부 원칙:

- observer callback마다 전체 DOM을 다시 순회하지 않는다.
- 100~250ms 수준으로 debounce하고 변경된 보드 또는 dialog 영역만 재추출한다.
- 동일한 Extension root를 중복 삽입하지 않는다.
- `selectedIssue`가 바뀌면 기존 상세 UI를 정리하고 새 dialog에 다시 mount한다.
- Extension이 삽입한 노드는 `data-jjw-inno-extension` 같은 자체 namespace로 표시하여 observer가 무시하게 한다.
- 페이지 이동 또는 지원하지 않는 URL로 전환되면 observer와 이벤트 listener를 정리한다.

### 4.4 권장 내부 데이터 모델

```ts
type BoardSnapshot = {
  boardId: string;
  projectKey: string;
  boardName: string | null;
  selectedIssueKey: string | null;
  columns: BoardColumn[];
  swimlanes: Swimlane[];
  issues: Record<string, IssueCard>;
  capturedAt: string;
};

type BoardColumn = {
  name: string;
  visibleCount: number | null;
};

type Swimlane = {
  label: string;
  visibleCount: number | null;
  issueKeys: string[];
};

type IssueCard = {
  key: string;
  summary: string | null;
  status: string | null;
  issueType: string | null;
  priority: string | null;
  assignee: string | null;
  dueDate: string | null;
  parentKey: string | null;
};
```

DOM에서 확인하지 못한 필드는 `null`로 유지한다. 화면 문자열을 억지로 추론해 잘못된 값을 넣는 것보다, REST API 보강 여부를 데이터 레이어가 명확히 판단할 수 있다.

## 5. 데이터 획득 전략

### 5.1 1단계: DOM 전용

장점:

- 현재 로그인 세션을 그대로 활용한다.
- 별도 OAuth와 서버가 필요 없다.
- 권한 경고를 최소화할 수 있다.
- 보드 위 UI 보조 기능을 빠르게 검증할 수 있다.

한계:

- 화면에 렌더링된 데이터만 확실히 읽을 수 있다.
- Atlassian UI 변경과 locale 변경에 영향을 받는다.
- 가상 스크롤, 접힌 swimlane, 필터 적용 상태에서는 전체 이슈 집계가 아닐 수 있다.
- 설명이나 커스텀 필드처럼 상세 dialog를 열어야 보이는 값이 있다.

DOM 기반 집계는 UI에 반드시 `현재 화면 기준`임을 표시해야 한다.

### 5.2 2단계: Jira 공식 REST API

정확한 전체 집계, 숨겨진 필드, 보드 설정, 스프린트 전체 이슈가 필요하면 공식 API를 사용한다.

주요 후보:

- `GET /rest/agile/1.0/board/{boardId}`: 보드 정보
- `GET /rest/agile/1.0/board/{boardId}/configuration`: 보드 필터와 컬럼·상태 매핑
- `GET /rest/agile/1.0/board/{boardId}/sprint`: 보드 스프린트
- Jira Platform REST v3의 enhanced JQL search: 이슈 검색
- `GET /rest/api/3/issue/{issueIdOrKey}`: 이슈 상세

주의사항:

- Atlassian이 문서화하지 않은 내부 GraphQL/REST 호출을 복제하지 않는다.
- 페이지 쿠키를 몰래 읽거나 저장하지 않는다.
- 조직 배포 또는 장기 운영이면 OAuth 2.0 또는 Atlassian Forge를 검토한다.
- API 응답의 설명은 Atlassian Document Format일 수 있으므로 별도 renderer 또는 안전한 plain-text 변환이 필요하다.
- 보드 configuration API는 일반 이슈 조회보다 더 세분화된 scope가 필요할 수 있다.
- API를 추가해도 DOM adapter는 현재 화면 강조·삽입 위치를 찾는 용도로 계속 필요하다.

### 5.3 권장 선택

| 요구사항 | 권장 방식 |
| --- | --- |
| 현재 보드 카드 강조 | DOM |
| 현재 화면 상태별/담당자별 집계 | DOM |
| 선택 이슈 누락 필드 경고 | dialog DOM, 필요 시 이슈 API |
| 보드 전체 이슈 정확 집계 | REST API |
| 컬럼과 Jira status의 정확한 매핑 | board configuration API |
| 장기 조직 배포와 공식 Jira 확장 지점 | Forge 검토 |

## 6. 적합한 기능 후보

최종 제품 목적은 아직 정해지지 않았으므로, 아래는 현재 화면에서 구현 가능성이 높은 후보 목록이다.

### 우선순위 A: DOM만으로 가능한 읽기 전용 기능

- 현재 화면의 상태별·담당자별 업무 수 요약
- 미할당, 기한 초과, 기한 임박 카드 강조
- 특정 prefix(`[CCP-BE]`, `[INFRA]` 등)별 색상 또는 필터
- 이슈 키·링크 빠른 복사
- 상세 dialog의 누락 필드 경고
- 현재 화면 이슈 목록 JSON/CSV export
- 하위 작업 진행률 또는 parent-child 관계 강조

### 우선순위 B: REST API 보강 후 가능한 기능

- 보드 전체 WIP 및 컬럼 제약 검증
- 화면 밖 이슈를 포함한 정확한 스프린트 통계
- 업데이트 지연, 장기 정체 이슈 탐지
- 커스텀 필드 기반 품질 규칙
- 여러 보드 간 비교

### 별도 승인과 설계가 필요한 쓰기 기능

- 상태 변경
- 담당자 변경
- 댓글 등록
- 스프린트 이동
- Jira 이슈 생성 또는 수정

쓰기 기능은 오조작 방지를 위해 실행 직전 대상 이슈와 변경 내용을 명확히 보여주고 확인받아야 한다. 읽기 기능과 쓰기 기능의 코드 경계 및 권한을 분리한다.

## 7. 주요 위험과 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| Atlassian DOM 변경 | selector가 깨짐 | adapter 계층, selector 우선순위, fixture 기반 회귀 테스트 |
| 한국어 locale 의존 | 영어 UI에서 실패 | `href`, role, testid 우선; 문자열 사전 분리 |
| swimlane 반복 렌더링 | 상태 컬럼과 이슈 중복 집계 | swimlane 범위 추출, 이슈 키 dedupe |
| 가상 스크롤·접힌 행 | 화면 밖 이슈 누락 | `현재 화면 기준` 표시 또는 REST API 사용 |
| SPA route 변경 | UI 중복 삽입·상태 불일치 | URL 비교, observer debounce, idempotent mount |
| Jira CSS와 충돌 | 레이아웃 깨짐 | Shadow DOM, 자체 CSS namespace |
| 과도한 권한 | 설치 거부·보안 위험 | 사이트와 기능별 최소 권한 |
| 민감한 업무 데이터 저장 | 정보 노출 | 기본 비저장, 최소 필드, 로그 redaction |
| 내부 API 의존 | 예고 없는 장애 | 공식 REST API만 사용 |
| 서비스 워커 종료 | 상태 유실 | 전역 변수 대신 `chrome.storage` 사용 |

## 8. 개인정보와 보안 기준

- 이슈 설명, 댓글, 담당자 이메일을 기본 저장하지 않는다.
- 콘솔 로그에 이슈 설명과 사용자 정보를 출력하지 않는다.
- 외부 서버 전송 기능은 기본적으로 만들지 않는다.
- analytics가 필요하면 opt-in과 전송 필드 목록을 명시한다.
- HTML 문자열 삽입보다 `textContent`와 안전한 DOM API를 사용한다.
- Jira에서 읽은 문구를 명령이나 실행 코드로 취급하지 않는다.
- access token, cookie, session 정보를 `localStorage` 또는 Extension UI에 노출하지 않는다.
- export 파일 생성 시 사용자에게 포함 범위를 먼저 보여준다.
- 읽기 전용과 쓰기 동작의 메시지 타입을 분리하고 service worker에서 allowlist 검증한다.

## 9. 테스트 전략

### 9.1 extractor 단위 테스트

실제 페이지에서 개인정보를 제거한 최소 HTML fixture를 만든다.

- 일반 작업 카드
- 하위 작업 카드와 parent 표시
- 빈 컬럼
- 동일 이슈 키가 카드와 상세 dialog에 동시에 존재
- 담당자 없는 카드
- 기한 있는 카드와 없는 카드
- 한국어/영어 컬럼명
- `data-testid`가 없어도 `href`로 추출 가능한 카드
- CSS 클래스가 전부 바뀐 fixture

### 9.2 통합 테스트

- 보드 진입 시 UI root가 한 번만 생성되는가
- 카드 선택으로 `selectedIssue`가 바뀌면 상세 UI가 갱신되는가
- dialog를 닫으면 관련 UI가 제거되는가
- 검색·담당자 필터 후 집계가 갱신되는가
- swimlane 접기/펼치기 후 중복이 생기지 않는가
- 백로그나 다른 프로젝트로 이동하면 observer와 UI가 정리되는가
- Extension 비활성화 시 Jira 본래 기능이 그대로 동작하는가

### 9.3 수동 회귀 테스트

| 영역 | 확인 항목 |
| --- | --- |
| 보드 | 검색, 필터, drag & drop, 카드 열기 |
| 상세 | dialog 열기/닫기, 링크 이동, 필드 편집 진입 |
| 레이아웃 | 사이드바 접기, 전체 화면, 창 크기 변경 |
| 데이터 | 담당자 그룹, 빈 컬럼, 하위 작업 |
| 안정성 | 새로고침, 뒤로/앞으로, 장시간 탭 유지 |
| 권한 | 비대상 Jira 프로젝트와 다른 도메인에서 미실행 |

## 10. 구현 권장 순서

### Phase 0. 기능 확정

다음 중 1차 목적을 하나로 좁힌다.

- 업무 가시성/통계
- 누락·품질 검증
- 빠른 탐색·복사
- 보고용 export
- 반복적인 Jira 쓰기 작업 자동화

### Phase 1. 읽기 전용 기반

1. Manifest V3 골격
2. URL parser
3. 보드/카드/dialog extractor
4. MutationObserver lifecycle
5. Shadow DOM 패널
6. fixture와 회귀 테스트

완료 기준: 현재 보드에서 Jira 기본 동작을 방해하지 않고, 필터·카드 선택·dialog 닫기에 따라 정확히 갱신된다.

### Phase 2. 실제 사용자 가치 1개

통계, 경고, 복사, export 중 하나만 선택해 완성한다. 여러 기능을 동시에 넣기보다 관찰 가능한 가치와 selector 안정성을 먼저 검증한다.

### Phase 3. API 보강

DOM으로 해결할 수 없는 요구사항이 확인된 경우에만 OAuth, 공식 REST API, service worker, cache를 추가한다.

### Phase 4. 쓰기 기능

권한, 사용자 확인, 실패 복구, audit log가 설계된 후 Jira 변경 기능을 추가한다.

## 11. 구현 전에 결정할 항목

1. Extension의 핵심 사용자는 개인인가, NPT 팀 전체인가?
2. 읽기 전용인가, 상태·담당자·댓글 변경까지 필요한가?
3. 현재 보이는 카드만 다루면 되는가, 화면 밖 전체 스프린트가 필요한가?
4. CONE-Chain 보드만 지원할 것인가, NPT의 다른 보드도 지원할 것인가?
5. 데이터 export 또는 외부 시스템 전송이 필요한가?
6. 한국어 UI만 지원할 것인가, 영어 locale도 지원할 것인가?
7. Chrome Web Store 배포인가, 조직 정책을 통한 사내 배포인가?

이 결정에 따라 권한, 데이터 소스, 인증, 테스트 범위가 크게 달라진다. 결정 전에는 DOM 기반 읽기 전용 foundation까지만 구현하는 것이 합리적이다.

## 12. 공식 참고 자료

- [Chrome Extensions: Manifest file format](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Chrome Extensions: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Extensions: Service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- [Chrome Extensions: Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Chrome Extensions: Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Jira Software Cloud REST API: Board](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/)
- [Jira Software Cloud REST API: Sprint](https://developer.atlassian.com/cloud/jira/software/rest/api-group-sprint/)
- [Jira Cloud Platform REST API: Issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Jira Cloud Platform REST API v3 introduction](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)

## 13. 분석 한계

- 관리자 전용 보드 설정 화면과 실제 board filter JQL은 확인하지 않았다.
- drag & drop, 상태 변경, 댓글 등록 등 데이터가 바뀌는 조작은 수행하지 않았다.
- 네트워크 요청을 가로채거나 Jira의 비공개 내부 API를 분석하지 않았다.
- 현재 문서는 2026-08-03의 실제 화면 구조를 기준으로 하므로 Atlassian UI 업데이트 후 selector 회귀 검증이 필요하다.
- Extension의 구체 기능 목적이 정해지지 않아, 특정 기능 명세가 아니라 재사용 가능한 기반 설계와 위험 분석에 초점을 맞췄다.
