export const GITLAB_ORIGIN = 'https://rnd-app.innogrid.com';

/**
 * Merge Request 개요 화면 경로.
 *
 * namespace는 중첩 그룹 때문에 깊이가 가변이다. 실측 대상만 해도
 * `nativeplatformteam/cone-chain/cone-chain-backend`로 3단이다. 세그먼트 수를 고정하지 않는다.
 *
 * `/commits`, `/diffs`, `/pipelines` 같은 하위 탭은 제외한다. 개요 탭만 대상이다.
 */
const MERGE_REQUEST_OVERVIEW_PATTERN = /^\/(.+?)\/-\/merge_requests\/(\d+)\/?$/;

export interface MergeRequestOverviewRoute {
  namespacePath: string;
  mergeRequestIid: string;
}

export function parseMergeRequestOverviewUrl(
  input: string,
): MergeRequestOverviewRoute | null {
  let url: URL;
  try {
    url = new URL(input, GITLAB_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== GITLAB_ORIGIN) return null;

  const match = url.pathname.match(MERGE_REQUEST_OVERVIEW_PATTERN);
  if (!match) return null;

  return { namespacePath: match[1], mergeRequestIid: match[2] };
}

const FULL_COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

/**
 * 커밋 참조 링크의 `data-commit` 값을 검증한다.
 *
 * 화면에 보이는 텍스트는 8자 단축 SHA이지만 복사 대상은 40자 전체 SHA다. GitLab이 Commits
 * 탭에서 제공하는 기본 복사 버튼도 전체 SHA를 사용하므로 같은 값을 유지한다.
 */
export function normalizeCommitSha(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return FULL_COMMIT_SHA_PATTERN.test(normalized) ? normalized : null;
}

const MERGE_REQUEST_LIST_PATTERN = /^\/(.+?)\/-\/merge_requests\/?$/;
const MERGE_REQUEST_DETAIL_PATTERN = /^\/(.+?)\/-\/merge_requests\/(\d+)(?:\/.*)?$/;

export interface MergeRequestListRoute {
  kind: 'list';
  namespacePath: string;
}

export interface MergeRequestDetailRoute {
  kind: 'detail';
  namespacePath: string;
  mergeRequestIid: string;
}

export type MergeRequestTitleRoute = MergeRequestListRoute | MergeRequestDetailRoute;

/**
 * 제목 복사가 적용되는 화면을 판정한다.
 *
 * 목록과 상세 모두 지원하며, 상세는 `/commits`, `/diffs` 같은 하위 탭도 포함한다. 제목은
 * 모든 하위 탭에 표시되므로 어디서든 복사할 수 있어야 한다. 커밋 번호 복사가 개요 탭만
 * 지원하는 것과 대비되는 지점이다.
 */
export function parseMergeRequestTitleRoute(input: string): MergeRequestTitleRoute | null {
  let url: URL;
  try {
    url = new URL(input, GITLAB_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== GITLAB_ORIGIN) return null;

  const detail = url.pathname.match(MERGE_REQUEST_DETAIL_PATTERN);
  if (detail) {
    return { kind: 'detail', namespacePath: detail[1], mergeRequestIid: detail[2] };
  }

  const list = url.pathname.match(MERGE_REQUEST_LIST_PATTERN);
  if (list) return { kind: 'list', namespacePath: list[1] };

  return null;
}

/** 목록 행의 제목 링크 `href`에서 정규화된 MR 절대 URL을 만든다. */
export function buildMergeRequestUrl(href: string | null | undefined): string | null {
  if (typeof href !== 'string') return null;

  let url: URL;
  try {
    url = new URL(href, GITLAB_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== GITLAB_ORIGIN) return null;
  const match = url.pathname.match(MERGE_REQUEST_DETAIL_PATTERN);
  if (!match) return null;
  return `${GITLAB_ORIGIN}/${match[1]}/-/merge_requests/${match[2]}`;
}
