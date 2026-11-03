/**
 * 보드 활성 스프린트 정보를 MAIN world 에서 읽어오는 계약.
 *
 * 페이지가 들고 있는 상태는 content script(ISOLATED)에서 보이지 않는다.
 * **네트워크 요청은 하지 않는다.** 페이지가 이미 들고 있는 값을 읽을 뿐이다.
 *
 * | 보드 | 읽는 곳 |
 * | --- | --- |
 * | 예전 보드 | `window.SPA_STATE.UIF_BOARD` |
 * | 새 보드(2026-11) | Relay 저장소(`relay.ts`). 날짜는 Jira 의 `스프린트 세부 정보` 를 연 뒤에만 있다 |
 *
 * docs/plans/jira-board-sprint-info/context.md
 */

export const SPRINT_STATE_REQUEST_EVENT = 'inno-extension:jira:read-active-sprint';
export const SPRINT_STATE_RESPONSE_EVENT = 'inno-extension:jira:read-active-sprint-result';

export interface ActiveSprintInfo {
  id: number;
  name: string;
  /** 스프린트 목표(설명). 설정하지 않으면 빈 문자열이다 */
  goal: string;
  /** 못 읽었으면 `null`. 새 보드는 사용자가 `스프린트 세부 정보` 를 열기 전엔 날짜가 없다 */
  isoStartDate: string | null;
  isoEndDate: string | null;
  /** Jira 가 센 남은 작업일. 못 읽었으면 `null` */
  daysRemaining: number | null;
}

export interface SprintStateResponse {
  requestId?: unknown;
  sprints?: unknown;
  sprintsEnabled?: unknown;
  message?: unknown;
}

/** 보드 하나에 대해 페이지에서 읽은 스프린트 상태 */
export interface BoardSprintState {
  sprints: ActiveSprintInfo[];
  /** 이 보드가 스프린트를 쓰는가. 못 읽었으면 `null` */
  sprintsEnabled: boolean | null;
}

/**
 * `SPA_STATE` 의 보드 결과에서 스프린트를 쓰는 보드인지 읽는다.
 *
 * 실측(2026-10-16): Kanban 보드는 `type: 'KANBAN'` · `capabilities.SPRINTS.enabled: false` 이고
 * `sprints` 키가 없다. 스크럼 보드는 `type: 'SCRUM'` · `enabled: true` 다. 기능 표시가 더 직접적이라
 * 먼저 보고, 없으면 보드 종류로 판단한다. 둘 다 없으면 모른다(`null`).
 */
export function readSprintsEnabled(result: unknown): boolean | null {
  if (!result || typeof result !== 'object') return null;
  const board = result as { type?: unknown; capabilities?: { SPRINTS?: { enabled?: unknown } } };
  const enabled = board.capabilities?.SPRINTS?.enabled;
  if (typeof enabled === 'boolean') return enabled;
  if (board.type === 'KANBAN') return false;
  if (board.type === 'SCRUM') return true;
  return null;
}
