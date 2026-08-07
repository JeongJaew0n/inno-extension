import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  CURRENT_ISSUE_LINK,
  CURRENT_ISSUE_TITLE,
  ISSUE_DIALOG,
  ISSUE_LINK_COPY_ROOT,
} from '../../selectors';
import {
  extractIssueKeyFromHref,
  isJiraBoardRoute,
  parseJiraBoardUrl,
} from '../../routes';
import { buildIssueClipboardContent, writeIssueClipboardContent } from './clipboard';

function findCurrentIssueLink(context: PageContext, issueKey: string): HTMLAnchorElement | null {
  const dialog = context.document.querySelector(ISSUE_DIALOG)
    ?? context.document.querySelector('[role="dialog"]');
  if (!dialog) return null;

  const preferred = dialog.querySelector<HTMLAnchorElement>(CURRENT_ISSUE_LINK);
  if (preferred && extractIssueKeyFromHref(preferred.getAttribute('href')) === issueKey) {
    return preferred;
  }

  for (const link of dialog.querySelectorAll<HTMLAnchorElement>('a[href^="/browse/"]')) {
    if (extractIssueKeyFromHref(link.getAttribute('href')) === issueKey) return link;
  }
  return null;
}

function findCurrentIssueTitle(context: PageContext): string | null {
  const dialog = context.document.querySelector(ISSUE_DIALOG)
    ?? context.document.querySelector('[role="dialog"]');
  const title = dialog?.querySelector<HTMLElement>(CURRENT_ISSUE_TITLE)?.textContent
    ?.trim()
    .replace(/\s+/g, ' ');
  return title || null;
}

export function createIssueLinkCopyRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;

  function dispose(): void {
    host?.remove();
    host = null;
  }

  function createButtonHost(
    context: PageContext,
    issueKey: string,
    issueLink: HTMLAnchorElement,
  ): HTMLSpanElement | null {
    const linkClipboardContent = buildIssueClipboardContent(issueKey);
    if (!linkClipboardContent) return null;

    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, ISSUE_LINK_COPY_ROOT);
    nextHost.dataset.issueKey = issueKey;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.gap = '2px';
    nextHost.style.marginInlineStart = '4px';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button {
          box-sizing: border-box; min-height: 24px; padding: 2px 8px; border: 0;
          border-radius: 4px; background: transparent; color: #44546f; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 600; line-height: 20px; white-space: nowrap;
        }
        button:hover { background: #091e420f; color: #172b4d; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
        button:disabled { cursor: default; opacity: 0.72; }
      </style>
      <button type="button" data-copy-mode="link" aria-label="${issueKey} 업무 링크 복사" title="${linkClipboardContent.issueUrl}">
        업무 링크 복사
      </button>
      <button type="button" data-copy-mode="title" aria-label="${issueKey} 업무 링크 복사 제목포함" title="${linkClipboardContent.issueUrl}">
        업무 링크 복사(제목포함)
      </button>
    `;

    const linkButton = shadow.querySelector<HTMLButtonElement>('[data-copy-mode="link"]');
    const titleButton = shadow.querySelector<HTMLButtonElement>('[data-copy-mode="title"]');
    if (!linkButton || !titleButton) return null;

    function attachCopyBehavior(
      button: HTMLButtonElement,
      defaultLabel: string,
      getClipboardContent: () => ReturnType<typeof buildIssueClipboardContent>,
    ): void {
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = '복사 중';
        try {
          const clipboardContent = getClipboardContent();
          if (!clipboardContent) throw new Error('복사할 업무 정보를 만들 수 없습니다.');
          await writeIssueClipboardContent(clipboardContent);
          button.textContent = '복사됨';
        } catch {
          button.textContent = '복사 실패';
        }
        window.setTimeout(() => {
          if (nextHost.isConnected) {
            button.disabled = false;
            button.textContent = defaultLabel;
          }
        }, 1200);
      });
    }

    attachCopyBehavior(linkButton, '업무 링크 복사', () => linkClipboardContent);
    attachCopyBehavior(titleButton, '업무 링크 복사(제목포함)', () => {
      const issueTitle = findCurrentIssueTitle(context);
      return issueTitle ? buildIssueClipboardContent(issueKey, issueTitle) : null;
    });

    issueLink.insertAdjacentElement('afterend', nextHost);
    return nextHost;
  }

  return {
    id: 'issueLinkCopy',

    reconcile(context: PageContext): void {
      const route = parseJiraBoardUrl(context.url.href);
      if (!isJiraBoardRoute(route) || !route.selectedIssueKey) {
        dispose();
        return;
      }

      if (host?.isConnected && host.dataset.issueKey === route.selectedIssueKey) return;
      dispose();
      const issueLink = findCurrentIssueLink(context, route.selectedIssueKey);
      if (issueLink) host = createButtonHost(context, route.selectedIssueKey, issueLink);
    },

    dispose,
  };
}
