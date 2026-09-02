import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  PULL_REQUEST_DETAIL_TITLE,
  PULL_REQUEST_ROW,
  PULL_REQUEST_ROW_TITLE_LINK,
  PULL_REQUEST_TITLE_COPY_ROOT,
} from '../../selectors';
import { buildPullRequestUrl, parseGithubEnterpriseRoute } from '../../routes';
import {
  buildPullRequestClipboardContent,
  buildPullRequestTitleText,
  writePullRequestClipboardContent,
} from './clipboard';
import { writePlainText } from '../../../../platform/clipboard/writePlainText';

interface CopyTarget {
  anchor: Element;
  pullRequestUrl: string;
  title: string;
}

const COPY_FEEDBACK_MS = 1500;

/**
 * 이 런타임이 직접 만들어 클릭 리스너가 살아 있는 host 집합.
 *
 * GitHub Enterprise는 Turbo를 사용한다. Turbo는 DOM 스냅샷을 캐시했다가 복원하는데, 이때
 * 우리가 붙인 host가 리스너 없이 되살아난다. 그런 host는 `isConnected`도 `true`이고 dataset도
 * 그대로여서 속성만으로는 구분할 수 없다. 실제로 만든 노드만 여기에 담아 구분한다.
 */
const liveHosts = new WeakSet<Element>();

