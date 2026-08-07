export const JIRA_ORIGIN = 'https://pms-innogrid.atlassian.net';

const BOARD_PATH_PATTERN = /^\/jira\/software\/c\/projects\/([^/]+)\/boards\/(\d+)(\/.*)?$/;
const ISSUE_PATH_PATTERN = /^\/browse\/([A-Z][A-Z0-9_]*-\d+)$/;

export interface JiraBoardRoute {
  boardId: string;
  projectKey: string;
  selectedIssueKey: string | null;
  viewPath: string;
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

export function uniqueIssueKeys(hrefs: Iterable<string | null>): string[] {
  const keys = new Set<string>();
  for (const href of hrefs) {
    const key = extractIssueKeyFromHref(href);
    if (key) keys.add(key);
  }
  return [...keys].sort(compareIssueKeys);
}

function compareIssueKeys(left: string, right: string): number {
  const leftParts = left.split('-');
  const rightParts = right.split('-');
  const leftNumber = Number(leftParts.pop());
  const rightNumber = Number(rightParts.pop());
  const projectComparison = leftParts.join('-').localeCompare(rightParts.join('-'));
  return projectComparison || leftNumber - rightNumber;
}

export function isJiraBoardRoute(route: JiraBoardRoute | null): route is JiraBoardRoute {
  return route !== null && route.viewPath === '';
}
