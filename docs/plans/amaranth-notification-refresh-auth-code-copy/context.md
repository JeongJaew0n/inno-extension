# context — amaranth-notification-refresh-auth-code-copy

## 사용자의 원 요청
사용자는 아마란스의 통합 알림 버튼을 열었을 때 `전체` 탭에서 메일 내역을 더 편하게 다루기
위해 다음 두 기능을 추가하고 싶다고 요청했다.

1. 다른 분류 탭으로 갔다가 `전체`로 돌아오면 새 메일이 갱신되는 기존 동작을 별도
   `새로고침` 버튼으로 제공하고, 버튼을 `.today`와 같은 행의 최우측에 배치한다.
2. 메일에서 4~6자리 인증번호를 감지해 숫자 오른쪽에 복사 버튼을 표시하고, 누르면 해당
   번호를 즉시 클립보드에 복사한다.

사용자는 구현 전에 로그인된 Chrome 화면을 분석하고, 결과를 `ai-plan-memory` 형식으로
기록해 두라고 명시했다.

## 왜 이걸 지금 하는가
아마란스 통합알림에는 사용자가 바로 누를 수 있는 새로고침 기능이 없다. 새 메일을 확인하려면
다른 분류로 이동했다가 `전체`로 돌아와야 한다. 또한 인증 메일은 알림 제목이나 본문에서 번호를
직접 선택해 복사해야 하므로 반복 작업이 생긴다. 두 동작 모두 같은 통합알림 팝업에서 자주
수행되며, 기존 사이트 기능을 침범하지 않는 작은 UI 보강으로 사용 단계를 줄일 수 있다.

## 결정된 방향
아마란스 사이트 런타임에 `notificationTools`라는 하나의 기능을 추가한다. 새로고침은 검증된
분류 탭 전환을 클릭 위임하고, 인증번호 복사는 `[메일]` 알림의 제목·본문에서 4~6자리 문자열을
찾아 인라인 버튼으로 제공한다. React 재렌더는 기존 전역 reconcile 구조로 복구한다.

### Chrome 분석 결과 — 2026-08-13

- 통합알림 tooltip의 공용 클래스 `.OBTTooltip_root__jPOv5.lh12`는 네 군데에서 반복됐다.
  통합알림의 안정적인 상위 식별자는 `#intergratedNotificationBtn`이었다.
- 열린 팝업은 `#intergratedNotificationBtn .commonPopup.integratedNotification` 아래에 있었다.
- `전체`, `업무보고`, `전자결재`, `게시판`, `미팅룸`, `일정`, `자원`, `메일`, `업무관리`,
  `ONEFFICE`, `ONECHAMBER`, `인사`, `회계`, `시스템`의 14개 분류가 `.categoryFn .item`으로
  렌더됐고 활성 항목은 `.item.on`이었다.
- `전체 → 업무보고 → 전체`를 실제 클릭하자 알림 영역이 다시 생성됐다. 빈 업무보고 화면에서
  전체로 돌아온 뒤 `.dayline` 2개와 알림 20개가 다시 렌더됐다. 이는 사용자가 말한 탭 왕복
  갱신 동작과 일치한다.
- 오늘 헤더는 `<div class="dayline">08.13 목요일<span class="today">오늘</span></div>`였다.
  실측 크기는 380×30px이고 `position: sticky`, 좌측 padding 24px, `overflow: hidden`이었다.
  우측 절대 배치 버튼을 넣기 적합하지만 높이와 overflow를 넘지 않는 작은 컨트롤이어야 한다.
- 메일 알림은 `li.h-box[.unread]` 안에 출처 `dt`, 제목 `dd.name.flex-1`, 본문
  `.botline .text`, 시간 `.time`을 갖는다.
- 실제 제목 `AuthCode: 629528`과 숨겨진 본문 `Your authentication token code is 629528.`에서
  동일한 6자리 번호가 반복됐다. `039911`처럼 0으로 시작하는 사례도 있어 문자열 처리가 필수다.
- 팝업 분류를 바꾸면 목록 DOM이 교체되므로 주입 요소는 언제든 사라질 수 있다.

### 저장소 분석 결과

- 아마란스 content script는 `src/sites/amaranth/content.ts`에서 여러 `FeatureRuntime`을
  `createSiteRuntime()`에 등록한다.
- 공용 사이트 런타임은 `document.body`를 감시하는 `MutationObserver`를 이미 갖고 있으며,
  120ms debounce 후 활성 기능들의 `reconcile()`을 다시 실행한다.
- 기능 활성화 여부는 catalog, `FEATURE_IDS`, 기본 settings를 통해 팝업에 자동 노출된다.
- 기존 아마란스 기능은 `reconcile()`에서 DOM을 멱등 주입하고 `dispose()`에서 전용 DOM과
  style을 제거하는 패턴을 사용한다.
