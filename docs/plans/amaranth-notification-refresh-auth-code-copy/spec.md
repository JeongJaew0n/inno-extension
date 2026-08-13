# spec — amaranth-notification-refresh-auth-code-copy

## 목표
아마란스 통합알림의 `전체` 목록을 화면 안에서 즉시 새로고침하고, 메일 알림에서 감지한
4~6자리 인증번호를 한 번의 클릭으로 복사할 수 있게 한다.

## 범위
- 포함:
  - 아마란스 통합알림 팝업이 열린 상태에서만 동작하는 `통합알림 도구` 기능 추가
  - `오늘` 날짜 행의 최우측에 `새로고침` 버튼 주입
  - 새로고침 클릭 시 아마란스가 이미 제공하는 분류 탭 전환 동작을 위임하여 `전체` 목록 갱신
- `[메일]` 알림의 제목과 본문에서 인증 문맥과 함께 나타나는, 다른 숫자에 붙지 않은
  4~6자리 숫자를 문자열로 감지
  - 한 알림에서 같은 번호가 제목과 본문에 반복되면 복사 버튼은 한 번만 표시
  - 감지된 번호 바로 오른쪽에 작은 `복사` 버튼 주입
  - 복사 성공·실패에 대한 짧은 버튼 상태 피드백 제공
  - 통합알림 팝업이나 목록이 React 재렌더로 교체되면 버튼을 멱등 재주입
  - 확장 프로그램 팝업의 아마란스 기능 목록에 별도 토글로 노출
- 제외:
  - 아마란스 내부 알림 API, 인증 토큰, 메일 API 역분석 또는 직접 호출
  - 브라우저 전체 새로고침과 아마란스 페이지 라우트 변경
  - 메일 원문 열람, 읽음 처리, 삭제, 자동 주기 갱신
  - 인증번호 자동 복사, 자동 입력, 만료 시간 계산
  - 메일이 아닌 업무보고·전자결재·일정 등 다른 알림의 숫자 감지
  - 인증번호의 서버 측 의미나 유효성 검증

## 완료 조건 (Definition of Done)
- [ ] 통합알림 버튼을 열고 `전체` 탭을 선택하면 `오늘` 행 최우측에 `새로고침` 버튼이 보인다.
- [ ] `새로고침`을 누르면 다른 화면으로 이동하거나 팝업을 닫지 않고 `전체` 알림 목록이 다시 로드된다.
- [ ] 갱신 중에는 중복 클릭이 차단되고, 완료 또는 실패 상태가 사용자에게 짧게 표시된다.
- [ ] `[메일]` 알림의 제목 또는 본문에 독립된 4~6자리 숫자가 있으면 해당 번호 오른쪽에 복사 버튼이 보인다.
- [ ] 4자리 미만, 6자리 초과, 긴 숫자의 일부는 인증번호로 감지하지 않는다.
- [ ] `039911`처럼 0으로 시작하는 번호를 손실 없이 그대로 복사한다.
- [ ] 같은 인증번호가 제목과 본문에 반복돼도 알림 하나당 복사 버튼은 하나만 표시된다.
- [ ] 복사 버튼을 눌러도 해당 메일 알림이 열리거나 읽음 상태로 바뀌지 않는다.
- [ ] 팝업을 닫았다 다시 열거나 분류 탭을 왕복해 DOM이 교체돼도 버튼이 중복 없이 다시 나타난다.
- [ ] 기능 토글을 끄면 주입된 버튼과 스타일이 제거되고, 다시 켜면 정상적으로 복원된다.
- [ ] 관련 단위 테스트, 타입 검사, 전체 테스트, 빌드가 통과한다.
- [ ] 로그인된 실제 아마란스 화면에서 새로고침과 인증번호 복사를 수동 검증한다.

## 인터페이스 / 데이터 형식

### 기능 등록

- 기능 ID: `notificationTools`
- 표시 이름: `통합알림 새로고침·인증번호 복사`
- 기본 상태: 활성화
- 추가 옵션: 없음
- 적용 범위: `https://gw.innogrid.com/*`에서 통합알림 팝업이 렌더된 동안

예상 변경 지점:

- `src/catalog/types.ts`: `FEATURE_IDS`에 `notificationTools` 추가
- `src/catalog/sites.ts`: 아마란스 기능 설명 추가
- `src/platform/settings/defaults.ts`: 기본 활성 설정 추가
- `src/sites/amaranth/content.ts`: 새 런타임 등록
- `src/sites/amaranth/selectors.ts`: 통합알림 selector 중앙화
- `src/sites/amaranth/features/notificationTools/`: 계약, 런타임, 스타일 파일 배치
- `tests/unit.test.ts`: 번호 추출 및 catalog/settings 회귀 테스트

### 2026-08-13 Chrome 실측 DOM 계약

```html
<div id="intergratedNotificationBtn">
  <div class="OBTTooltip_root__jPOv5 lh12">...</div>
  <div class="commonPopup integratedNotification v-box alert">
    <div class="tab h-box">...</div>
    <div class="tabCon flex-1 v-box">
      <div class="categoryFn h-box">
        <div class="item on">전체</div>
        <!-- 업무보고, 전자결재, ..., 메일, ..., 시스템 -->
      </div>
      <div class="dayline">08.13 목요일<span class="today">오늘</span></div>
      <ul>
        <li class="h-box unread">
          <div class="list_con flex-1">
            <div class="topline h-box">
              <dl class="h-box">
                <dt>[메일]</dt>
                <dd class="name flex-1">AuthCode: 629528</dd>
              </dl>
            </div>
            <div class="botline v-box">...</div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
```

