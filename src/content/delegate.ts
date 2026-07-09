import {
  CHECKIN_LI,
  CHECKOUT_LI,
  ACTIVE_CLASS,
  KIND,
  type Kind,
} from '../shared/selectors';

/** kind 에 대응하는 원본 <li> selector 를 돌려준다. */
function originalSelector(kind: Kind): string {
  return kind === KIND.checkin ? CHECKIN_LI : CHECKOUT_LI;
}

/**
 * 헤더 버튼 클릭을 원본 출퇴근 <li> 로 위임한다.
 * 원본 li 에는 React onClick 이 바인딩되어 있으므로, 우리가 만든 버튼을 clone 하는 대신
 * 클릭 시점에 원본을 찾아 native click() 을 호출해 실제 처리를 트리거한다.
 *
 * @returns 원본을 찾아 클릭했으면 true, 원본이 없으면 false.
 */
export function delegateClick(kind: Kind): boolean {
  const original = document.querySelector<HTMLElement>(originalSelector(kind));
  if (!original) return false;
  original.click();
  return true;
}

/**
 * 원본 <li> 의 active 상태를 읽어 헤더 버튼에 반영한다.
 * 원본이 없으면(=현재 화면에 출퇴근 위젯이 없으면) 상태를 건드리지 않는다.
 */
export function syncActiveState(button: HTMLButtonElement, kind: Kind): void {
  const original = document.querySelector<HTMLElement>(originalSelector(kind));
  if (!original) return;
  const isActive = original.classList.contains(ACTIVE_CLASS);
  button.classList.toggle('is-active', isActive);
}
