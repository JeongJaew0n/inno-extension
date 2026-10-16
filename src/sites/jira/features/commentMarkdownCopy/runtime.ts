/**
 * 이미 달린 Jira **댓글** 하나를 Markdown 으로 복사한다.
 *
 * 댓글 본문은 설명과 같은 `.ak-renderer-document` 다. 변환과 이미지 넣기는 설명 복사와 같은
 * `rendererToMarkdownWithImages` 를 쓴다.
 *
 * 버튼은 댓글 아래 동작 줄(답글 · 반응 · 편집 · 더보기) 끝에 댓글마다 하나씩 붙는다. 편집 중인 댓글은
 * 렌더러가 없어 버튼이 빠진다.
 *
 * docs/plans/jira-comment-markdown-copy/spec.md
 */

import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS } from '../../../../platform/design/parts';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { describeCopyResult, rendererToMarkdownWithImages } from '../../rendererMarkdown';
import {
  COMMENT_ITEM_TESTID_PREFIX,
  COMMENT_LIST,
  COMMENT_MARKDOWN_COPY_ROOT,
  DESCRIPTION_RENDERER,
  commentActionsSelector,
  commentBodySelector,
} from '../../selectors';
import { parseCommentId } from './contracts';

const DEFAULT_LABEL = 'Markdown 복사';

/** 읽기 상태 댓글의 본문 렌더러. 편집 중이거나 사라졌으면 `null` */
function findCommentBody(document: Document, commentId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`${commentBodySelector(commentId)} ${DESCRIPTION_RENDERER}`);
}

export function createCommentMarkdownCopyRuntime(): FeatureRuntime {
  /** 댓글 id → 버튼 host */
  const hosts = new Map<string, HTMLSpanElement>();
  const feedbackTimers = new Set<number>();

  function dispose(): void {
    for (const timer of feedbackTimers) window.clearTimeout(timer);
    feedbackTimers.clear();
    for (const host of hosts.values()) host.remove();
    hosts.clear();
  }

  function createButtonHost(document: Document, anchor: HTMLElement, commentId: string): HTMLSpanElement | null {
    const nextHost = document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, COMMENT_MARKDOWN_COPY_ROOT);
    nextHost.dataset.commentId = commentId;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${DESIGN_TOKENS}${BUTTON_CSS}</style>
      <button type="button" class="inno-btn" aria-label="댓글 Markdown 복사">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2"></rect>
          <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span data-copy-label>${DEFAULT_LABEL}</span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('button');
    const buttonLabel = shadow.querySelector<HTMLElement>('[data-copy-label]');
    if (!button || !buttonLabel) return null;

    button.addEventListener('click', async () => {
      button.disabled = true;
      buttonLabel.textContent = '복사 중';
      let feedbackMs = 1200;
      try {
        // 클릭 시점에 다시 찾는다. 그 사이 편집을 시작했거나 다시 그려졌을 수 있다.
        const body = findCommentBody(document, commentId);
        if (!body) throw new Error('복사할 댓글을 찾을 수 없습니다.');
        const { markdown, images } = await rendererToMarkdownWithImages(body);
        if (!markdown) throw new Error('복사할 댓글이 비어 있습니다.');
        await writePlainText(markdown);
        buttonLabel.textContent = describeCopyResult(images);
        // 이미지 수는 확인할 거리가 있는 결과다. 조금 더 오래 보여준다.
        feedbackMs = images.total > 0 ? 2500 : 1200;
      } catch (error) {
        console.error('[Inno Extension] Jira 댓글 Markdown 복사 실패', error);
        buttonLabel.textContent = '복사 실패';
      }

      const timer = window.setTimeout(() => {
        feedbackTimers.delete(timer);
        if (nextHost.isConnected) {
          button.disabled = false;
          buttonLabel.textContent = DEFAULT_LABEL;
        }
      }, feedbackMs);
      feedbackTimers.add(timer);
    });

    anchor.append(nextHost);
    return nextHost;
  }

  return {
    id: 'commentMarkdownCopy',

    /** 지금 읽기 상태인 댓글마다 버튼 하나. 있으면 두고, 없으면 만들고, 사라진 댓글 것은 치운다 */
    reconcile(context: PageContext): void {
      const document = context.document;
      const seen = new Set<string>();
      const items = document.querySelectorAll<HTMLElement>(
        `${COMMENT_LIST} [data-testid^="${COMMENT_ITEM_TESTID_PREFIX}"]`,
      );

      for (const item of items) {
        const commentId = parseCommentId(item.getAttribute('data-testid') ?? '');
        if (!commentId || seen.has(commentId)) continue;
        const anchor = item.querySelector<HTMLElement>(commentActionsSelector(commentId));
        if (!anchor || !findCommentBody(document, commentId)) continue;
        seen.add(commentId);

        const existing = hosts.get(commentId);
        if (existing?.isConnected && existing.parentElement === anchor) continue;

        existing?.remove();
        const next = createButtonHost(document, anchor, commentId);
        if (next) hosts.set(commentId, next);
        else hosts.delete(commentId);
      }

      for (const [commentId, host] of hosts) {
        if (seen.has(commentId)) continue;
        host.remove();
        hosts.delete(commentId);
      }
    },

    dispose,
  };
}
