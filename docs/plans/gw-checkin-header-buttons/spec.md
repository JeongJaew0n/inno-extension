# spec — gw-checkin-header-buttons

## 목표
gw.innogrid.com(더존 그룹웨어)의 출근/퇴근 버튼을 스크롤 없이 항상 볼 수 있도록,
화면 상단 헤더의 `noti-details` 요소 아래에 고정 배치하는 크롬 확장(extension)을 만든다.
헤더 버튼을 누르면 원본 출퇴근 버튼이 대신 클릭되어 실제 출퇴근 처리가 이루어진다.

## 범위
- 포함:
  - content script로 gw.innogrid.com 페이지에 출근/퇴근 버튼을 주입
  - 주입 위치: 헤더의 `noti-details` 요소 아래
  - 주입 버튼 클릭 시 원본 `.worktime ul.btns li` 요소를 클릭 위임
  - 원본 버튼의 현재 상태(`active` 클래스)를 헤더 버튼에도 반영
  - 더존 SPA(hash 라우팅) 리렌더로 헤더/버튼이 사라지면 재주입 (MutationObserver)
- 제외:
  - 출퇴근 자동화(스케줄 자동 클릭) — 하지 않음
  - 미등록 알림 / 상태 감지 알림 — 하지 않음 (사용자가 사이트에서 직접 확인)
  - API 직접 호출 / 토큰 역분석 / 백그라운드 service worker — 하지 않음
  - popup UI, side panel, 시스템 알림 — 하지 않음

## 완료 조건 (Definition of Done)
- [ ] gw.innogrid.com 접속 시 헤더 `noti-details` 아래에 출근/퇴근 버튼이 나타난다
- [ ] 스크롤하지 않아도 항상 보인다 (헤더에 고정)
- [ ] 헤더의 "출근" 클릭 → 원본 출근 버튼이 클릭되어 실제 처리됨
- [ ] 헤더의 "퇴근" 클릭 → 원본 퇴근 버튼이 클릭되어 실제 처리됨
- [ ] 현재 출근/퇴근 상태(원본 `active`)가 헤더 버튼에 시각적으로 반영됨
- [ ] SPA 내에서 화면 이동 후에도 헤더 버튼이 유지된다(사라지면 재주입)
- [ ] Vite 빌드 산출물을 크롬에 "압축해제된 확장" 으로 로드해 동작 확인

## 인터페이스 / 데이터 형식
확인된 대상 DOM(2026-07-09 기준):

- 헤더 앵커: `div.noti-details`
  - 헤더 우상단 위치, 스크롤과 무관하게 항상 보임
- 원본 출퇴근 버튼:
  ```html
  <div class="worktime">
    <div id="container">
      <ul class="btns">
        <li class="active">출근</li>
        <li class="">퇴근</li>
      </ul>
    </div>
  </div>
  ```
  - `.worktime ul.btns li:nth-child(1)` = 출근 (현재 상태면 `active` 클래스)
  - `.worktime ul.btns li:nth-child(2)` = 퇴근
  - 각 `li` 에 React onClick 핸들러가 직접 바인딩되어 있음
    → clone 시 핸들러가 따라오지 않으므로 반드시 원본 `li.click()` 로 위임

selector는 `src/shared/selectors.ts` 한 곳에 상수로 모아 관리한다(더존 SPA 업데이트 시
수정 지점 단일화).

## 의존성
- 크롬 Manifest V3
- TypeScript
- Vite (+ 확장 번들 방식: `@crxjs/vite-plugin` 또는 다중 엔트리 수동 구성)
- 런타임 외부 라이브러리 없음(순수 DOM)

## 비고
- 배치 전략은 "원본 이동(reparent)" 이 아니라 "새 버튼 생성 + 클릭 위임" 이다.
  원본을 옮기면 SPA 리렌더 시 사라지거나 헤더 레이아웃과 스타일이 충돌할 수 있어 기각.
- 인증/세션/CSRF(`get_token`)/SSO 는 모두 사이트가 처리하므로 확장이 관여하지 않는다.
  확장은 원본 버튼을 "대신 눌러줄" 뿐이다.
- DOM selector는 더존 그룹웨어 업데이트로 언제든 깨질 수 있는 취약 지점이다.
  깨지면 `selectors.ts` 만 고치면 되도록 설계한다.
