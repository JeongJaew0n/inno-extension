import { INJECTED_ID, STYLE_ID } from '../../selectors';

const STYLE_TEXT = `
#${INJECTED_ID} {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  width: 100%;
  gap: 6px;
  margin-top: 8px;
  clear: both;
  box-sizing: border-box;
}
#${INJECTED_ID} .inno-amaranth-attendance-checkin-group {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
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
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy {
  appearance: none;
  border: 1px solid #b9c5cf;
  border-radius: 12px;
  background: #ffffff;
  color: #59636d;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 8px;
  white-space: nowrap;
  cursor: pointer;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy:hover:not(:disabled) {
  border-color: #4a7dff;
  color: #4a7dff;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy:focus-visible {
  outline: 2px solid #4a7dff;
  outline-offset: 1px;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy:disabled {
  cursor: default;
  opacity: 0.8;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy[data-state="success"] {
  border-color: #70ad8b;
  color: #327552;
}
#${INJECTED_ID} .inno-amaranth-attendance-greeting-copy[data-state="error"] {
  border-color: #d88a8a;
  color: #b33d3d;
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
