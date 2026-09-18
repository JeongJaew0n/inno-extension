/**
 * 보드 활성 스프린트 정보를 MAIN world 에서 읽어오는 계약.
 *
 * `window.SPA_STATE` 는 페이지가 만든 객체라 content script(ISOLATED)에서 보이지 않는다.
 * **네트워크 요청은 하지 않는다.** 페이지가 이미 들고 있는 값을 읽을 뿐이다.
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
  isoStartDate: string;
  isoEndDate: string;
  daysRemaining: number | null;
}

export interface SprintStateResponse {
  requestId?: unknown;
  sprints?: unknown;
  message?: unknown;
}
