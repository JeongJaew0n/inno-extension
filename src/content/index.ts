import { startObserver } from './observer';

/**
 * content script 진입점.
 * gw.innogrid.com 에서 실행되어, 헤더 noti-details 아래에 출/퇴근 버튼을 주입하고
 * SPA 리렌더에 대응해 유지한다. 자동화·알림·API 호출은 하지 않는다.
 */
function main(): void {
  startObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
