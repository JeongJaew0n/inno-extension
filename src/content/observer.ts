import { injectButtons, refreshActiveState } from './injectButtons';

let observer: MutationObserver | null = null;
let scheduled = false;

/**
 * DOM 변경을 debounce 해서 처리한다.
 * 더존 SPA(hash 라우팅)는 화면 이동 시 헤더/위젯을 통째로 다시 그린다. 그때마다
 *   1) 헤더 버튼이 사라졌으면 재주입하고
 *   2) 원본 출퇴근 상태(active)를 헤더 버튼에 다시 반영한다.
 */
function handleMutations(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const injected = injectButtons();
    if (!injected) refreshActiveState();
  });
}

/** 최초 1회 주입을 시도하고, 이후 변화를 감시하는 MutationObserver 를 시작한다. */
export function startObserver(): void {
  injectButtons();

  observer?.disconnect();
  observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
}

/** 감시를 중단한다(현재는 사용처가 없지만 정리를 위해 노출). */
export function stopObserver(): void {
  observer?.disconnect();
  observer = null;
}
