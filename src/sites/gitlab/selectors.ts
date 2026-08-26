export const COMMIT_SHA_COPY_ROOT = 'gitlab-commit-sha-copy';

/**
 * GitLab 활동 영역의 시스템 노트.
 *
 * 커밋 참조 링크는 시스템 노트와 사용자 댓글 양쪽에 같은 클래스로 나타난다. 실측에서는 개요
 * 탭에 12개가 있었고 그중 6개가 댓글 안이었다. 댓글은 대상이 아니므로 시스템 노트로 좁힌다.
 */
export const SYSTEM_NOTE = '.system-note';

/** 커밋 참조 링크. 표시 텍스트는 8자 단축 SHA다. */
export const COMMIT_REFERENCE_LINK = 'a.gfm.gfm-commit';

/** 전체 40자 SHA를 담고 있는 속성. */
export const COMMIT_SHA_ATTRIBUTE = 'data-commit';