- 통합알림 진입점은 공용 tooltip 클래스가 아니라 실제 고유 ID인
  `#intergratedNotificationBtn`을 기준으로 찾는다. 사이트의 `intergrated` 오탈자는 실제 ID이므로
  그대로 사용한다.
- 팝업 루트는 `.commonPopup.integratedNotification`이다.
- 분류 탭은 `.categoryFn .item`, 선택 상태는 `.item.on`, 표시 문구는 `전체`, `메일` 등이다.
- 오늘 날짜 행은 `.dayline` 중 `.today` 자식을 가진 요소로 한정한다. 실측상 높이 30px,
  `position: sticky`, `overflow: hidden`이며 현재 자식은 `.today` 하나다.
- 알림 하나는 `.dayline + ul > li` 구조이며, 출처는 `dt`, 제목은 `dd.name`, 숨겨진 본문은
  `.botline .text`에서 읽는다.
- `class="OBTTooltip_root__jPOv5 lh12"`는 통합알림 외 조직도·서비스공지·이용가이드에도
  반복되므로 단독 selector로 사용하지 않는다.

### 번호 추출 계약

순수 함수는 다음 의미를 갖도록 분리한다.

```ts
function extractVerificationCode(text: string): string | null;
```

- 반환 타입은 선행 0 보존을 위해 숫자가 아닌 문자열이다.
- 다른 숫자와 붙지 않은 4~6자리 연속 숫자만 후보로 삼는다.
- 구현은 긴 숫자의 일부를 잘못 뽑지 않는 경계 조건을 반드시 포함한다.
- 한 메일에서 제목을 먼저 검사하고, 제목에 후보가 없을 때 본문을 검사한다.
- 스캔 범위는 출처 `dt`의 정규화된 문구가 `[메일]`인 알림으로 제한한다.
- 제목과 본문을 합친 문자열에 `AuthCode`, `authentication`, `verification`, `OTP`,
  `token code`, `passcode`, `인증`, `인증번호`, `보안코드`, `일회용` 중 하나 이상의 인증
  문맥이 있어야 한다. 대소문자는 구분하지 않는다.
- 한 필드에 후보가 여러 개면 첫 번째 후보만 사용한다. 복수 번호 선택 UI는 범위 밖이다.
- Chrome 실측 목록의 `[WBlock] 메일 리스트 - 2026/08/12 ...`처럼 일반 메일에 포함된 연도는
  인증 문맥이 없으므로 제외한다.

### 주입·상호작용 계약

- 새로고침 버튼은 `.today`를 포함한 `.dayline` 안에 주입하고 우측 절대 배치한다.
- 새로고침은 내부 API 호출 대신 실측으로 갱신이 확인된 분류 탭 왕복을 사용한다. 현재 탭이
  `전체`라면 `메일` 같은 기존 분류 탭을 클릭한 뒤 다음 DOM 갱신 시점에 `전체`를 다시 클릭한다.
- 탭 왕복 중 버튼은 `aria-busy=true` 및 비활성 상태가 되고, 목록 복원 성공 여부를 제한 시간
  안에 확인한다. 실패하면 `갱신 실패` 상태를 잠시 표시하되 현재 화면을 파괴하지 않는다.
- 인증번호 버튼은 제목의 해당 숫자 바로 뒤에 삽입한다. 제목에 번호가 없고 숨겨진 본문에서만
  찾은 경우에는 제목 끝에 `인증번호 복사` 버튼을 표시해 숨겨진 DOM에 버튼이 들어가지 않게 한다.
- 복사 버튼 클릭 이벤트는 `preventDefault()`와 `stopPropagation()`을 적용하여 원래 알림 클릭을
  발생시키지 않는다.
- 복사는 기존 `src/platform/clipboard/writePlainText.ts`를 재사용한다.
- 모든 주입 요소에 확장 전용 ID 또는 `data-inno-*` 표식을 부여해 중복을 방지한다.
- `dispose()`는 주입 요소와 스타일을 제거하며 원본 아마란스 요소와 텍스트는 보존한다.

## 의존성
- 외부 라이브러리·서비스·CLI:
  - 새 런타임 의존성 없음. 기존 TypeScript, Vite, Chrome content script 구조를 사용한다.
  - 클립보드 쓰기는 기존 `writePlainText()` 유틸리티에 의존한다.
  - 실제 동작 검증은 로그인된 `gw.innogrid.com` Chrome 세션이 필요하다.
- 사전 작업으로 끝나야 하는 항목:
  - 현재 작업 트리에 남아 있는 Confluence 관련 미커밋 변경과 섞이지 않도록 브랜치·커밋 경계를 확인한다.
  - 활성 `전체` 탭 재클릭만으로 갱신됐다고 판정할 안정적인 화면 신호가 없어, 실제 갱신이
    확인된 `메일 → 전체` 탭 왕복을 첫 구현의 기준으로 사용한다.

## 비고
- 통합알림 목록은 React가 분류 전환 때 DOM을 통째로 교체한다. 일회성 주입으로는 버튼이
  사라지므로 기존 사이트 런타임의 `MutationObserver → reconcile` 흐름을 활용해야 한다.
- 전역 observer는 이미 `createSiteRuntime()`에 있으므로 기능 내부에 또 하나의 무제한
  `MutationObserver`를 만들지 않는다. 필요한 비동기 갱신 완료 확인만 팝업 내부로 짧게 제한한다.
- 새로고침 구현은 사이트가 보유한 클릭 핸들러에 위임한다. 네트워크 엔드포인트를 직접 호출하면
  세션·CSRF·내부 계약 변화에 취약해지므로 의도적으로 제외한다.
- 확장 주입 버튼 때문에 React가 원본 DOM을 재생성해도 원본 텍스트 값을 다시 작성하거나
  `innerHTML` 전체를 교체하지 않는다.
