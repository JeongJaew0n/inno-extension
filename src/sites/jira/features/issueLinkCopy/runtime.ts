import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  CURRENT_ISSUE_LINK,
  CURRENT_ISSUE_TITLE,
  ISSUE_DIALOG,
  ISSUE_LINK_COPY_ROOT,
  ISSUE_PREVIEW_PANEL,
} from '../../selectors';
import {
  extractIssueKeyFromHref,
  isJiraBoardRoute,
  parseJiraBoardUrl,
  parseJiraIssueUrl,
} from '../../routes';
import { buildIssueClipboardContent, writeIssueClipboardContent } from './clipboard';

/**
 * 업무 번호 링크를 어떤 근거로 찾았는지 구분한다.
 *
 * `current-issue-link`는 업무 상세의 breadcrumb 링크이고, `issue-anchor`는 같은 업무를 가리키는
 * 임의의 앵커다. preview panel 헤더의 `Open in new tab` 링크가 후자에 해당한다.
 * breadcrumb이 아직 렌더되지 않은 순간에는 후자만 존재할 수 있어, 어느 쪽에 붙었는지 구분해야
 * 나중에 올바른 위치로 옮길 수 있다.
 */
type IssueLinkKind = 'current-issue-link' | 'issue-anchor';

interface IssueLinkMatch {
  kind: IssueLinkKind;
  link: HTMLAnchorElement;
}

export interface IssueViewTarget {
  issueKey: string;
  issueTitle: string | null;
  mountKind: 'board-dialog-link' | 'board-panel-link' | 'direct-link' | 'direct-title';
  mountAnchorKind: IssueLinkKind | 'summary-title';
  /** 이미 존재하는 host가 이번에 결정된 기준 요소에 실제로 붙어 있는지 판정한다. */
  isMountedAt(host: HTMLSpanElement): boolean;
  mountHost(host: HTMLSpanElement): void;
}

export interface BoardIssueScope {
  issueLink: HTMLAnchorElement;
  issueLinkKind: IssueLinkKind;
  mountKind: 'board-dialog-link' | 'board-panel-link';
  scope: ParentNode;
}

