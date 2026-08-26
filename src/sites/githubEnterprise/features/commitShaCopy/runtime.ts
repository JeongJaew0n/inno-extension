import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  COMMIT_SHA_COPY_ROOT,
  TIMELINE_COMMIT_LINK,
  TIMELINE_COMMIT_SHA_CELL,
  TIMELINE_ITEM,
} from '../../selectors';
import { extractCommitShaFromHref, parsePullRequestConversationUrl } from '../../routes';
import { writeCommitSha } from './clipboard';

export interface CommitCopyTarget {
  /** 버튼을 붙일 기준 요소. 커밋 번호를 감싼 `code`다. */
  anchor: Element;
  sha: string;
}

const COPY_FEEDBACK_MS = 1500;

/**
 * 이 런타임이 직접 만들어 클릭 리스너가 살아 있는 host 집합.
 *
 * GitHub Enterprise는 Turbo를 사용한다. 캐시된 DOM이 복원되면 host가 리스너 없이 되살아나고,
 * `isConnected`와 속성이 모두 정상이라 속성만으로는 구분할 수 없다.
 */
const liveHosts = new WeakSet<Element>();

/**
 * Conversation 탭 타임라인의 복사 대상을 모은다.
 *
 * Commits 탭에도 같은 형태의 커밋 링크가 있으나 그곳에는 GitHub 기본 `Copy full SHA` 버튼이
 * 이미 있다. route 판정과 `.TimelineItem` 스코프로 이중 배제한다.
 */
export function resolveCopyTargets(context: PageContext): CommitCopyTarget[] {
  if (!parsePullRequestConversationUrl(context.url.href)) return [];

  const targets: CommitCopyTarget[] = [];

  for (const item of context.document.querySelectorAll(TIMELINE_ITEM)) {
    for (const cell of item.querySelectorAll(TIMELINE_COMMIT_SHA_CELL)) {
      const link = cell.querySelector(TIMELINE_COMMIT_LINK);
      if (!link) continue;

      const sha = extractCommitShaFromHref(link.getAttribute('href'));
      if (!sha) continue;

      // 셀이 우측 정렬이라 `code` 뒤에 넣으면 커밋 번호가 왼쪽으로 밀리고
      // 버튼이 오른쪽 끝을 차지한다. 셀 오른쪽 여백이 0이라 다른 위치는 넘침을 만든다.
      const anchor = link.closest('code') ?? link;
      targets.push({ anchor, sha });
    }
  }

  return targets;
}

const COPY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const FAIL_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

function createCopyHost(context: PageContext, target: CommitCopyTarget): HTMLSpanElement | null {
  const host = context.document.createElement('span');
  host.setAttribute(FEATURE_ROOT_ATTRIBUTE, COMMIT_SHA_COPY_ROOT);
  host.dataset.commitSha = target.sha;
  host.style.all = 'initial';
  host.style.display = 'inline-flex';
  host.style.verticalAlign = 'middle';
  host.style.marginInlineStart = '4px';

  const shadow = host.attachShadow({ mode: 'open' });
  // Primer 커스텀 속성은 shadow 경계를 그대로 넘어오므로 테마를 따라간다.
  shadow.innerHTML = `
    <style>
      :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button {
        box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
        width: 20px; height: 20px; padding: 0;
        border: 1px solid transparent; border-radius: 4px;
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
    <button type="button" aria-label="커밋 번호 복사" title="커밋 번호 복사">${COPY_ICON}</button>
  `;

  const button = shadow.querySelector('button');
  if (!button) return null;

  let resetTimer: number | null = null;
  button.addEventListener('click', async (event) => {
    // 커밋 링크 바로 옆이므로 링크 이동을 막아야 한다.
    event.preventDefault();
    event.stopPropagation();

    if (resetTimer !== null) window.clearTimeout(resetTimer);
    button.disabled = true;
    try {
      await writeCommitSha(target.sha);
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
      button.innerHTML = COPY_ICON;
      button.classList.remove('copied', 'failed');
      button.disabled = false;
    }, COPY_FEEDBACK_MS);
  });

  liveHosts.add(host);
  target.anchor.insertAdjacentElement('afterend', host);
  return host;
}

function findExistingHost(anchor: Element): Element | null {
  const next = anchor.nextElementSibling;
  return next?.getAttribute(FEATURE_ROOT_ATTRIBUTE) === COMMIT_SHA_COPY_ROOT ? next : null;
}

export function createCommitShaCopyRuntime(): FeatureRuntime {
  function removeAllHosts(document: Document): void {
    for (const host of document.querySelectorAll(
      `[${FEATURE_ROOT_ATTRIBUTE}="${COMMIT_SHA_COPY_ROOT}"]`,
    )) {
      host.remove();
    }
  }

  return {
    id: 'githubCommitShaCopy',

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
          const isReusable = liveHosts.has(existing)
            && (existing as HTMLElement).dataset.commitSha === target.sha;
          if (isReusable) {
            expected.add(existing);
            continue;
          }
          existing.remove();
        }

        const host = createCopyHost(context, target);
        if (host) expected.add(host);
      }

      for (const host of context.document.querySelectorAll(
        `[${FEATURE_ROOT_ATTRIBUTE}="${COMMIT_SHA_COPY_ROOT}"]`,
      )) {
        if (!expected.has(host)) host.remove();
      }
    },

    dispose(): void {
      removeAllHosts(document);
    },
  };
}
