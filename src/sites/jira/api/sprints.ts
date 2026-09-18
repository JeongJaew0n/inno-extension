/**
 * Jira Agile REST 읽기 클라이언트.
 *
 * **이 저장소에서 네트워크를 쓰는 유일한 자리다.** 다른 곳에 네트워크 호출이 생기면 테스트가
 * 깨진다(`네트워크를 쓰는 기능은 카탈로그에 표시돼 있어야 한다`).
 *
 * 지켜야 할 것 — CLAUDE.md '특별 관리란'
 *
 * | 규칙 | 여기서 |
 * | --- | --- |
 * | 읽기만 | `GET` 외에는 만들지 않는다 |
 * | 시점 | 호출부가 사용자 조작에서만 부른다. 이 모듈은 스스로 호출하지 않는다 |
 * | 오리진 | 상대 경로만 쓴다. 다른 호스트로 나갈 수 없다 |
 * | 인증 | 브라우저 세션 쿠키. **토큰을 저장하지 않는다** |
 *
 * docs/plans/jira-past-sprint-view/spec.md
 */

/** 한 번에 가져올 최대 건수. Jira 가 100을 넘겨주지 않는다. */
const PAGE_SIZE = 100;
/** 업무가 아주 많은 스프린트에서 무한정 도는 것을 막는다. */
const MAX_PAGES = 20;

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate: string | null;
  endDate: string | null;
  goal: string;
}

export interface JiraBoardIssue {
  key: string;
  summary: string;
  statusName: string;
  statusCategory: string;
  issueTypeName: string;
  issueTypeIconUrl: string;
  assigneeName: string;
  assigneeAvatarUrl: string;
  parentKey: string;
  parentSummary: string;
}

export class JiraApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'JiraApiError';
  }
}

/**
 * 상대 경로로만 요청한다. **절대 URL 을 받지 않는다** — 다른 호스트로 나갈 길을 두지 않는다.
 */
async function getJson(path: string): Promise<unknown> {
  if (!path.startsWith('/rest/')) throw new Error(`허용되지 않은 경로입니다: ${path}`);

  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new JiraApiError('Jira에 연결하지 못했습니다.', 0);
  }

  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403
      ? '이 보드를 볼 권한이 없습니다.'
      : response.status === 429
        ? 'Jira 요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요.'
        : `Jira가 ${response.status}로 응답했습니다.`;
    throw new JiraApiError(reason, response.status);
  }
  return response.json() as Promise<unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toSprint(raw: unknown): JiraSprint | null {
  const value = raw as Record<string, unknown> | null;
  if (!value || typeof value.id !== 'number') return null;
  const state = asString(value.state);
  if (state !== 'active' && state !== 'closed' && state !== 'future') return null;

  return {
    id: value.id,
    name: asString(value.name),
    state,
    startDate: asString(value.startDate) || null,
    endDate: asString(value.endDate) || null,
    goal: asString(value.goal),
  };
}

/** 보드의 스프린트 목록. 활성과 종료만 쓴다. */
export async function fetchBoardSprints(boardId: string): Promise<JiraSprint[]> {
  const sprints: JiraSprint[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await getJson(
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint`
      + `?state=active,closed&startAt=${page * PAGE_SIZE}&maxResults=${PAGE_SIZE}`,
    ) as { values?: unknown; isLast?: unknown };

    const values = Array.isArray(body.values) ? body.values : [];
    for (const raw of values) {
      const sprint = toSprint(raw);
      if (sprint) sprints.push(sprint);
    }
    if (body.isLast !== false || values.length === 0) break;
  }

  return sprints;
}

function toIssue(raw: unknown): JiraBoardIssue | null {
  const value = raw as { key?: unknown; fields?: Record<string, unknown> } | null;
  if (!value || typeof value.key !== 'string') return null;
  const fields = value.fields ?? {};

  const status = fields.status as { name?: unknown; statusCategory?: { key?: unknown } } | undefined;
  const issueType = fields.issuetype as { name?: unknown; iconUrl?: unknown } | undefined;
  const assignee = fields.assignee as { displayName?: unknown; avatarUrls?: Record<string, unknown> } | undefined;
  const parent = fields.parent as { key?: unknown; fields?: { summary?: unknown } } | undefined;

  return {
    key: value.key,
    summary: asString(fields.summary),
    statusName: asString(status?.name),
    statusCategory: asString(status?.statusCategory?.key),
    issueTypeName: asString(issueType?.name),
    issueTypeIconUrl: asString(issueType?.iconUrl),
    assigneeName: asString(assignee?.displayName),
    assigneeAvatarUrl: asString(assignee?.avatarUrls?.['24x24']),
    parentKey: asString(parent?.key),
    parentSummary: asString(parent?.fields?.summary),
  };
}

/**
 * 스프린트의 업무 목록.
 *
 * 응답의 `fields` 는 134개나 되고 그중 89개가 `customfield_*` 다. **필요한 것만 달라고 한다.**
 * 그래야 응답이 작아지고 우리가 다루지 않을 값이 메모리에 남지 않는다.
 */
export async function fetchSprintIssues(sprintId: number): Promise<JiraBoardIssue[]> {
  const fields = 'summary,status,issuetype,assignee,parent';
  const issues: JiraBoardIssue[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await getJson(
      `/rest/agile/1.0/sprint/${sprintId}/issue`
      + `?fields=${fields}&startAt=${page * PAGE_SIZE}&maxResults=${PAGE_SIZE}`,
    ) as { issues?: unknown; total?: unknown };

    const values = Array.isArray(body.issues) ? body.issues : [];
    for (const raw of values) {
      const issue = toIssue(raw);
      if (issue) issues.push(issue);
    }
    const total = typeof body.total === 'number' ? body.total : issues.length;
    if (values.length === 0 || issues.length >= total) break;
  }

  return issues;
}
