import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  CURRENT_ISSUE_LINK,
  ISSUE_DIALOG,
  ISSUE_LINK_COPY_ROOT,
} from '../../selectors';
import {
  extractIssueKeyFromHref,
  isSupportedNptBoardRoute,
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
    const clipboardContent = buildIssueClipboardContent(issueKey);
    if (!clipboardContent) return null;

    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, ISSUE_LINK_COPY_ROOT);
    nextHost.dataset.issueKey = issueKey;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
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
      <button type="button" aria-label="${issueKey} 이슈 링크 복사" title="${clipboardContent.issueUrl}">
        이슈 링크 복사
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('button');
    if (!button) return null;
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '복사 중';
      try {
        await writeIssueClipboardContent(clipboardContent);
        button.textContent = '복사됨';
      } catch {
        button.textContent = '복사 실패';
      }
      window.setTimeout(() => {
        if (nextHost.isConnected) {
          button.disabled = false;
          button.textContent = '이슈 링크 복사';
        }
      }, 1200);
    });

    issueLink.insertAdjacentElement('afterend', nextHost);
    return nextHost;
  }

  return {
    id: 'issueLinkCopy',

    reconcile(context: PageContext): void {
      const route = parseJiraBoardUrl(context.url.href);
      if (!isSupportedNptBoardRoute(route) || !route.selectedIssueKey) {
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
