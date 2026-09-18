import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS } from '../../../../platform/design/parts';
import {
  COMMIT_REFERENCE_LINK,
  COMMIT_SHA_ATTRIBUTE,
  COMMIT_SHA_COPY_ROOT,
  SYSTEM_NOTE,
} from '../../selectors';
import { normalizeCommitSha, parseMergeRequestOverviewUrl } from '../../routes';
import { writeCommitSha } from './clipboard';

export interface CommitCopyTarget {
  anchor: Element;
  sha: string;
}

const COPY_FEEDBACK_MS = 1500;

/**
 * 이 런타임이 직접 만들어 클릭 리스너가 살아 있는 host 집합.
 *
 * GitLab은 화면 전환과 활동 갱신에서 DOM을 다시 그린다. 복원된 노드는 `isConnected`와 속성이
 * 모두 정상이라 속성만으로는 리스너 유무를 구분할 수 없다. 실제로 만든 노드만 여기에 담는다.
 */
const liveHosts = new WeakSet<Element>();

/**
 * 개요 탭 커밋 목록의 복사 대상을 모은다.
 *
 * 커밋 참조 링크는 사용자 댓글에도 같은 클래스로 나타나므로 시스템 노트 안으로 한정한다.
 */
export function resolveCopyTargets(context: PageContext): CommitCopyTarget[] {
  if (!parseMergeRequestOverviewUrl(context.url.href)) return [];

  const targets: CommitCopyTarget[] = [];

  for (const note of context.document.querySelectorAll(SYSTEM_NOTE)) {
    for (const anchor of note.querySelectorAll(COMMIT_REFERENCE_LINK)) {
      const sha = normalizeCommitSha(anchor.getAttribute(COMMIT_SHA_ATTRIBUTE));
      if (!sha) continue;
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
  // 예전에는 GitLab의 `--gl-*` 변수를 읽어 사이트 테마를 따라갔다. 이제 우리 토큰만 쓴다.
  // 사이트마다 다른 색을 쓰면 우리 기능끼리 안 맞는 쪽이 더 큰 문제였다.
  shadow.innerHTML = `
    <style>${DESIGN_TOKENS}${BUTTON_CSS}</style>
    <button type="button" class="inno-btn inno-btn--icon"
            aria-label="커밋 번호 복사" title="커밋 번호 복사">${COPY_ICON}</button>
  `;

  const button = shadow.querySelector('button');
  if (!button) return null;

  let resetTimer: number | null = null;
  button.addEventListener('click', async (event) => {
    // 커밋 링크 안쪽 흐름에 놓이므로 링크 이동을 막아야 한다.
    event.preventDefault();
    event.stopPropagation();

    if (resetTimer !== null) window.clearTimeout(resetTimer);
    button.disabled = true;
    try {
      await writeCommitSha(target.sha);
      button.innerHTML = CHECK_ICON;
      button.classList.remove('inno-btn--fail');
      button.classList.add('inno-btn--ok');
    } catch {
      button.innerHTML = FAIL_ICON;
      button.classList.remove('inno-btn--ok');
      button.classList.add('inno-btn--fail');
    }

    resetTimer = window.setTimeout(() => {
      resetTimer = null;
      if (!host.isConnected) return;
      button.innerHTML = COPY_ICON;
      button.classList.remove('inno-btn--ok', 'inno-btn--fail');
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
    id: 'commitShaCopy',

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

      // 대상이 사라졌거나 댓글처럼 범위 밖으로 옮겨간 host를 정리한다.
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
