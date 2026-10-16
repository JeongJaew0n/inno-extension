/**
 * 댓글 Markdown 복사의 순수 로직.
 *
 * docs/plans/jira-comment-markdown-copy/spec.md
 */

import { COMMENT_ITEM_TESTID_PREFIX } from '../../selectors';

/**
 * 댓글 루트의 `data-testid` 에서 댓글 id 를 뽑는다. 루트가 아니면 `null`.
 *
 * 같은 접두사를 쓰는 `-header` · `-body` · `-footer` 는 루트가 아니다.
 */
export function parseCommentId(testId: string): string | null {
  if (!testId.startsWith(COMMENT_ITEM_TESTID_PREFIX)) return null;
  const id = testId.slice(COMMENT_ITEM_TESTID_PREFIX.length);
  return /^\d+$/.test(id) ? id : null;
}
