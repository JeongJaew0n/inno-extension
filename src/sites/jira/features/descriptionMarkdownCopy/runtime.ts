/**
 * Jira 업무 **설명**을 Markdown으로 복사한다.
 *
 * Jira 설명 읽기 화면은 Confluence 문서 본문과 **같은 `.ak-renderer-document`** 를 쓴다. 그래서
 * 변환기(`platform/editor/renderer-to-markdown`)를 그대로 쓴다.
 *
 * docs/plans/jira-description-markdown-copy/spec.md
 */

import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import { convertRendererToMarkdown } from '../../../../platform/editor/renderer-to-markdown';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { parseJiraBoardUrl, parseJiraIssueUrl } from '../../routes';
import {
  DESCRIPTION_FIELD,
  DESCRIPTION_LABEL,
  DESCRIPTION_MARKDOWN_COPY_ROOT,
  DESCRIPTION_RENDERER,
} from '../../selectors';

const DEFAULT_LABEL = 'Markdown 복사';

/** 지금 보고 있는 업무 키. 업무가 바뀌면 버튼을 다시 만든다. */
function currentIssueKey(url: URL): string {
  return parseJiraIssueUrl(url.href)?.issueKey
    ?? parseJiraBoardUrl(url.href)?.selectedIssueKey
    ?? 'description';
}

/**
 * 설명 본문을 찾는다.
 *
 * **설명 필드 안에서만 찾는다.** 댓글도 같은 렌더러를 쓰므로 문서 전체에서 찾으면 댓글 본문을
 * 복사하게 된다.
 *
 * 편집 중에는 렌더러가 사라지므로 자연히 `null`이 되어 버튼이 빠진다.
 */
function findDescriptionBody(document: Document): HTMLElement | null {
  const field = document.querySelector<HTMLElement>(DESCRIPTION_FIELD);
  return field?.querySelector<HTMLElement>(DESCRIPTION_RENDERER) ?? null;
}

/**
 * 버튼을 붙일 자리.
 *
 * `설명` 라벨 자신은 `display: block`이고 그 첫 자식이 `display: flex` 줄이다. 그 줄에 붙여야
 * `설명` 오른쪽에 나란히 놓인다. 구조가 바뀌면 라벨 자체에 붙인다 — 줄이 하나 늘 뿐 동작은 한다.
 */
function findLabelRow(document: Document): HTMLElement | null {
  const label = document.querySelector<HTMLElement>(DESCRIPTION_LABEL);
  if (!label) return null;

  const first = label.firstElementChild as HTMLElement | null;
  if (!first) return label;
  const display = document.defaultView?.getComputedStyle(first).display ?? '';
  return display.includes('flex') ? first : label;
}

export function createDescriptionMarkdownCopyRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  let feedbackTimer: number | null = null;

  function dispose(): void {
    if (feedbackTimer !== null) window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
    host?.remove();
    host = null;
  }

  function createButtonHost(
    context: PageContext,
    anchor: HTMLElement,
    issueKey: string,
  ): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, DESCRIPTION_MARKDOWN_COPY_ROOT);
    nextHost.dataset.issueKey = issueKey;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          box-sizing: border-box; min-height: 24px; padding: 0 8px; border: 0;
          border-radius: 3px; background: transparent; color: #44546f; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 500; line-height: 24px; white-space: nowrap;
        }
        svg { width: 14px; height: 14px; flex: 0 0 auto; }
        button:hover { background: #091e420f; color: #172b4d; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
        button:disabled { cursor: default; opacity: 0.72; }
      </style>
      <button type="button" aria-label="업무 설명 Markdown 복사">
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
      try {
        // 클릭 시점의 본문을 다시 찾는다. 그 사이 다른 업무로 바뀌었을 수 있다.
        const body = findDescriptionBody(context.document);
        if (!body) throw new Error('복사할 업무 설명을 찾을 수 없습니다.');
        const markdown = convertRendererToMarkdown(body);
        if (!markdown) throw new Error('복사할 업무 설명이 비어 있습니다.');
        await writePlainText(markdown);
        buttonLabel.textContent = '복사됨';
      } catch (error) {
        console.error('[Inno Extension] Jira 설명 Markdown 복사 실패', error);
        buttonLabel.textContent = '복사 실패';
      }

      feedbackTimer = window.setTimeout(() => {
        if (nextHost.isConnected) {
          button.disabled = false;
          buttonLabel.textContent = DEFAULT_LABEL;
        }
        feedbackTimer = null;
      }, 1200);
    });

    anchor.append(nextHost);
    return nextHost;
  }

  return {
    id: 'descriptionMarkdownCopy',

    reconcile(context: PageContext): void {
      const body = findDescriptionBody(context.document);
      const anchor = findLabelRow(context.document);
      if (!body || !anchor) {
        dispose();
        return;
      }

      const issueKey = currentIssueKey(context.url);
      if (host?.isConnected && host.dataset.issueKey === issueKey && host.parentElement === anchor) {
        return;
      }

      dispose();
      host = createButtonHost(context, anchor, issueKey);
    },

    dispose,
  };
}
