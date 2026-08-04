import { INJECTED_ID, STYLE_ID } from '../../selectors';

const STYLE_TEXT = `
#${INJECTED_ID} {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
  gap: 6px;
  margin-top: 8px;
  clear: both;
  box-sizing: border-box;
}
#${INJECTED_ID} .inno-amaranth-attendance-button {
  appearance: none;
  border: 1px solid #c8ccd4;
  background: #ffffff;
  color: #3b4048;
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}
#${INJECTED_ID} .inno-amaranth-attendance-button:hover {
  border-color: #4a7dff;
  color: #4a7dff;
}
#${INJECTED_ID} .inno-amaranth-attendance-button.is-active {
  background: #4a7dff;
  border-color: #4a7dff;
  color: #ffffff;
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
