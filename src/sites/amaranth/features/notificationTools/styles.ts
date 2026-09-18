import {
  NOTIFICATION_CODE_ROW_CLASS,
  NOTIFICATION_COPY_BUTTON_CLASS,
  NOTIFICATION_REFRESH_BUTTON_ID,
  NOTIFICATION_TOOLS_STYLE_ID,
} from '../../selectors';
import { designTokensFor } from '../../../../platform/design/tokens';

/**
 * 아마란스는 Shadow DOM 을 쓰지 않는다. 자세한 사정은 titleAutofill/styles.ts 에 적었다.
 *
 * 여기는 한 가지가 더 있다. **복사 버튼은 주입 루트 밑이 아니라 알림 행 안에 붙는다.**
 * 그래서 토큰을 두 선택자 모두에 선언한다. 한쪽만 선언하면 나머지가 값을 못 찾는다.
 */
const STYLE_TEXT = `
${designTokensFor(
  `#${NOTIFICATION_REFRESH_BUTTON_ID}, .${NOTIFICATION_COPY_BUTTON_CLASS}`,
)}
#${NOTIFICATION_REFRESH_BUTTON_ID} {
  appearance: none;
  position: absolute;
  top: 4px;
  right: 12px;
  z-index: 2;
  min-height: var(--inno-control-sm);
  min-width: 66px;
  padding: 0 var(--inno-space-2);
  border: 1px solid var(--inno-outline-variant);
  border-radius: var(--inno-shape-xs);
  background: var(--inno-surface-container-lowest);
  color: var(--inno-on-surface-variant);
  font-family: var(--inno-font);
  font-size: var(--inno-label-sm);
  font-weight: var(--inno-label-sm-weight);
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}:hover:not(:disabled) {
  border-color: var(--inno-primary);
  color: var(--inno-primary);
  background: var(--inno-surface-container);
}
#${NOTIFICATION_REFRESH_BUTTON_ID}:focus-visible,
.${NOTIFICATION_COPY_BUTTON_CLASS}:focus-visible {
  outline: 2px solid var(--inno-primary);
  outline-offset: 1px;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}:disabled {
  cursor: wait;
  opacity: 0.7;
}
#${NOTIFICATION_REFRESH_BUTTON_ID}[data-state="success"] {
  border-color: var(--inno-primary);
  color: var(--inno-primary);
}
#${NOTIFICATION_REFRESH_BUTTON_ID}[data-state="error"] {
  border-color: var(--inno-error);
  color: var(--inno-error);
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
  min-height: 20px;
  min-width: 34px;
  margin-left: var(--inno-space-1);
  padding: 0 var(--inno-space-1);
  border: 1px solid transparent;
  border-radius: var(--inno-shape-xs);
  background: var(--inno-primary-container);
  color: var(--inno-on-primary-container);
  font-family: var(--inno-font);
  font-size: var(--inno-label-sm);
  font-weight: var(--inno-label-sm-weight);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.${NOTIFICATION_COPY_BUTTON_CLASS}:hover:not(:disabled) {
  border-color: var(--inno-primary);
}
.${NOTIFICATION_COPY_BUTTON_CLASS}:disabled {
  cursor: default;
  opacity: 0.82;
}
.${NOTIFICATION_COPY_BUTTON_CLASS}[data-state="success"] {
  border-color: var(--inno-primary);
  background: var(--inno-primary-container);
  color: var(--inno-on-primary-container);
}
.${NOTIFICATION_COPY_BUTTON_CLASS}[data-state="error"] {
  border-color: var(--inno-error);
  background: var(--inno-error-container);
  color: var(--inno-on-error-container);
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
