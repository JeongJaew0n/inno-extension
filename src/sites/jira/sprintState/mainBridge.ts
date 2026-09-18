/**
 * MAIN world 에서 `window.SPA_STATE` 의 활성 스프린트를 읽어 돌려준다.
 *
 * **Jira 내부 상태 모양에 기댄다.** 빌드가 바뀌면 경로가 사라질 수 있다. 그때는 빈 배열을
 * 돌려주고 기능이 조용히 빠진다 — 보드를 망가뜨리지 않는 쪽을 택한다. 원인을 못 찾는 일이
 * 없도록 페이지당 한 번 콘솔에 남긴다.
 *
 * docs/plans/jira-board-sprint-info/context.md
 */

import {
  SPRINT_STATE_REQUEST_EVENT,
  SPRINT_STATE_RESPONSE_EVENT,
  type ActiveSprintInfo,
} from './contract';

const BRIDGE_FLAG = '__innoExtensionJiraSprintStateBridgeInstalled';

interface BridgeWindow extends Window {
  [BRIDGE_FLAG]?: boolean;
  SPA_STATE?: Record<string, unknown>;
}

interface RawSprint {
  id?: unknown;
  name?: unknown;
  state?: unknown;
  goal?: unknown;
  isoStartDate?: unknown;
  isoEndDate?: unknown;
  daysRemaining?: unknown;
}

function toActiveSprint(raw: RawSprint): ActiveSprintInfo | null {
  if (raw?.state !== 'ACTIVE') return null;
  if (typeof raw.isoStartDate !== 'string' || typeof raw.isoEndDate !== 'string') return null;

  return {
    id: typeof raw.id === 'number' ? raw.id : -1,
    name: typeof raw.name === 'string' ? raw.name : '',
    goal: typeof raw.goal === 'string' ? raw.goal : '',
    isoStartDate: raw.isoStartDate,
    isoEndDate: raw.isoEndDate,
    daysRemaining: typeof raw.daysRemaining === 'number' ? raw.daysRemaining : null,
  };
}

function readActiveSprints(boardId: string): ActiveSprintInfo[] {
  const state = (window as BridgeWindow).SPA_STATE;
  const boards = state?.UIF_BOARD as Record<string, unknown> | undefined;
  if (!boards) return [];

  const entry = boards[`uif-board::rapidboard-board::${boardId}`] as
    { data?: { result?: { sprints?: unknown } } } | undefined;
  const sprints = entry?.data?.result?.sprints;
  if (!Array.isArray(sprints)) return [];

  return sprints
    .map((sprint) => toActiveSprint(sprint as RawSprint))
    .filter((sprint): sprint is ActiveSprintInfo => sprint !== null);
}

export function installSprintStateBridge(): void {
  const bridgeWindow = window as BridgeWindow;
  if (bridgeWindow[BRIDGE_FLAG]) return;
  bridgeWindow[BRIDGE_FLAG] = true;

  let warned = false;

  document.addEventListener(SPRINT_STATE_REQUEST_EVENT, (event) => {
    let detail: { requestId?: unknown; boardId?: unknown } = {};
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      try {
        detail = JSON.parse(event.detail) as typeof detail;
      } catch {
        return;
      }
    }
    const requestId = typeof detail.requestId === 'string' ? detail.requestId : '';
    const boardId = typeof detail.boardId === 'string' ? detail.boardId : '';
    if (!requestId || !boardId) return;

    let sprints: ActiveSprintInfo[] = [];
    let message: string | undefined;
    try {
      sprints = readActiveSprints(boardId);
      if (sprints.length === 0 && !warned) {
        warned = true;
        message = 'SPA_STATE에서 활성 스프린트를 찾지 못했습니다.';
      }
    } catch (error) {
      message = error instanceof Error ? error.message : '스프린트 상태를 읽지 못했습니다.';
    }

    document.dispatchEvent(new CustomEvent(SPRINT_STATE_RESPONSE_EVENT, {
      detail: JSON.stringify({ requestId, sprints, message }),
    }));
  });
}
