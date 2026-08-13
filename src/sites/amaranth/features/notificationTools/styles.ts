import {
  NOTIFICATION_CODE_ROW_CLASS,
  NOTIFICATION_COPY_BUTTON_CLASS,
  NOTIFICATION_REFRESH_BUTTON_ID,
  NOTIFICATION_TOOLS_STYLE_ID,
} from '../../selectors';

const STYLE_TEXT = `
#${NOTIFICATION_REFRESH_BUTTON_ID} {
  appearance: none;
  position: absolute;
  top: 4px;
  right: 12px;
  z-index: 2;
  height: 22px;
  min-width: 66px;
  padding: 0 8px;
  border: 1px solid #b9c5cf;
  border-radius: 3px;
  background: #ffffff;
  color: #43515e;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}:hover:not(:disabled) {
  border-color: #4588df;
  color: #276fca;
  background: #f4f9ff;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}:focus-visible,
.${NOTIFICATION_COPY_BUTTON_CLASS}:focus-visible {
  outline: 2px solid #276fca;
  outline-offset: 1px;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}:disabled {
  cursor: wait;
  opacity: 0.7;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}[data-state="success"] {
  border-color: #4f9a72;
  color: #327552;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}[data-state="error"] {
  border-color: #d36a6a;
  color: #b33d3d;
}
.${NOTIFICATION_CODE_ROW_CLASS} {
  align-items: center;
  min-width: 0;
}
.${NOTIFICATION_CODE_ROW_CLASS} > dd.name {
  min-width: 0;
}
.${NOTIFICATION_COPY_BUTTON_CLASS} {
  appearance: none;
  flex: 0 0 auto;
  height: 20px;
  min-width: 34px;
  margin-left: 5px;
  padding: 0 6px;
  border: 1px solid #91b9e8;
  border-radius: 3px;
  background: #f4f9ff;
  color: #276fca;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.${NOTIFICATION_COPY_BUTTON_CLASS}:hover:not(:disabled) {
  border-color: #4588df;
  background: #eaf4ff;
}
.${NOTIFICATION_COPY_BUTTON_CLASS}:disabled {
  cursor: default;
  opacity: 0.82;
}
.${NOTIFICATION_COPY_BUTTON_CLASS}[data-state="success"] {
  border-color: #70ad8b;
  background: #f0faf4;
  color: #327552;
}
.${NOTIFICATION_COPY_BUTTON_CLASS}[data-state="error"] {
  border-color: #d88a8a;
  background: #fff5f5;
  color: #b33d3d;
}
`;

export function ensureNotificationToolsStyles(document: Document): void {
  if (document.getElementById(NOTIFICATION_TOOLS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = NOTIFICATION_TOOLS_STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

export function removeNotificationToolsStyles(document: Document): void {
  document.getElementById(NOTIFICATION_TOOLS_STYLE_ID)?.remove();
}
