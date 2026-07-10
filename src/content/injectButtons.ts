import { NOTI_DETAILS, INJECTED_ID, KIND, type Kind } from '../shared/selectors';
import { ensureStyles } from './styles';
import { delegateClick, syncActiveState } from './delegate';

interface InjectedButton {
  el: HTMLButtonElement;
  kind: Kind;
}

let injectedButtons: InjectedButton[] = [];

function createButton(label: string, kind: Kind): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'inno-gw-btn';
  btn.textContent = label;
  btn.dataset.innoKind = kind;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = delegateClick(kind);
    if (!ok) {
      // 원본 버튼이 현재 화면에 없음 → 사용자가 직접 근태 화면을 열어야 함.
      btn.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
        { duration: 200 },
      );
    }
  });
  return btn;
}

/** 헤더 컨테이너와 버튼들을 만든다(아직 DOM 에 붙이지 않음). */
function buildContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = INJECTED_ID;

  const checkin = createButton('출근', KIND.checkin);
  const checkout = createButton('퇴근', KIND.checkout);

  container.appendChild(checkin);
  container.appendChild(checkout);

  injectedButtons = [
    { el: checkin, kind: KIND.checkin },
    { el: checkout, kind: KIND.checkout },
  ];

  return container;
}

/**
 * noti-details 요소 바로 아래에 출근/퇴근 버튼을 주입한다.
 * 이미 주입돼 있고 DOM 에 연결돼 있으면 아무것도 하지 않는다(idempotent).
 *
 * @returns 이번 호출로 새로 주입했으면 true.
 */
export function injectButtons(): boolean {
  const anchor = document.querySelector<HTMLElement>(NOTI_DETAILS);
  if (!anchor) return false;

  const existing = document.getElementById(INJECTED_ID);
  if (existing && existing.isConnected) return false;

  ensureStyles();

  const container = buildContainer();
  anchor.appendChild(container);

  refreshActiveState();
  return true;
}

/** 주입된 헤더 버튼들의 active 상태를 원본과 동기화한다. */
export function refreshActiveState(): void {
  for (const { el, kind } of injectedButtons) {
    if (el.isConnected) syncActiveState(el, kind);
  }
}
