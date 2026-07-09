import { INJECTED_ID } from '../shared/selectors';

/**
 * 주입 버튼 스타일. content_scripts CSS 파일 대신 JS 로 <style> 을 넣는다.
 * SPA 리렌더/CSP 영향 없이 확실하게 적용되고, 번들 구성이 단순해진다.
 */
export const STYLE_TEXT = `
#${INJECTED_ID} {
  /*
   * 헤더의 .user-info 가 float:left 라서, 시각적으로 그 "왼쪽" 에 오려면
   * 이 컨테이너도 float:left 로 두고 DOM 상 user-info 앞에 삽입해야 한다.
   * (float 요소끼리는 DOM 순서대로 왼쪽부터 쌓인다.)
   */
  float: left;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  margin-right: 12px;
  vertical-align: middle;
}
#${INJECTED_ID} .inno-gw-btn {
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
#${INJECTED_ID} .inno-gw-btn:hover {
  border-color: #4a7dff;
  color: #4a7dff;
}
#${INJECTED_ID} .inno-gw-btn.is-active {
  background: #4a7dff;
  border-color: #4a7dff;
  color: #ffffff;
}
#${INJECTED_ID} .inno-gw-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;

const STYLE_ID = `${INJECTED_ID}-style`;

/** <head> 에 스타일을 1회만 주입한다. */
export function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}
