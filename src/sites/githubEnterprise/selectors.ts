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

export const COMMIT_SHA_COPY_ROOT = 'github-commit-sha-copy';

/**
 * Conversation 탭 타임라인 항목.
 *
 * Commits 탭에도 같은 형태의 커밋 링크가 있지만 `.TimelineItem`은 없다. route 판정과 함께
 * 이중으로 Commits 탭을 배제한다.
 */
export const TIMELINE_ITEM = '.TimelineItem';

/** 타임라인 커밋 행의 커밋 번호 셀. 우측 정렬이며 자식은 `code` 하나다. */
export const TIMELINE_COMMIT_SHA_CELL = '.text-right';

/** 커밋 번호 셀 안의 커밋 링크. */
export const TIMELINE_COMMIT_LINK = 'a[href]';