function normalizeTitle(text: string | null | undefined): string | null {
  const normalized = text?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function readTitle(element: Element): string | null {
  const clone = element.cloneNode(true) as Element;
  clone.querySelector(`[${FEATURE_ROOT_ATTRIBUTE}="${PULL_REQUEST_TITLE_COPY_ROOT}"]`)?.remove();
  return normalizeTitle(clone.textContent);
}

function collectListTargets(document: Document): CopyTarget[] {
  const targets: CopyTarget[] = [];

  for (const row of document.querySelectorAll(PULL_REQUEST_ROW)) {
    const titleLink = row.querySelector<HTMLAnchorElement>(PULL_REQUEST_ROW_TITLE_LINK);
    if (!titleLink) continue;

    const pullRequestUrl = buildPullRequestUrl(titleLink.getAttribute('href'));
    const title = readTitle(titleLink);
    if (!pullRequestUrl || !title) continue;

    targets.push({ anchor: titleLink, pullRequestUrl, title });
  }

  return targets;
}

function collectDetailTargets(context: PageContext, pullRequestUrl: string): CopyTarget[] {
  const titleElement = context.document.querySelector(PULL_REQUEST_DETAIL_TITLE);
  if (!titleElement) return [];

  const title = readTitle(titleElement);
  if (!title) return [];

  return [{ anchor: titleElement, pullRequestUrl, title }];
}

function resolveCopyTargets(context: PageContext): CopyTarget[] {
  const route = parseGithubEnterpriseRoute(context.url.href);
  if (!route) return [];

  if (route.kind === 'detail') {
    const pullRequestUrl = buildPullRequestUrl(context.url.href);
    return pullRequestUrl ? collectDetailTargets(context, pullRequestUrl) : [];
  }

  return collectListTargets(context.document);
}

const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const FAIL_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

/** 제목만 복사용 아이콘. 링크가 아니라 글자를 가져간다는 뜻으로 텍스트 기호를 쓴다. */
const TEXT_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>';

function createCopyHost(context: PageContext, target: CopyTarget): HTMLSpanElement | null {
  const content = buildPullRequestClipboardContent(target.pullRequestUrl, target.title);
  if (!content) return null;

  const host = context.document.createElement('span');
  host.setAttribute(FEATURE_ROOT_ATTRIBUTE, PULL_REQUEST_TITLE_COPY_ROOT);
  host.dataset.pullRequestUrl = target.pullRequestUrl;
  host.style.all = 'initial';
  host.style.display = 'inline-flex';
  host.style.verticalAlign = 'middle';
  host.style.marginInlineStart = '4px';

  const shadow = host.attachShadow({ mode: 'open' });
  // GitHub의 Primer 커스텀 속성은 shadow 경계를 그대로 넘어오므로 테마를 따라간다.
  // 변수가 없는 환경을 위해 리터럴 fallback을 함께 둔다.
  shadow.innerHTML = `
    <style>
      :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button {
        box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; padding: 0;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent; color: var(--fgColor-muted, #59636e);
        cursor: pointer; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }
      button:hover {
        background: var(--bgColor-muted, #f6f8fa);
        border-color: var(--borderColor-default, #d1d9e0);
        color: var(--fgColor-default, #1f2328);
      }
      button:focus-visible { outline: 2px solid var(--focus-outlineColor, #0969da); outline-offset: 1px; }
      button:disabled { cursor: default; }
      button.copied { color: var(--fgColor-success, #1a7f37); }
      button.failed { color: var(--fgColor-danger, #d1242f); }
    </style>
    <button type="button" data-copy-mode="link" aria-label="PR 제목 Markdown 링크 복사" title="PR 제목 Markdown 링크 복사">${COPY_ICON}</button>
    <button type="button" data-copy-mode="title" aria-label="PR 제목만 복사" title="PR 제목만 복사">${TEXT_ICON}</button>
  `;

  const linkButton = shadow.querySelector<HTMLButtonElement>('[data-copy-mode="link"]');
  const titleButton = shadow.querySelector<HTMLButtonElement>('[data-copy-mode="title"]');
  if (!linkButton || !titleButton) return null;

  /**
   * 복사 동작과 피드백을 붙인다.
   *
   * 두 버튼이 각자 타이머를 가지므로 한쪽 피드백이 다른 쪽을 되돌리지 않는다.
   */
  function attachCopyBehavior(
    button: HTMLButtonElement,
    idleIcon: string,
    copy: () => Promise<void>,
  ): void {
    let resetTimer: number | null = null;
    button.addEventListener('click', async (event) => {
      // 목록의 제목 링크 안에 붙으므로 행 이동을 막아야 한다.
      event.preventDefault();
      event.stopPropagation();

      if (resetTimer !== null) window.clearTimeout(resetTimer);
      button.disabled = true;
      try {
        await copy();
        button.innerHTML = CHECK_ICON;
        button.classList.remove('failed');
        button.classList.add('copied');
      } catch {
        button.innerHTML = FAIL_ICON;
        button.classList.remove('copied');
        button.classList.add('failed');
      }

      resetTimer = window.setTimeout(() => {
        resetTimer = null;
        if (!host.isConnected) return;
        button.innerHTML = idleIcon;
        button.classList.remove('copied', 'failed');
        button.disabled = false;
      }, COPY_FEEDBACK_MS);
    });
  }

  attachCopyBehavior(linkButton, COPY_ICON, () => writePullRequestClipboardContent(content));
  attachCopyBehavior(titleButton, TEXT_ICON, async () => {
    const titleText = buildPullRequestTitleText(target.title);
    if (!titleText) throw new Error('복사할 PR 제목이 없습니다.');
    await writePlainText(titleText);
  });

  liveHosts.add(host);
  target.anchor.insertAdjacentElement('afterend', host);
  return host;
}

function findExistingHost(anchor: Element): Element | null {
  const next = anchor.nextElementSibling;
  return next?.getAttribute(FEATURE_ROOT_ATTRIBUTE) === PULL_REQUEST_TITLE_COPY_ROOT ? next : null;
}

export function createPullRequestTitleCopyRuntime(): FeatureRuntime {
  function removeAllHosts(document: Document): void {
    for (const host of document.querySelectorAll(
      `[${FEATURE_ROOT_ATTRIBUTE}="${PULL_REQUEST_TITLE_COPY_ROOT}"]`,
    )) {
      host.remove();
    }
  }

  return {
    id: 'pullRequestTitleCopy',

    reconcile(context: PageContext): void {
      const targets = resolveCopyTargets(context);
      if (targets.length === 0) {
        removeAllHosts(context.document);
        return;
      }

      const expected = new Set<Element>();

      for (const target of targets) {
        const existing = findExistingHost(target.anchor);
        if (existing) {
          // Turbo가 복원한 host는 리스너가 없으므로 버리고 다시 만든다.
          const isReusable = liveHosts.has(existing)
            && (existing as HTMLElement).dataset.pullRequestUrl === target.pullRequestUrl;
          if (isReusable) {
            expected.add(existing);
            continue;
          }
          existing.remove();
        }

        const host = createCopyHost(context, target);
        if (host) expected.add(host);
      }

      // 대상이 사라졌거나 다른 위치로 옮겨간 host를 정리한다.
      for (const host of context.document.querySelectorAll(
        `[${FEATURE_ROOT_ATTRIBUTE}="${PULL_REQUEST_TITLE_COPY_ROOT}"]`,
      )) {
        if (!expected.has(host)) host.remove();
      }
    },

    dispose(): void {
      removeAllHosts(document);
    },
  };
}
