export const GITHUB_ENTERPRISE_ORIGIN = 'https://github.nhnent.com';

const OWNER_SEGMENT = '[^/]+';
const PULL_LIST_PATTERN = new RegExp(`^/(${OWNER_SEGMENT})/(${OWNER_SEGMENT})/pulls/?$`);
const PULL_DETAIL_PATTERN = new RegExp(`^/(${OWNER_SEGMENT})/(${OWNER_SEGMENT})/pull/(\\d+)(?:/.*)?$`);

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
