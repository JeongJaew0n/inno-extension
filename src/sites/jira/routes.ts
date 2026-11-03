export const JIRA_ORIGIN = 'https://pms-innogrid.atlassian.net';

/**
 * 보드 주소. `c/` 가 있는 것과 없는 것 **둘 다** 받는다.
 *
 * 실측(2026-11-03): Jira 가 새 보드로 바뀌면서 활성 스프린트 보드 주소에서 `c/` 가 빠졌다
 * (`/jira/software/projects/NPT/boards/2147`). 백로그는 여전히 `/jira/software/c/projects/…/backlog`
 * 다. 한쪽만 받으면 보드에서 업무를 열어도 아무 기능도 붙지 않는다.
 *
 * docs/troubleshootings/project-specific/2026-11-03-new-jira-board-features-missing.md
 */
const BOARD_PATH_PATTERN = /^\/jira\/software\/(?:c\/)?projects\/([^/]+)\/boards\/(\d+)(\/.*)?$/;
const ISSUE_KEY_PATTERN = '[A-Z][A-Z0-9_]*-\\d+';
const ISSUE_PATH_PATTERN = new RegExp(`^/(?:browse|issues)/(${ISSUE_KEY_PATTERN})/?$`);

export interface JiraBoardRoute {
  boardId: string;
  projectKey: string;
  selectedIssueKey: string | null;
  viewPath: string;
  url: string;
}

export interface JiraIssueRoute {
  issueKey: string;
  url: string;
}

export function normalizeIssueKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]*-\d+$/.test(normalized) ? normalized : null;
}

export function parseJiraBoardUrl(input: string): JiraBoardRoute | null {
  let url: URL;
  try {
    url = new URL(input, JIRA_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== JIRA_ORIGIN) return null;
  const match = url.pathname.match(BOARD_PATH_PATTERN);
  if (!match) return null;

  return {
    boardId: match[2],
    projectKey: match[1],
    selectedIssueKey: normalizeIssueKey(url.searchParams.get('selectedIssue')),
    viewPath: match[3] || '',
    url: url.href,
  };
}

export function parseJiraIssueUrl(input: string): JiraIssueRoute | null {
  let url: URL;
  try {
    url = new URL(input, JIRA_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== JIRA_ORIGIN) return null;
  const issueKey = url.pathname.match(ISSUE_PATH_PATTERN)?.[1] ?? null;
  if (!issueKey) return null;

  return {
    issueKey,
    url: url.href,
  };
}

export function extractIssueKeyFromHref(href: string | null): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, JIRA_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== JIRA_ORIGIN) return null;
  return url.pathname.match(ISSUE_PATH_PATTERN)?.[1] ?? null;
}

const SUPPORTED_BOARD_VIEW_PATHS = new Set(['', '/backlog']);

export function isJiraBoardRoute(route: JiraBoardRoute | null): route is JiraBoardRoute {
  return route !== null && SUPPORTED_BOARD_VIEW_PATHS.has(route.viewPath);
}
