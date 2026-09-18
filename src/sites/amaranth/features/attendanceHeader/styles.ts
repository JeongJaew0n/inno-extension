import { INJECTED_ID, STYLE_ID } from '../../selectors';
import { designTokensFor } from '../../../../platform/design/tokens';

/**
 * 아마란스는 Shadow DOM 을 쓰지 않는다. 페이지에 style 을 직접 넣고 주입 루트 id 로
 * 범위를 잡으므로 토큰도 그 선택자에 선언한다. 자세한 사정은 titleAutofill/styles.ts 에 적었다.
 */

const STYLE_TEXT = `
${designTokensFor(`#${INJECTED_ID}`)}
#${INJECTED_ID} {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  width: 100%;
  gap: var(--inno-space-1);
  margin-top: var(--inno-space-2);
  clear: both;
  box-sizing: border-box;
}
#${INJECTED_ID} .inno-amaranth-attendance-checkin-group {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: stretch;
  gap: var(--inno-space-1);
}
#${INJECTED_ID} .inno-amaranth-attendance-button {
  appearance: none;
  border: 1px solid var(--inno-outline);
  background: var(--inno-surface-container-lowest);
  color: var(--inno-on-surface);
  font-size: var(--inno-label-md);
  line-height: 1;
  font-weight: 600;
  padding: var(--inno-space-2) var(--inno-space-3);
  border-radius: var(--inno-shape-full);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}
#${INJECTED_ID} .inno-amaranth-attendance-button:hover {
  border-color: var(--inno-primary);
  color: var(--inno-primary);
}
#${INJECTED_ID} .inno-amaranth-attendance-button.is-active {
  background: var(--inno-primary);
  border-color: var(--inno-primary);
  color: var(--inno-on-primary);
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy {
  appearance: none;
  border: 1px solid var(--inno-outline-variant);
  border-radius: var(--inno-shape-full);
  background: var(--inno-surface-container-lowest);
  color: var(--inno-on-surface-variant);
  font-family: inherit;
  font-size: var(--inno-label-sm);
  font-weight: var(--inno-label-sm-weight);
  line-height: 1;
  padding: var(--inno-space-1) var(--inno-space-2);
  white-space: nowrap;
  cursor: pointer;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy:hover:not(:disabled) {
  border-color: var(--inno-primary);
  color: var(--inno-primary);
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy:focus-visible {
  outline: 2px solid var(--inno-primary);
  outline-offset: 1px;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy:disabled {
  cursor: default;
  opacity: 0.8;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy[data-state="success"] {
  border-color: var(--inno-primary);
  color: var(--inno-primary);
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy[data-state="error"] {
  border-color: var(--inno-error);
  color: var(--inno-error);
}
`;

export function ensureAttendanceStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

export function removeAttendanceStyles(document: Document): void {
  document.getElementById(STYLE_ID)?.remove();
}
