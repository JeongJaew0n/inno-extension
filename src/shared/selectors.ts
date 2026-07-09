/**
 * 더존 그룹웨어(gw.innogrid.com) DOM selector 모음.
 *
 * 이 파일이 이 확장의 유일한 취약 지점이다. 더존 SPA 가 업데이트되어 버튼이
 * 안 보이면, 실제 페이지의 DOM 을 다시 확인하고 여기 상수만 고치면 된다.
 *
 * 확인 시점(2026-07-09)의 실제 구조:
 *   헤더 앵커: <div class="user-info "> (클래스명 끝 공백 → CSS 선택자에는 무관)
 *   출퇴근 원본:
 *     <div class="worktime"><div id="container"><ul class="btns">
 *       <li class="active">출근</li>
 *       <li class="">퇴근</li>
 *     </ul></div></div>
 *   각 <li> 에 React onClick 이 직접 바인딩되어 있어 clone 은 동작하지 않는다.
 *   반드시 원본 li.click() 으로 위임한다.
 */

/** 헤더에서 주입 버튼을 붙일 기준 요소(이 요소 왼쪽에 삽입). */
export const USER_INFO = '.user-info';

/** 원본 출퇴근 버튼 컨테이너(<ul class="btns">). */
export const WORKTIME_BTNS = '.worktime ul.btns';

/** 원본 출근 버튼(<li>). */
export const CHECKIN_LI = '.worktime ul.btns li:nth-child(1)';

/** 원본 퇴근 버튼(<li>). */
export const CHECKOUT_LI = '.worktime ul.btns li:nth-child(2)';

/** 원본에서 "현재 선택/활성" 을 나타내는 클래스. */
export const ACTIVE_CLASS = 'active';

/** 주입한 헤더 컨테이너의 고유 id (중복 주입 방지 및 재조회용). */
export const INJECTED_ID = 'inno-gw-checkin-header';

/** 주입 버튼 각각을 식별하는 data 속성 값. */
export const KIND = {
  checkin: 'checkin',
  checkout: 'checkout',
} as const;

export type Kind = (typeof KIND)[keyof typeof KIND];
