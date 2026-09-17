/**
 * 업무 **설명** 라벨 줄. 설명 관련 버튼을 여기에 모은다.
 *
 * 라벨은 읽기 중에도 편집 중에도 그대로 있다. 실측으로 확인했다.
 *
 * docs/plans/jira-description-edit-actions/context.md
 */

import { DESCRIPTION_LABEL } from './selectors';

/**
 * 버튼을 붙일 줄을 찾는다.
 *
 * 라벨 자신은 `display: block`이고 그 첫 자식이 `display: flex` 줄이다. 그 줄에 붙여야 `설명`
 * 오른쪽에 나란히 놓인다. 구조가 바뀌면 라벨 자체에 붙인다 — 줄이 하나 늘 뿐 동작은 한다.
 */
export function findDescriptionLabelRow(document: Document): HTMLElement | null {
  const label = document.querySelector<HTMLElement>(DESCRIPTION_LABEL);
  if (!label) return null;

  const first = label.firstElementChild as HTMLElement | null;
  if (!first) return label;
  const display = document.defaultView?.getComputedStyle(first).display ?? '';
  return display.includes('flex') ? first : label;
}