- 텍스트 복사는 `src/platform/clipboard/writePlainText.ts`에 Clipboard API와
  `document.execCommand('copy')` fallback이 이미 구현돼 있다.
- 단위 테스트는 Node test runner를 사용하며 순수 계약 함수와 catalog/settings 일관성을
  `tests/unit.test.ts`에서 검증한다.

## 기각된 대안
- 아마란스 내부 알림 API 직접 호출 — 현재 UI 클릭 위임만으로 갱신이 가능하고, 내부 API는
  세션·CSRF·비공개 요청 계약 변화에 더 취약하다.
- 브라우저 페이지 전체 새로고침 — 사용 중인 아마란스 화면 상태와 열린 팝업을 잃고 요구 범위를
  넘어선다.
- 주기적 자동 새로고침 — 사용자가 요청한 것은 명시적 버튼이며 불필요한 요청과 목록 변동을
  만들 수 있다.
- 페이지 전체에서 4~6자리 숫자 탐색 — 날짜, 시간, 업무번호 등 오탐 범위가 너무 넓다.
  `[메일]` 알림의 제목·본문으로 범위를 제한한다.
- 제목과 본문 각각에 복사 버튼 생성 — 같은 인증번호가 두 위치에 반복되는 실제 구조에서 버튼이
  중복된다. 알림 하나당 하나만 제공한다.
- 새로고침과 인증번호 복사를 별도 기능 ID로 분리 — 두 동작이 같은 팝업 selector와 재주입
  생명주기를 공유하고 설정 옵션도 없어 첫 버전은 하나의 기능으로 관리하는 편이 단순하다.
- 새 클립보드 구현 추가 — 이미 오류 fallback을 포함한 공용 유틸리티가 있어 중복이다.

## 제약 / 합의 사항
- 기술적 제약:
  - 아마란스는 React SPA이며 class 이름과 DOM 구조가 제품 업데이트로 바뀔 수 있다.
  - 공용 tooltip class는 고유하지 않으므로 `#intergratedNotificationBtn` 범위 안에서만 탐색한다.
  - 분류 탭 클릭은 목록 DOM을 교체하므로 모든 주입은 멱등이어야 한다.
  - 번호는 선행 0을 보존하도록 문자열로 취급한다.
  - 숨겨진 본문 안에 버튼을 넣으면 사용자가 볼 수 없으므로 표시 위치는 제목 행이어야 한다.
- 시간·범위 제약:
  - 이번 단계는 분석과 계획 문서 작성까지만 수행한다. 실제 구현은 별도 사용자 명령 후 시작한다.
  - 인증번호 의미 검증이나 인증 메일 공급자별 파서는 첫 버전에 포함하지 않는다.
- 사용자가 명시한 선호:
  - 새로고침 버튼은 `.today`와 같은 행의 최우측에 둔다.
  - 인증번호는 4~6자리 숫자를 인식한다.
  - 복사 버튼은 해당 숫자의 오른쪽에 둔다.
  - 구현 전에 Chrome 실제 화면을 세밀하게 분석한다.

## 관련 자료
- `src/sites/amaranth/content.ts` — 아마란스 기능 런타임 등록점
- `src/sites/amaranth/selectors.ts` — 아마란스 selector 중앙화 파일
- `src/sites/amaranth/features/titleAutofill/runtime.ts` — 멱등 주입·정리 구현 참고
- `src/sites/amaranth/features/attendanceHeader/runtime.ts` — 원본 클릭 위임 구현 참고
- `src/platform/runtime/createSiteRuntime.ts` — settings, MutationObserver, reconcile 생명주기
- `src/platform/clipboard/writePlainText.ts` — 재사용할 클립보드 유틸리티
- `src/catalog/types.ts`, `src/catalog/sites.ts` — 기능 ID와 팝업 표시 정보
- `src/platform/settings/defaults.ts` — 기능 기본 활성 상태
- `tests/unit.test.ts` — 단위·catalog/settings 회귀 테스트
- 대상 사이트: `https://gw.innogrid.com/`
- 계획 작성 당시 작업 트리에는 기존 Confluence 관련 미커밋 변경이 있으므로 구현 시 혼합 수정에
  주의해야 한다.

## 변경 이력

### 2026-08-13 — 인증 문맥 조건 추가

- 실제 `전체` 목록에 `[WBlock] 메일 리스트 - 2026/08/12 ...` 제목이 있어 자리수 규칙만으로는
  연도 `2026`이 인증번호로 오탐되는 것을 확인했다.
- 4~6자리 경계 규칙은 유지하되, 같은 메일의 제목·본문에 인증 관련 문맥이 있을 때만 복사
  버튼을 표시하도록 결정했다.
- 활성 `전체` 탭 재클릭은 갱신 여부를 판정할 안정적인 화면 신호가 없으므로, 실제 DOM 재생성을
  확인한 `메일 → 전체` 탭 왕복을 새로고침 구현 기준으로 확정했다.
