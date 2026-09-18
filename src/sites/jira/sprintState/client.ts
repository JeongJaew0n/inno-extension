/** ISOLATED world 쪽 호출부. 응답이 없으면 빈 배열로 끝낸다 — 보드를 붙잡아 두지 않는다. */

import {
  SPRINT_STATE_REQUEST_EVENT,
  SPRINT_STATE_RESPONSE_EVENT,
  type ActiveSprintInfo,
  type SprintStateResponse,
} from './contract';

const TIMEOUT_MS = 1000;

export function requestActiveSprints(
  document: Document,
  boardId: string,
): Promise<ActiveSprintInfo[]> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    const finish = (sprints: ActiveSprintInfo[]): void => {
      document.removeEventListener(SPRINT_STATE_RESPONSE_EVENT, onResponse);
      window.clearTimeout(timer);
      resolve(sprints);
    };
    const onResponse = (event: Event): void => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      let detail: SprintStateResponse;
      try {
        detail = JSON.parse(event.detail) as SprintStateResponse;
      } catch {
        return;
      }
      if (detail.requestId !== requestId) return;
      if (typeof detail.message === 'string') {
        console.warn('[Inno Extension] Jira 스프린트 정보', detail.message);
      }
      finish(Array.isArray(detail.sprints) ? detail.sprints as ActiveSprintInfo[] : []);
    };
    const timer = window.setTimeout(() => finish([]), TIMEOUT_MS);

    document.addEventListener(SPRINT_STATE_RESPONSE_EVENT, onResponse);
    document.dispatchEvent(new CustomEvent(SPRINT_STATE_REQUEST_EVENT, {
      detail: JSON.stringify({ requestId, boardId }),
    }));
  });
}
