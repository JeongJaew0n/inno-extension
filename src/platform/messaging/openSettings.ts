/**
 * Content script → service worker 로 "설정 화면을 열어달라"고 요청하는 메시지.
 *
 * Content script 는 `chrome.windows`·`chrome.action` 을 쓸 수 없고, 확장 페이지로
 * 직접 이동할 수도 없다. 웹 페이지 컨텍스트에서 `chrome-extension://` 로의 최상위
 * 이동은 브라우저가 막는다. 그래서 service worker 를 거친다.
 */

export const OPEN_SETTINGS_MESSAGE = 'inno-extension/open-settings';

export interface OpenSettingsMessage {
  type: typeof OPEN_SETTINGS_MESSAGE;
  /** 열 화면의 Popup 해시 라우트. 예: `#/sites/jira/features/backlogSlashTemplate` */
  route: string;
}

export function isOpenSettingsMessage(value: unknown): value is OpenSettingsMessage {
  const message = value as Partial<OpenSettingsMessage> | null;
  return message?.type === OPEN_SETTINGS_MESSAGE && typeof message.route === 'string';
}

/**
 * 설정 화면을 연다.
 *
 * **응답을 기다리지 않는다.** 실패해도 페이지의 다른 동작에 영향을 주면 안 된다.
 * 확장을 갱신한 직후에는 오래된 content script 가 살아 있어 연결이 끊긴 상태일 수
 * 있는데, 그때 던지는 거부를 잡지 않으면 페이지에 콘솔 오류가 남는다.
 */
export function requestOpenSettings(route: string): void {
  const message: OpenSettingsMessage = { type: OPEN_SETTINGS_MESSAGE, route };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}
