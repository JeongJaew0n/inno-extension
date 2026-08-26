export const PULL_REQUEST_TITLE_COPY_ROOT = 'github-pull-request-title-copy';

/** PR 목록의 각 행. */
export const PULL_REQUEST_ROW = '.js-issue-row';

/** 목록 행의 제목 링크. */
export const PULL_REQUEST_ROW_TITLE_LINK = 'a[data-hovercard-type="pull_request"]';

/**
 * PR 상세의 제목.
 *
 * 상세 화면에는 `.js-issue-title`이 두 개 있다. 하나는 본문 제목(`bdi`), 다른 하나는 스크롤 시
 * 나타나는 sticky 헤더의 링크(`a`)다. `bdi`로 좁혀 sticky 쪽 중복 주입을 막는다.
 */
export const PULL_REQUEST_DETAIL_TITLE = 'bdi.js-issue-title';
