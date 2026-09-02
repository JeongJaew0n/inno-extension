import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  MERGE_REQUEST_DETAIL_TITLE,
  MERGE_REQUEST_ROW,
  MERGE_REQUEST_ROW_TITLE_LINK,
  MERGE_REQUEST_TITLE_COPY_ROOT,
} from '../../selectors';
import { buildMergeRequestUrl, parseMergeRequestTitleRoute } from '../../routes';
import {
  buildMergeRequestMarkdown,
  buildMergeRequestTitleText,
  writeCopyText,
} from './clipboard';

export interface TitleCopyTarget {
  anchor: Element;
  mergeRequestUrl: string;
  title: string;
}

const COPY_FEEDBACK_MS = 1500;

/**
 * 이 런타임이 직접 만들어 클릭 리스너가 살아 있는 host 집합.
 *
 * GitLab은 화면 전환과 목록 갱신에서 DOM을 다시 그린다. 복원된 노드는 `isConnected`와
 * 속성이 모두 정상이라 속성만으로는 리스너 유무를 구분할 수 없다.
 */
const liveHosts = new WeakSet<Element>();

function normalizeText(text: string | null | undefined): string | null {
  const normalized = text?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

/**
 * 제목 텍스트를 읽는다.
 *
 * 주입한 host가 제목 요소 안에 들어가는 경우를 대비해 복제본에서 제거한 뒤 읽는다.
 */
function readTitle(element: Element): string | null {
  const clone = element.cloneNode(true) as Element;
  clone.querySelector(`[${FEATURE_ROOT_ATTRIBUTE}="${MERGE_REQUEST_TITLE_COPY_ROOT}"]`)?.remove();
  return normalizeText(clone.textContent);
}

export function resolveTitleCopyTargets(context: PageContext): TitleCopyTarget[] {
  const route = parseMergeRequestTitleRoute(context.url.href);
  if (!route) return [];

  if (route.kind === 'detail') {
    const titleElement = context.document.querySelector(MERGE_REQUEST_DETAIL_TITLE);
    if (!titleElement) return [];

    const title = readTitle(titleElement);
    const mergeRequestUrl = buildMergeRequestUrl(context.url.href);
    if (!title || !mergeRequestUrl) return [];

    return [{ anchor: titleElement, mergeRequestUrl, title }];
  }

  const targets: TitleCopyTarget[] = [];
  for (const row of context.document.querySelectorAll(MERGE_REQUEST_ROW)) {
    const link = row.querySelector(MERGE_REQUEST_ROW_TITLE_LINK);
    if (!link) continue;

    const mergeRequestUrl = buildMergeRequestUrl(link.getAttribute('href'));
    const title = readTitle(link);
    if (!mergeRequestUrl || !title) continue;

    targets.push({ anchor: link, mergeRequestUrl, title });
  }
  return targets;
}

const LINK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
/** 제목만 복사용 아이콘. 링크가 아니라 글자를 가져간다는 뜻으로 텍스트 기호를 쓴다. */
const TEXT_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const FAIL_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

function createCopyHost(context: PageContext, target: TitleCopyTarget): HTMLSpanElement | null {
  const markdown = buildMergeRequestMarkdown(target.mergeRequestUrl, target.title);
  const titleText = buildMergeRequestTitleText(target.title);
  if (!markdown || !titleText) return null;

  const host = context.document.createElement('span');
  host.setAttribute(FEATURE_ROOT_ATTRIBUTE, MERGE_REQUEST_TITLE_COPY_ROOT);
  host.dataset.mergeRequestUrl = target.mergeRequestUrl;
  host.style.all = 'initial';
  host.style.display = 'inline-flex';
  host.style.verticalAlign = 'middle';
  host.style.marginInlineStart = '4px';

  const shadow = host.attachShadow({ mode: 'open' });
  // GitLab의 CSS 커스텀 속성은 shadow 경계를 그대로 넘어오므로 테마를 따라간다.
  shadow.innerHTML = `
    <style>
      :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button {
        box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; padding: 0;
        border: 1px solid transparent; border-radius: 4px;
        background: transparent; color: var(--gl-text-color-subtle, #737278);
        cursor: pointer; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }
      button:hover {
        background: var(--gl-background-color-subtle, #ececef);
        border-color: var(--gl-border-color-default, #dcdcde);
        color: var(--gl-text-color-default, #333238);
      }
      button:focus-visible { outline: 2px solid var(--gl-focus-ring-color, #1f75cb); outline-offset: 1px; }
      button:disabled { cursor: default; }
      button.copied { color: var(--gl-text-color-success, #108548); }
      button.failed { color: var(--gl-text-color-danger, #dd2b0e); }
    </style>
    <button type="button" data-copy-mode="link" aria-label="MR 제목 Markdown 링크 복사" title="MR 제목 Markdown 링크 복사">${LINK_ICON}</button>
    <button type="button" data-copy-mode="title" aria-label="MR 제목만 복사" title="MR 제목만 복사">${TEXT_ICON}</button>
  `;

  const linkButton = shadow.querySelector<HTMLButtonElement>('[data-copy-mode="link"]');
  const titleButton = shadow.querySelector<HTMLButtonElement>('[data-copy-mode="title"]');
  if (!linkButton || !titleButton) return null;

  /** 두 버튼이 각자 타이머를 가져 한쪽 피드백이 다른 쪽을 되돌리지 않는다. */
  function attachCopyBehavior(
    button: HTMLButtonElement,
    idleIcon: string,
    text: string,
  ): void {
    let resetTimer: number | null = null;
    button.addEventListener('click', async (event) => {
      // 목록에서는 제목 링크 안쪽이므로 MR 이동을 막아야 한다.
      event.preventDefault();
      event.stopPropagation();

      if (resetTimer !== null) window.clearTimeout(resetTimer);
      button.disabled = true;
      try {
        await writeCopyText(text);
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

  attachCopyBehavior(linkButton, LINK_ICON, markdown);
  attachCopyBehavior(titleButton, TEXT_ICON, titleText);

  liveHosts.add(host);
  target.anchor.insertAdjacentElement('afterend', host);
  return host;
}

function findExistingHost(anchor: Element): Element | null {
  const next = anchor.nextElementSibling;
  return next?.getAttribute(FEATURE_ROOT_ATTRIBUTE) === MERGE_REQUEST_TITLE_COPY_ROOT ? next : null;
}

export function createMergeRequestTitleCopyRuntime(): FeatureRuntime {
  function removeAllHosts(document: Document): void {
    for (const host of document.querySelectorAll(
      `[${FEATURE_ROOT_ATTRIBUTE}="${MERGE_REQUEST_TITLE_COPY_ROOT}"]`,
    )) {
      host.remove();
    }
  }

  return {
    id: 'mergeRequestTitleCopy',

    reconcile(context: PageContext): void {
      const targets = resolveTitleCopyTargets(context);
      if (targets.length === 0) {
        removeAllHosts(context.document);
        return;
      }

      const expected = new Set<Element>();

      for (const target of targets) {
        const existing = findExistingHost(target.anchor);
        if (existing) {
          const isReusable = liveHosts.has(existing)
            && (existing as HTMLElement).dataset.mergeRequestUrl === target.mergeRequestUrl;
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
        `[${FEATURE_ROOT_ATTRIBUTE}="${MERGE_REQUEST_TITLE_COPY_ROOT}"]`,
      )) {
        if (!expected.has(host)) host.remove();
      }
    },

    dispose(): void {
      removeAllHosts(document);
    },
  };
}
