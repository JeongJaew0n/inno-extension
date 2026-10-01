import {
  TITLE_AUTOFILL_BUTTON_ID,
  TITLE_AUTOFILL_SETTINGS_BUTTON_ID,
  TITLE_AUTOFILL_STYLE_ID,
} from '../../selectors';
import { designTokensFor } from '../../../../platform/design/tokens';

/**
 * 아마란스는 **Shadow DOM 을 쓰지 않는다.** 페이지에 `<style>` 을 직접 넣고 주입한 요소의
 * id 로 범위를 잡는다.
 *
 * 그래서 두 가지가 다른 사이트와 다르다.
 *
 * | | 이유 |
 * | --- | --- |
 * | 토큰을 `:host` 가 아니라 `#id` 에 선언한다 | shadow 가 없으니 `:host` 가 걸리지 않는다 |
 * | 공용 컴포넌트 CSS(`.inno-btn`)를 쓰지 않는다 | 클래스는 페이지의 `#id` 규칙에 특이도로 밀린다 |
 *
 * 값은 전부 토큰이다. 모양 규칙만 여기서 직접 쓴다.
 */
const STYLE_TEXT = `
${designTokensFor(`#${TITLE_AUTOFILL_BUTTON_ID}`)}
${designTokensFor(`#${TITLE_AUTOFILL_SETTINGS_BUTTON_ID}`)}
#${TITLE_AUTOFILL_BUTTON_ID} {
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  align-self: center;
  box-sizing: border-box;
  min-height: var(--inno-control-sm);
  margin-right: var(--inno-space-2);
  padding: 0 var(--inno-space-2);
  border: 1px solid var(--inno-outline);
  border-radius: var(--inno-shape-xs);
  background: var(--inno-surface-container-lowest);
  color: var(--inno-primary);
  font-family: var(--inno-font);
  font-size: var(--inno-label-sm);
  font-weight: var(--inno-label-sm-weight);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
#${TITLE_AUTOFILL_BUTTON_ID}:hover:not(.is-disabled) {
  background: var(--inno-surface-container);
}
#${TITLE_AUTOFILL_BUTTON_ID}:focus-visible {
  outline: 2px solid var(--inno-primary);
  outline-offset: 2px;
}
#${TITLE_AUTOFILL_BUTTON_ID}.is-disabled {
  border-color: var(--inno-outline-variant);
  color: var(--inno-outline);
  cursor: not-allowed;
}

/*
 * 말풍선. 어두운 판에 밝은 글씨라 배경·글자를 뒤집어 쓴다.
 *
 * 이 자리를 말풍선이 쓰므로 이 버튼에는 상태 레이어를 얹지 않는다. 둘 다 ::after 를 쓰기
 * 때문에 겹치면 하나가 가려진다.
 */
#${TITLE_AUTOFILL_BUTTON_ID}[data-inno-tooltip]::after {
  content: attr(data-inno-tooltip);
  position: absolute;
  z-index: 2147483647;
  bottom: calc(100% + var(--inno-space-2));
  left: calc(var(--inno-space-2) * -1);
  width: 250px;
  padding: var(--inno-space-2) var(--inno-space-3);
  border-radius: var(--inno-shape-sm);
  background: var(--inno-on-surface);
  color: var(--inno-surface);
  box-shadow: var(--inno-shadow-3);
  font-size: var(--inno-body-sm);
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
  pointer-events: none;
}
#${TITLE_AUTOFILL_BUTTON_ID}[data-inno-tooltip]:hover::after,
#${TITLE_AUTOFILL_BUTTON_ID}[data-inno-tooltip]:focus-visible::after {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

/* 자동채움 왼쪽의 설정 버튼. 자동채움과 같은 높이의 아이콘 버튼이다 */
#${TITLE_AUTOFILL_SETTINGS_BUTTON_ID} {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  align-self: center;
  box-sizing: border-box;
  width: var(--inno-control-sm);
  height: var(--inno-control-sm);
  margin-right: var(--inno-space-1);
  padding: 0;
  border: 1px solid var(--inno-outline);
  border-radius: var(--inno-shape-xs);
  background: var(--inno-surface-container-lowest);
  color: var(--inno-on-surface-variant);
  cursor: pointer;
}
#${TITLE_AUTOFILL_SETTINGS_BUTTON_ID}:hover {
  background: var(--inno-surface-container);
  color: var(--inno-primary);
}
#${TITLE_AUTOFILL_SETTINGS_BUTTON_ID}:focus-visible {
  outline: 2px solid var(--inno-primary);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  #${TITLE_AUTOFILL_BUTTON_ID}[data-inno-tooltip]::after {
    transition: none;
  }
}
`;

export function ensureTitleAutofillStyles(document: Document): void {
  const existing = document.getElementById(TITLE_AUTOFILL_STYLE_ID);
  // 확장을 갱신하면 옛 버전의 style 이 남아 있을 수 있다. 내용이 다르면 바꾼다
  if (existing) {
    if (existing.textContent !== STYLE_TEXT) existing.textContent = STYLE_TEXT;
    return;
  }
  const style = document.createElement('style');
  style.id = TITLE_AUTOFILL_STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

export function removeTitleAutofillStyles(document: Document): void {
  document.getElementById(TITLE_AUTOFILL_STYLE_ID)?.remove();
}