function normalizeText(text: string | null | undefined): string | null {
  const normalized = text?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function findIssueLink(scope: ParentNode, issueKey: string): IssueLinkMatch | null {
  const preferred = scope.querySelector<HTMLAnchorElement>(CURRENT_ISSUE_LINK);
  if (preferred && extractIssueKeyFromHref(preferred.getAttribute('href')) === issueKey) {
    return { kind: 'current-issue-link', link: preferred };
  }

  for (const link of scope.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (extractIssueKeyFromHref(link.getAttribute('href')) === issueKey) {
      return { kind: 'issue-anchor', link };
    }
  }
  return null;
}

export function findBoardIssueScope(document: Document, issueKey: string): BoardIssueScope | null {
  const candidates: Array<{
    mountKind: BoardIssueScope['mountKind'];
    scope: ParentNode | null;
  }> = [
    {
      mountKind: 'board-dialog-link',
      scope: document.querySelector(ISSUE_DIALOG),
    },
    {
      mountKind: 'board-panel-link',
      scope: document.querySelector(ISSUE_PREVIEW_PANEL),
    },
    ...Array.from(document.querySelectorAll('[role="dialog"]')).map((scope) => ({
      mountKind: 'board-dialog-link' as const,
      scope,
    })),
  ];
  const visited = new Set<ParentNode>();

  for (const candidate of candidates) {
    if (!candidate.scope || visited.has(candidate.scope)) continue;
    visited.add(candidate.scope);
    const match = findIssueLink(candidate.scope, issueKey);
    if (match) {
      return {
        issueLink: match.link,
        issueLinkKind: match.kind,
        mountKind: candidate.mountKind,
        scope: candidate.scope,
      };
    }
  }
  return null;
}

function readIssueTitle(element: HTMLElement | null): string | null {
  if (!element) return null;
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelector(`[${FEATURE_ROOT_ATTRIBUTE}="${ISSUE_LINK_COPY_ROOT}"]`)?.remove();
  return normalizeText(clone.textContent);
}

function isVisibleContentHeading(element: HTMLElement): boolean {
  return element.getClientRects().length > 0
    && !element.closest('header, nav, [role="banner"], [role="navigation"]');
}

function findFallbackIssueHeading(context: PageContext): HTMLElement | null {
  const main = context.document.querySelector('main, [role="main"]') ?? context.document.body;
  const headings = Array.from(main.querySelectorAll<HTMLElement>('h1')).filter((heading) => {
    if (!isVisibleContentHeading(heading)) return false;
    return readIssueTitle(heading) !== null;
  });

  if (headings.length === 0) return null;
  return headings.reduce((best, candidate) => {
    const bestLength = readIssueTitle(best)?.length ?? 0;
    const candidateLength = readIssueTitle(candidate)?.length ?? 0;
    return candidateLength > bestLength ? candidate : best;
  });
}

function resolveIssueViewTarget(context: PageContext): IssueViewTarget | null {
  const boardRoute = parseJiraBoardUrl(context.url.href);
  if (isJiraBoardRoute(boardRoute) && boardRoute.selectedIssueKey) {
    const boardIssueScope = findBoardIssueScope(context.document, boardRoute.selectedIssueKey);
    if (!boardIssueScope) return null;

    const titleElement = boardIssueScope.scope.querySelector<HTMLElement>(CURRENT_ISSUE_TITLE);
    const issueLink = boardIssueScope.issueLink;
    return {
      issueKey: boardRoute.selectedIssueKey,
      issueTitle: readIssueTitle(titleElement),
      mountKind: boardIssueScope.mountKind,
      mountAnchorKind: boardIssueScope.issueLinkKind,
      isMountedAt(host) {
        return host.previousElementSibling === issueLink;
      },
      mountHost(host) {
        issueLink.insertAdjacentElement('afterend', host);
      },
    };
  }

  const issueKey = parseJiraIssueUrl(context.url.href)?.issueKey ?? null;
  if (!issueKey) return null;

  const match = findIssueLink(context.document, issueKey);
  const titleElement = context.document.querySelector<HTMLElement>(CURRENT_ISSUE_TITLE)
    ?? findFallbackIssueHeading(context);
  const issueTitle = readIssueTitle(titleElement);

  if (match) {
    const issueLink = match.link;
    return {
      issueKey,
      issueTitle,
      mountKind: 'direct-link',
      mountAnchorKind: match.kind,
      isMountedAt(host) {
        return host.previousElementSibling === issueLink;
      },
      mountHost(host) {
        issueLink.insertAdjacentElement('afterend', host);
      },
    };
  }

  if (!titleElement) return null;
  const titleHost = titleElement;
  return {
    issueKey,
    issueTitle,
    mountKind: 'direct-title',
    mountAnchorKind: 'summary-title',
    isMountedAt(host) {
      return host.parentElement === titleHost;
    },
    mountHost(host) {
      titleHost.appendChild(host);
    },
  };
}

/**
 * 이미 붙어 있는 host를 그대로 둬도 되는지 판정한다.
 *
 * 업무 번호와 mountKind만 비교하면 같은 preview panel 안에서 기준 요소가 달라진 경우를 구분하지
 * 못한다. 실제로 breadcrumb이 렌더되기 전에는 panel 헤더의 `Open in new tab` 링크가 선택되는데,
 * 두 경우 모두 mountKind가 `board-panel-link`라서 오배치가 영구히 고정된다.
 * 그래서 기준 요소 자체의 동일성까지 확인한다.
 */
export function isIssueHostCurrent(
  host: HTMLSpanElement | null,
  target: IssueViewTarget,
): boolean {
  if (!host?.isConnected) return false;
  return host.dataset.issueKey === target.issueKey
    && host.dataset.mountKind === target.mountKind
    && target.isMountedAt(host);
}

export function createIssueLinkCopyRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;

  function dispose(): void {
    host?.remove();
    host = null;
  }

  function createButtonHost(
    context: PageContext,
    target: IssueViewTarget,
  ): HTMLSpanElement | null {
    const linkClipboardContent = buildIssueClipboardContent(target.issueKey);
    if (!linkClipboardContent) return null;

    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, ISSUE_LINK_COPY_ROOT);
    nextHost.dataset.issueKey = target.issueKey;
    nextHost.dataset.mountKind = target.mountKind;
    nextHost.dataset.mountAnchor = target.mountAnchorKind;
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
      <button type="button" data-copy-mode="link" aria-label="${target.issueKey} 업무 링크 복사" title="${linkClipboardContent.issueUrl}">
        업무 링크 복사
      </button>
      <button type="button" data-copy-mode="title" aria-label="${target.issueKey} 업무 링크 복사 제목포함" title="${linkClipboardContent.issueUrl}">
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
      const issueTitle = resolveIssueViewTarget(context)?.issueTitle ?? target.issueTitle;
      return issueTitle ? buildIssueClipboardContent(target.issueKey, issueTitle) : null;
    });

    target.mountHost(nextHost);
    return nextHost;
  }

  return {
    id: 'issueLinkCopy',

    reconcile(context: PageContext): void {
      const target = resolveIssueViewTarget(context);
      if (!target) {
        dispose();
        return;
      }

      if (isIssueHostCurrent(host, target)) return;
      dispose();
      host = createButtonHost(context, target);
    },

    dispose,
  };
}
