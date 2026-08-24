export const JIRA_ORIGIN = 'https://pms-innogrid.atlassian.net';

const BOARD_PATH_PATTERN = /^\/jira\/software\/c\/projects\/([^/]+)\/boards\/(\d+)(\/.*)?$/;
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
