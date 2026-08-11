import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { parseConfluencePageUrl } from '../../routes';
import {
  PAGE_BODY,
  PAGE_HEADER,
  PAGE_MARKDOWN_COPY_ROOT,
  PAGE_TITLE_WRAPPER,
} from '../../selectors';
import { convertConfluenceBodyToMarkdown } from './markdown';

type ButtonPlacement = 'toolbar' | 'body';

function normalizedText(element: Element): string {
  return element.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

function findNativeLinkCopyButton(document: Document): HTMLElement | null {
  const searchRoot = document.querySelector(PAGE_HEADER) ?? document.querySelector('main');
  if (!searchRoot) return null;

  return Array.from(searchRoot.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
    (candidate) => candidate.getAttribute('aria-label')?.trim() === '링크 복사'
      || normalizedText(candidate) === '링크 복사',
  ) ?? null;
}

function findToolbarActionContainer(button: HTMLElement): HTMLElement | null {
  const header = button.closest<HTMLElement>(PAGE_HEADER);
  const view = button.ownerDocument.defaultView;
  let candidate = button.parentElement;
  const fallback = candidate;

  while (candidate && (!header || header.contains(candidate))) {
    const display = view?.getComputedStyle(candidate).display;
    const controlCount = candidate.querySelectorAll('button, [role="button"]').length;
    if ((display === 'flex' || display === 'inline-flex') && controlCount >= 2) {
      return candidate;
    }
    if (candidate === header) break;
    candidate = candidate.parentElement;
  }

  return fallback;
}

function appendToToolbarEnd(container: HTMLElement, host: HTMLSpanElement): void {
  const view = container.ownerDocument.defaultView;
  const style = view?.getComputedStyle(container);
  if (style?.display.includes('flex') && style.flexDirection === 'row-reverse') {
    container.prepend(host);
  } else {
    container.append(host);
  }
}

function insertHost(
  document: Document,
  host: HTMLSpanElement,
  body: HTMLElement,
): ButtonPlacement | null {
  const nativeLinkCopyButton = findNativeLinkCopyButton(document);
  if (nativeLinkCopyButton) {
    const actionContainer = findToolbarActionContainer(nativeLinkCopyButton);
    if (actionContainer) appendToToolbarEnd(actionContainer, host);
    else nativeLinkCopyButton.insertAdjacentElement('afterend', host);
    return 'toolbar';
  }

  const titleWrapper = document.querySelector<HTMLElement>(PAGE_TITLE_WRAPPER);
  if (titleWrapper?.parentElement) {
    titleWrapper.insertAdjacentElement('afterend', host);
    return 'body';
  }

  if (body.parentElement) {
    body.parentElement.insertBefore(host, body);
    return 'body';
  }

  return null;
}

export function createPageMarkdownCopyRuntime(): FeatureRuntime {
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
    body: HTMLElement,
    pageId: string,
  ): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, PAGE_MARKDOWN_COPY_ROOT);
    nextHost.dataset.pageId = pageId;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.marginInlineStart = '4px';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          box-sizing: border-box; min-height: 32px; padding: 0 10px; border: 0;
          border-radius: 3px; background: transparent; color: #172b4d; cursor: pointer;
          font: inherit; font-size: 14px; font-weight: 500; line-height: 32px; white-space: nowrap;
        }
        svg { width: 16px; height: 16px; flex: 0 0 auto; }
        button:hover { background: #091e420f; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
        button:disabled { cursor: default; opacity: 0.72; }
      </style>
      <button type="button" aria-label="Confluence 본문 Markdown 복사">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2"></rect>
          <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span data-copy-label>본문 Markdown 복사</span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('button');
    const buttonLabel = shadow.querySelector<HTMLElement>('[data-copy-label]');
    if (!button || !buttonLabel) return null;

    button.addEventListener('click', async () => {
      button.disabled = true;
      buttonLabel.textContent = '복사 중';
      try {
        const currentBody = context.document.querySelector<HTMLElement>(PAGE_BODY);
        if (!currentBody) throw new Error('복사할 Confluence 본문을 찾을 수 없습니다.');
        const markdown = convertConfluenceBodyToMarkdown(currentBody);
        if (!markdown) throw new Error('복사할 Confluence 본문이 비어 있습니다.');
        await writePlainText(markdown);
        buttonLabel.textContent = '복사됨';
      } catch (error) {
        console.error('[Inno Extension] Confluence 본문 Markdown 복사 실패', error);
        buttonLabel.textContent = '복사 실패';
      }

      feedbackTimer = window.setTimeout(() => {
        if (nextHost.isConnected) {
          button.disabled = false;
          buttonLabel.textContent = '본문 Markdown 복사';
        }
        feedbackTimer = null;
      }, 1200);
    });

    const placement = insertHost(context.document, nextHost, body);
    if (!placement) return null;
    nextHost.dataset.placement = placement;
    if (placement === 'body') {
      nextHost.style.display = 'flex';
      nextHost.style.justifyContent = 'flex-end';
      nextHost.style.width = '100%';
      nextHost.style.margin = '8px 0';
    }
    return nextHost;
  }

  return {
    id: 'pageMarkdownCopy',

    reconcile(context: PageContext): void {
      const route = parseConfluencePageUrl(context.url);
      if (!route) {
        dispose();
        return;
      }

      const body = context.document.querySelector<HTMLElement>(PAGE_BODY);
      if (!body) {
        dispose();
        return;
      }

      if (host?.isConnected && host.dataset.pageId === route.pageId) {
        const toolbarAvailable = findNativeLinkCopyButton(context.document) !== null;
        if (host.dataset.placement === 'toolbar' || !toolbarAvailable) return;
      }

      dispose();
      host = createButtonHost(context, body, route.pageId);
    },

    dispose,
  };
}
