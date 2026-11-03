/**
 * 새 보드(2026-11)의 Relay(GraphQL) 저장소에서 보드와 활성 스프린트를 읽는다.
 *
 * 새 보드는 `window.SPA_STATE.UIF_BOARD` 를 만들지 않는다. 보드 데이터는 Relay 저장소에 있고, 그
 * 저장소는 React 트리 위쪽의 provider 가 `environment` prop 으로 들고 있다. `page-layout.main` 요소의
 * fiber 에서 `.return` 으로 올라가 찾는다(실측 2026-11-03: 142단계).
 *
 * **Jira 내부 구조다.** 빌드가 바뀌면 언제든 사라질 수 있다. 못 읽으면 `null` 을 돌려주고 기능이
 * 조용히 빠진다. 네트워크 요청은 하지 않는다 — 페이지가 이미 들고 있는 것만 읽는다.
 *
 * 실측한 레코드 모양(보드 2147 · 2064 · Kanban 106):
 *
 * | 레코드 | 쓰는 필드 |
 * | --- | --- |
 * | `JiraBoardView` | `board`(→ JiraBoard) · `sprints`(→ 연결 → `edges` → `node`). Kanban 은 `sprints: null` |
 * | `JiraBoard` | `boardId`(숫자) · `boardType`(`SCRUM` · `KANBAN`) |
 * | `JiraSprint` | `id`(ARI, 끝이 스프린트 번호 — REST 의 활성 스프린트 id 와 같았다) · `name` |
 *
 * `JiraSprint` 의 `startDate` · `endDate` · `goal` · `activeWorkingDaysRemaining` 은 사용자가 Jira 의
 * `스프린트 세부 정보` 를 연 뒤에만 생긴다. 처음부터 있다고 기대하지 않는다.
 */

import type { ActiveSprintInfo, BoardSprintState } from './contract';

export interface RelayRecord {
  [key: string]: unknown;
}

/** Relay `RecordSource` 중 우리가 쓰는 두 메서드 */
export interface RelaySource {
  getRecordIDs(): string[];
  get(id: string): RelayRecord | null | undefined;
}

interface Fiber {
  memoizedProps?: { environment?: unknown } | null;
  return?: Fiber | null;
}

interface RelayEnvironment {
  getStore(): { getSource?(): unknown } | null | undefined;
}

/** 실측은 142단계였다. 끝없이 오르지 않게 막는다 */
const MAX_FIBER_STEPS = 2000;

function isRelaySource(value: unknown): value is RelaySource {
  const source = value as Partial<RelaySource> | null;
  return typeof source?.getRecordIDs === 'function' && typeof source.get === 'function';
}

/** `element` 의 React fiber 에서 위로 올라가 Relay 저장소를 찾는다 */
export function findRelaySource(element: Element | null): RelaySource | null {
  if (!element) return null;
  const key = Object.keys(element).find((name) => name.startsWith('__reactFiber$'));
  let fiber = key ? (element as unknown as Record<string, Fiber | undefined>)[key] : undefined;

  for (let steps = 0; fiber && steps < MAX_FIBER_STEPS; steps += 1) {
    const environment = fiber.memoizedProps?.environment as Partial<RelayEnvironment> | undefined;
    if (typeof environment?.getStore === 'function') {
      // 메서드로 부른다. 떼어 내 부르면 `this` 를 잃는다.
      const source = (environment as RelayEnvironment).getStore()?.getSource?.();
      if (isRelaySource(source)) return source;
    }
    fiber = fiber.return ?? undefined;
  }
  return null;
}

function refOf(value: unknown): string | null {
  const id = (value as { __ref?: unknown } | null)?.__ref;
  return typeof id === 'string' ? id : null;
}

function refsOf(value: unknown): string[] {
  const ids = (value as { __refs?: unknown } | null)?.__refs;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

function follow(source: RelaySource, value: unknown): RelayRecord | null {
  const id = refOf(value);
  return id ? source.get(id) ?? null : null;
}

/** 스프린트 ARI 끝의 번호. `…:sprint/activation/<uuid>/2250` → `2250` */
export function sprintNumberFromAri(ari: unknown): number | null {
  if (typeof ari !== 'string') return null;
  const match = ari.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function toActiveSprint(node: RelayRecord): ActiveSprintInfo {
  return {
    id: sprintNumberFromAri(node.id) ?? -1,
    name: typeof node.name === 'string' ? node.name : '',
    goal: typeof node.goal === 'string' ? node.goal : '',
    isoStartDate: typeof node.startDate === 'string' ? node.startDate : null,
    isoEndDate: typeof node.endDate === 'string' ? node.endDate : null,
    daysRemaining: typeof node.activeWorkingDaysRemaining === 'number'
      ? node.activeWorkingDaysRemaining
      : null,
  };
}

/**
 * 보드 하나의 상태를 읽는다. 그 보드의 `JiraBoardView` 가 아직 없으면 `null`(모름)이다.
 *
 * 보드 화면의 `sprints` 연결에 든 것을 활성 스프린트로 본다. 보드가 보여주는 것이 활성 스프린트다.
 */
export function readRelayBoardState(source: RelaySource, boardId: string): BoardSprintState | null {
  for (const id of source.getRecordIDs()) {
    const view = source.get(id);
    if (view?.__typename !== 'JiraBoardView') continue;
    const board = follow(source, view.board);
    if (!board || String(board.boardId) !== boardId) continue;

    const sprintsEnabled = board.boardType === 'SCRUM'
      ? true
      : board.boardType === 'KANBAN' ? false : null;
    const connection = follow(source, view.sprints);
    const sprints = refsOf(connection?.edges)
      .map((edgeId) => follow(source, source.get(edgeId)?.node))
      .filter((node): node is RelayRecord => node?.__typename === 'JiraSprint')
      .map(toActiveSprint);

    return { sprints, sprintsEnabled };
  }
  return null;
}
