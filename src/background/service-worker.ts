/**
 * MV3 service worker.
 *
 * 하는 일은 하나다 — content script 가 요청하면 **설정 화면을 창으로 띄운다.**
 *
 * `chrome.action.openPopup()` 을 쓰지 않는다. 그쪽은 `default_popup` 에 적힌 URL 을
 * 그대로 열어서 **원하는 화면으로 바로 보낼 수 없다.** 설정 화면을 여는 이유가
 * "Popup 을 열고 메뉴를 세 번 눌러 들어가기 귀찮아서"인데, 그러면 아무것도 해결되지
 * 않는다. 창으로 열면 해시 라우트를 붙일 수 있다.
 */

import { isOpenSettingsMessage } from '../platform/messaging/openSettings';

const POPUP_PAGE = 'src/popup/index.html';

/** Popup CSS 가 `width: 520px` · `max-height: 600px` 를 쓴다. 창 테두리만큼 여유를 둔다. */
const WINDOW_WIDTH = 536;
const WINDOW_HEIGHT = 700;

/**
 * 열어둔 설정 창의 id.
 *
 * service worker 는 몇 초만 놀아도 종료되고 모듈 변수는 함께 사라진다. 그래서
 * `storage.session` 에 둔다. 브라우저를 닫으면 같이 사라지므로 청소할 필요가 없다.
 */
const WINDOW_ID_KEY = 'settingsWindowId';

async function readWindowId(): Promise<number | null> {
  const stored = await chrome.storage.session.get(WINDOW_ID_KEY);
  const value = stored[WINDOW_ID_KEY];
  return typeof value === 'number' ? value : null;
}

async function writeWindowId(windowId: number | null): Promise<void> {
  if (windowId === null) await chrome.storage.session.remove(WINDOW_ID_KEY);
  else await chrome.storage.session.set({ [WINDOW_ID_KEY]: windowId });
}

/** 이미 열린 설정 창이 있으면 그 창을 요청한 화면으로 옮기고 앞으로 가져온다. */
async function reuseWindow(windowId: number, url: string): Promise<boolean> {
  try {
    const existing = await chrome.windows.get(windowId, { populate: true });
    const tabId = existing.tabs?.[0]?.id;
    if (tabId === undefined) return false;
    await chrome.tabs.update(tabId, { url, active: true });
    await chrome.windows.update(windowId, { focused: true });
    return true;
  } catch {
    // 사용자가 이미 닫은 창이다.
    return false;
  }
}

async function openSettingsWindow(route: string): Promise<void> {
  // 라우트는 우리 코드가 만들지만, 메시지로 들어오는 값이라 형태를 확인한다.
  const hash = route.startsWith('#') ? route : '';
  const url = chrome.runtime.getURL(`${POPUP_PAGE}${hash}`);

  const known = await readWindowId();
  if (known !== null && await reuseWindow(known, url)) return;

  const created = await chrome.windows.create({
    url,
    type: 'popup',
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  });
  await writeWindowId(created?.id ?? null);
}

chrome.windows.onRemoved.addListener((windowId) => {
  void readWindowId().then((known) => {
    if (known === windowId) return writeWindowId(null);
    return undefined;
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOpenSettingsMessage(message)) return undefined;

  openSettingsWindow(message.route).then(
    () => sendResponse({ ok: true }),
    (error: unknown) => sendResponse({ ok: false, reason: String(error) }),
  );
  // 비동기로 답하므로 채널을 열어둔다.
  return true;
});
