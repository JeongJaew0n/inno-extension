/**
 * 업무 **설명** 라벨 줄. 설명 관련 버튼을 여기에 모은다.
 *
 * 라벨은 읽기 중에도 편집 중에도 그대로 있다. 실측으로 확인했다.
 *
 * docs/plans/jira-description-edit-actions/context.md
 */

import { DESCRIPTION_LABEL } from './selectors';

/**
 * 버튼을 붙일 줄을 찾는다. `설명` 오른쪽에 나란히 놓이는 flex 줄이다.
 *
 * | 구조 | 줄 |
 * | --- | --- |
 * | 예전 | 라벨(`display: block`)의 첫 자식 flex 줄 |
 * | 2026-11 | 라벨이 글자뿐인 `h2` 다. 그 부모 `issue-view-base.common.description.heading-with-draft` 가 flex 줄이다(gap 8px, align center — 실측 2026-11-03) |
 *
 * 새 구조에서 라벨에 붙이면 버튼이 **제목(`h2`) 안**으로 들어간다. 그러면 화면 낭독기가 버튼을
 * 제목의 일부로 읽는다. 둘 다 아니면 라벨 자체에 붙인다 — 줄이 하나 늘 뿐 동작은 한다.
 */
export function findDescriptionLabelRow(document: Document): HTMLElement | null {
  const label = document.querySelector<HTMLElement>(DESCRIPTION_LABEL);
  if (!label) return null;

  const isFlex = (element: Element | null): element is HTMLElement =>
    element !== null && (document.defaultView?.getComputedStyle(element).display ?? '').includes('flex');

  const first = label.firstElementChild;
  if (first) return isFlex(first) ? first : label;
  return isFlex(label.parentElement) ? label.parentElement : label;
}
