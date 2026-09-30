/** ISOLATED world 쪽 호출부. 응답이 없으면 실패로 끝낸다 — 버튼을 붙잡아 두지 않는다. */

import {
  TOKEN_PRESET_REQUEST_EVENT,
  TOKEN_PRESET_RESPONSE_EVENT,
  failedResult,
  normalizeResult,
  type TokenPresetResult,
} from './contracts';

/** 선택기 대기(최대 약 6초)와 다시 그리기 대기(1.6초)보다 넉넉하게 */
const TIMEOUT_MS = 12_000;

export function requestTokenPreset(document: Document): Promise<TokenPresetResult> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    const finish = (result: TokenPresetResult): void => {
      document.removeEventListener(TOKEN_PRESET_RESPONSE_EVENT, onResponse);
      window.clearTimeout(timer);
      resolve(result);
    };
    const onResponse = (event: Event): void => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      let detail: { requestId?: unknown };
      try {
        detail = JSON.parse(event.detail) as { requestId?: unknown };
      } catch {
        return;
      }
      if (detail.requestId !== requestId) return;
      finish(normalizeResult(detail));
    };
    const timer = window.setTimeout(
      () => finish(failedResult('응답이 없습니다. 확장을 다시 로드한 뒤 페이지를 새로고침하세요.')),
      TIMEOUT_MS,
    );

    document.addEventListener(TOKEN_PRESET_RESPONSE_EVENT, onResponse);
    document.dispatchEvent(new CustomEvent(TOKEN_PRESET_REQUEST_EVENT, {
      detail: JSON.stringify({ requestId }),
    }));
  });
}
