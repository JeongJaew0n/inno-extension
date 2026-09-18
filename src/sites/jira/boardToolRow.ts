/**
 * 보드 상단 컨트롤 바 **바로 아래**에 우리 UI 전용 줄을 만든다.
 *
 * 처음에는 Jira 필터 줄(`빠른 필터` 오른쪽)에 붙였는데 자리가 모자랐다. Jira 는 화면이 좁아지면
 * 자기 필터를 `더 보기` 로 접어 버티는데, 우리 것은 그 경쟁에서 밀려 **아예 안 보이는 수준까지**
 * 줄어들었다.
 *
 * 컨트롤 바의 부모는 `display: block` 이고 자식이 바 하나뿐이다. 그 뒤에 넣으면 폭을 그대로 쓰는
 * 새 줄이 생기고 보드는 아래로 밀린다. 실측으로 확인했다(줄 1224px, 보드가 정상 재배치).
 *
 * docs/plans/jira-past-sprint-view/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../platform/runtime/featureRoot';
import { BOARD_CONTROLS_BAR, BOARD_TOOL_ROW_ROOT } from './selectors';

/**
 * 줄 안에서의 자리.
 *
 * DOM 에 붙는 순서는 기능의 `reconcile` 순서에 달려 있어 들쭉날쭉하다. flex `order` 로 고정한다.
 */
export const BOARD_TOOL_ORDER = {
  sprintPicker: 1,
  sprintInfo: 2,
} as const;

function findRow(document: Document): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${FEATURE_ROOT_ATTRIBUTE}="${BOARD_TOOL_ROW_ROOT}"]`);
}

/**
 * 우리 UI 를 담을 자리를 돌려준다. 줄이 없으면 만든다.
 *
 * `name` 으로 자리를 구분하므로 같은 기능이 여러 번 불러도 자리가 늘어나지 않는다.
 */
export function ensureBoardToolSlot(
  document: Document,
  name: string,
  order: number,
): HTMLElement | null {
  const bar = document.querySelector<HTMLElement>(BOARD_CONTROLS_BAR);
  if (!bar) return null;

  let row = findRow(document);
  if (!row?.isConnected) {
    row = document.createElement('div');
    row.setAttribute(FEATURE_ROOT_ATTRIBUTE, BOARD_TOOL_ROW_ROOT);
    row.style.all = 'initial';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.flexWrap = 'wrap';
    row.style.gap = '8px';
    row.style.padding = '2px 0 6px';
    bar.insertAdjacentElement('afterend', row);
  } else if (row.previousElementSibling !== bar) {
    // 보드가 다시 그려지면서 줄이 엉뚱한 자리에 남을 수 있다.
    bar.insertAdjacentElement('afterend', row);
  }

  let slot = row.querySelector<HTMLElement>(`[data-board-tool-slot="${name}"]`);
  if (!slot) {
    slot = document.createElement('span');
    slot.dataset.boardToolSlot = name;
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.style.minWidth = '0';
    row.append(slot);
  }
  slot.style.order = String(order);
  return slot;
}

/** 자리를 비우고, 줄이 비면 줄도 지운다. 우리가 만든 것을 남기지 않는다. */
export function releaseBoardToolSlot(document: Document, name: string): void {
  const row = findRow(document);
  if (!row) return;
  row.querySelector(`[data-board-tool-slot="${name}"]`)?.remove();
  if (row.children.length === 0) row.remove();
}
