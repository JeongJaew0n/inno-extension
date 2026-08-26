export const GITHUB_ENTERPRISE_ORIGIN = 'https://github.nhnent.com';

const OWNER_SEGMENT = '[^/]+';
const PULL_LIST_PATTERN = new RegExp(`^/(${OWNER_SEGMENT})/(${OWNER_SEGMENT})/pulls/?$`);
const PULL_DETAIL_PATTERN = new RegExp(`^/(${OWNER_SEGMENT})/(${OWNER_SEGMENT})/pull/(\\d+)(?:/.*)?$`);

/**
 * PR Conversation 탭 경로.
 *
 * `PULL_DETAIL_PATTERN`은 `/files`, `/commits` 같은 하위 탭까지 포함한다. 제목 복사는 모든
 * 하위 탭에서 동작해야 하므로 그쪽에는 맞는 계약이다. 그러나 커밋 번호 복사는 Conversation
 * 탭 전용이다. Commits 탭에는 GitHub이 제공하는 `Copy full SHA` 버튼이 이미 있어 우리 버튼이
 * 붙으면 같은 일을 하는 버튼이 두 개가 된다.
 */
const PULL_CONVERSATION_PATTERN = new RegExp(`^/(${OWNER_SEGMENT})/(${OWNER_SEGMENT})/pull/(\\d+)/?$`);

export interface PullRequestListRoute {
  kind: 'list';
  owner: string;
  repo: string;
}

export interface PullRequestDetailRoute {
  kind: 'detail';
  owner: string;
  repo: string;
  pullNumber: string;
}

export type GithubEnterpriseRoute = PullRequestListRoute | PullRequestDetailRoute;

function parsePathname(input: string): { origin: string; pathname: string } | null {
  try {
    const url = new URL(input, GITHUB_ENTERPRISE_ORIGIN);
    return { origin: url.origin, pathname: url.pathname };
  } catch {
    return null;
  }
}

/**
 * 지원 화면인지 판정한다.
 *
 * 저장소 PR 목록(`/{owner}/{repo}/pulls`)과 PR 상세(`/{owner}/{repo}/pull/{번호}`)만 지원한다.
 * 전역 대시보드 `/pulls`는 DOM 구조가 같지만 적용 범위에 포함하지 않는다.
 */
export function parseGithubEnterpriseRoute(input: string): GithubEnterpriseRoute | null {
  const parsed = parsePathname(input);
  if (!parsed || parsed.origin !== GITHUB_ENTERPRISE_ORIGIN) return null;

  const detail = parsed.pathname.match(PULL_DETAIL_PATTERN);
  if (detail) {
    return { kind: 'detail', owner: detail[1], repo: detail[2], pullNumber: detail[3] };
  }

  const list = parsed.pathname.match(PULL_LIST_PATTERN);
  if (list) {
    return { kind: 'list', owner: list[1], repo: list[2] };
  }

  return null;
}

/**
 * PR 링크의 상대 경로에서 정규화된 절대 URL을 만든다.
 *
 * 목록의 제목 링크는 `/{owner}/{repo}/pull/{번호}` 형태의 상대 경로다.
 * 쿼리와 fragment는 공유 대상이 아니므로 제거한다.
 */
export function buildPullRequestUrl(href: string | null): string | null {
  if (!href) return null;
  const parsed = parsePathname(href);
  if (!parsed || parsed.origin !== GITHUB_ENTERPRISE_ORIGIN) return null;

  const detail = parsed.pathname.match(PULL_DETAIL_PATTERN);
  if (!detail) return null;
  return `${GITHUB_ENTERPRISE_ORIGIN}/${detail[1]}/${detail[2]}/pull/${detail[3]}`;
}

export interface PullRequestConversationRoute {
  owner: string;
  repo: string;
  pullNumber: string;
}

export function parsePullRequestConversationUrl(
  input: string,
): PullRequestConversationRoute | null {
  let url: URL;
  try {
    url = new URL(input, GITHUB_ENTERPRISE_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== GITHUB_ENTERPRISE_ORIGIN) return null;

  const match = url.pathname.match(PULL_CONVERSATION_PATTERN);
  if (!match) return null;

  return { owner: match[1], repo: match[2], pullNumber: match[3] };
}

const FULL_COMMIT_SHA_PATTERN = /\/commits\/([0-9a-f]{40})\/?$/i;

/**
 * 타임라인 커밋 링크의 `href`에서 전체 SHA를 읽는다.
 *
 * 화면에 보이는 텍스트는 7자 단축본이다. GitHub의 기본 버튼은 `Copy full SHA`라는 이름대로
 * 40자 전체를 복사하므로 같은 값을 사용한다. GitLab이 `data-commit` 속성에 담는 것과 달리
 * GitHub은 링크 경로에 담는다.
 */
export function extractCommitShaFromHref(href: string | null | undefined): string | null {
  if (typeof href !== 'string') return null;

  let url: URL;
  try {
    url = new URL(href, GITHUB_ENTERPRISE_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== GITHUB_ENTERPRISE_ORIGIN) return null;
  return url.pathname.match(FULL_COMMIT_SHA_PATTERN)?.[1].toLowerCase() ?? null;
}
