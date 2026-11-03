/**
 * 보드 상단 컨트롤 바 **바로 아래**에 우리 UI 전용 줄을 만든다.
 *
 * 처음에는 Jira 필터 줄(`빠른 필터` 오른쪽)에 붙였는데 자리가 모자랐다. Jira 는 화면이 좁아지면
 * 자기 필터를 `더 보기` 로 접어 버티는데, 우리 것은 그 경쟁에서 밀려 **아예 안 보이는 수준까지**
 * 줄어들었다.
 *
 * | 보드 | 줄을 넣는 자리 |
 * | --- | --- |
 * | 예전 보드 | 컨트롤 바 바로 뒤. 바의 부모가 `display: block` 이고 자식이 바 하나뿐이라 폭을 그대로 쓰는 새 줄이 된다(줄 1224px, 보드가 정상 재배치) |
 * | 새 보드(2026-11) | 컨트롤 바가 없다. 보드 grid 의 `header` 칸 요소 맨 끝. 그 요소가 `flex-wrap: wrap` 이라 `flex-basis: 100%` 면 필터 아래 새 줄이 된다(실측 2026-11-03) |
 *
 * docs/plans/jira-past-sprint-view/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../platform/runtime/featureRoot';
import { BOARD_CONTROLS_BAR, BOARD_SEARCH_FIELD, BOARD_TOOL_ROW_ROOT } from './selectors';

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
 * 새 보드의 머리 영역. 검색칸에서 위로 올라가다 **부모가 grid 인** 첫 요소다.
 *
 * 그 요소가 줄바꿈하는 flex 가 아니면 `null` 이다. 거기 넣으면 필터와 한 줄에서 자리를 다투다
 * 밀려난다 — 처음 붙였던 자리에서 겪은 그대로다.
 */
function findNewBoardHeader(document: Document): HTMLElement | null {
  const view = document.defaultView;
  const search = document.querySelector<HTMLElement>(BOARD_SEARCH_FIELD);
  if (!view || !search) return null;

  for (let element = search.parentElement; element?.parentElement; element = element.parentElement) {
    if (element === document.body) return null;
    if (!view.getComputedStyle(element.parentElement).display.includes('grid')) continue;
    const style = view.getComputedStyle(element);
    return style.display.includes('flex') && style.flexWrap === 'wrap' ? element : null;
  }
  return null;
}

function createRow(document: Document): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute(FEATURE_ROOT_ATTRIBUTE, BOARD_TOOL_ROW_ROOT);
  row.style.all = 'initial';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.flexWrap = 'wrap';
  row.style.gap = '8px';
  row.style.padding = '2px 0 6px';
  /*
   * **위치 지정 요소로 둔다.** 새 보드의 header 칸은 `::before { position: absolute; inset: 0 }` 를
   * 깔아 둔다. 그리기 순서에서 위치 지정 요소가 일반 흐름 위에 오므로, `static` 인 줄은 그 아래에
   * 깔려 클릭이 header 로 간다. Jira 자기 자식들은 `relative` 라 그 위에 있다(실측 2026-11-03,
   * NPT 보드 2145: 칩 클릭이 먹지 않았다).
   */
  row.style.position = 'relative';
  return row;
}

/** 줄이 제자리에 있게 한다. 없으면 만든다. 넣을 자리가 없으면 `null` */
function placeRow(document: Document): HTMLElement | null {
  const existing = findRow(document);
  const bar = document.querySelector<HTMLElement>(BOARD_CONTROLS_BAR);
  if (bar) {
    const row = existing?.isConnected ? existing : createRow(document);
    // 보드가 다시 그려지면서 줄이 엉뚱한 자리에 남을 수 있다.
    if (row.previousElementSibling !== bar) bar.insertAdjacentElement('afterend', row);
    return row;
  }

  const header = findNewBoardHeader(document);
  if (!header) return null;
  const row = existing?.isConnected ? existing : createRow(document);
  // 한 줄을 다 차지해야 필터 아래로 내려간다. 필터와 같은 줄에 남으면 밀려 안 보인다.
  row.style.flexBasis = '100%';
  if (row.parentElement !== header || row.nextElementSibling) header.append(row);
  return row;
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
  const row = placeRow(document);
  if (!row) return null;

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
