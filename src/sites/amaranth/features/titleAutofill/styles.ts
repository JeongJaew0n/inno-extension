import { TITLE_AUTOFILL_BUTTON_ID, TITLE_AUTOFILL_STYLE_ID } from '../../selectors';

const STYLE_TEXT = `
#${TITLE_AUTOFILL_BUTTON_ID} {
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  height: 24px;
  margin-right: 8px;
  padding: 0 8px;
  border: 1px solid #2196f3;
  border-radius: 3px;
  background: #ffffff;
  color: #1675c1;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  line-height: 22px;
  white-space: nowrap;
  cursor: pointer;
}
#${TITLE_AUTOFILL_BUTTON_ID}:hover:not(.is-disabled) {
  background: #eef7ff;
}
#${TITLE_AUTOFILL_BUTTON_ID}:focus-visible {
  outline: 2px solid #1675c1;
  outline-offset: 2px;
}
#${TITLE_AUTOFILL_BUTTON_ID}.is-disabled {
  border-color: #c9cdd2;
  color: #a4a8ad;
  cursor: not-allowed;
}
#${TITLE_AUTOFILL_BUTTON_ID}[data-inno-tooltip]::after {
  content: attr(data-inno-tooltip);
  position: absolute;
  z-index: 2147483647;
  bottom: calc(100% + 8px);
  left: -8px;
  width: 250px;
  padding: 8px 10px;
  border-radius: 5px;
  background: rgba(35, 40, 48, 0.96);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-size: 11px;
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
@media (prefers-reduced-motion: reduce) {
  #${TITLE_AUTOFILL_BUTTON_ID}[data-inno-tooltip]::after {
    transition: none;
  }
}
`;

export function ensureTitleAutofillStyles(document: Document): void {
  if (document.getElementById(TITLE_AUTOFILL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TITLE_AUTOFILL_STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

export function removeTitleAutofillStyles(document: Document): void {
  document.getElementById(TITLE_AUTOFILL_STYLE_ID)?.remove();
}
