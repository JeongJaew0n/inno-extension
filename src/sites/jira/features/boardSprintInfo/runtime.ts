/**
 * 보드 상단에 활성 스프린트의 기간과 목표를 보여준다.
 *
 * 보드 화면 어디에도 스프린트 기간·목표가 표시되지 않는다. `스프린트 세부 정보` 아이콘을 눌러야
 * 팝업으로 나온다.
 *
 * **값은 페이지가 이미 들고 있다.** `window.SPA_STATE` 에서 읽는다 — 네트워크 요청은 하지 않는다.
 * 다만 그건 MAIN world 객체라 브리지를 거친다.
 *
 * docs/plans/jira-board-sprint-info/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { isJiraBoardRoute, parseJiraBoardUrl } from '../../routes';
import { BOARD_FILTER_CONTAINER, BOARD_SPRINT_INFO_ROOT } from '../../selectors';
import { requestActiveSprints } from '../../sprintState/client';
import { summarizeSprint } from './format';

export function createBoardSprintInfoRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  /** 지금 화면에 그려 둔 내용. 같은 값이면 다시 그리지 않는다 */
  let renderedKey = '';
  /** 진행 중인 요청의 보드. 같은 보드로 요청이 겹치지 않게 한다 */
  let pendingBoardId: string | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function dispose(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    host?.remove();
    host = null;
    renderedKey = '';
    pendingBoardId = null;
  }

  function ensureHost(context: PageContext, anchor: HTMLElement): HTMLSpanElement | null {
    if (host?.isConnected && host.parentElement === anchor) return host;

    host?.remove();
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, BOARD_SPRINT_INFO_ROOT);
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.marginInlineStart = '8px';
    // flex 항목이 줄어들려면 min-width 를 0 으로 풀어야 한다. 안 그러면 내용 폭 그대로
    // 버티다가 **바깥에서 잘린다.** 말줄임도 자기가 넉넉하다고 믿어 작동하지 않는다.
    nextHost.style.minWidth = '0';
    nextHost.style.flex = '0 1 auto';
    nextHost.style.overflow = 'hidden';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .chip {
          display: inline-flex; align-items: center; gap: 6px;
          box-sizing: border-box; max-width: 320px; min-width: 0; min-height: 24px;
          padding: 0 9px; border-radius: 3px; background: #091e420f; color: #44546f;
          font-size: 12px; line-height: 24px;
        }
        /* 글자가 하나도 안 들어가면 아이콘만 남기고 여백을 줄인다 */
        .chip.icon-only { padding: 0 6px; gap: 0; }
        svg { width: 14px; height: 14px; flex: 0 0 auto; }
        /* 목표가 길 수 있다. 넘치면 말줄임하고 전체는 hover 로 본다 */
        .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      </style>
      <span class="chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <path d="M16 2v4M8 2v4M3 10h18"></path>
        </svg>
        <span class="text" data-sprint-text></span>
      </span>
    `;

    anchor.append(nextHost);
    host = nextHost;
    return nextHost;
  }

  /**
   * 들어가는 것 중 가장 자세한 것을 고른다.
   *
   * 보드 상단은 자리가 좁다. 넘치면 **잘라내는 대신 덜 중요한 것부터 뺀다.** 전체 내용은 hover 에
   * 항상 남아 있으므로 잃는 정보는 없다.
   */
  function applyBestLabel(host: HTMLElement, labels: string[]): void {
    const text = host.shadowRoot?.querySelector<HTMLElement>('[data-sprint-text]');
    const chip = host.shadowRoot?.querySelector<HTMLElement>('.chip');
    if (!text || !chip) return;

    for (const candidate of labels) {
      text.textContent = candidate;
      chip.classList.toggle('icon-only', candidate === '');
      // 마지막 후보(아이콘만)까지 왔으면 더 줄일 것이 없다.
      if (candidate === '' || text.scrollWidth <= text.clientWidth) return;
    }
  }

  function render(
    context: PageContext,
    anchor: HTMLElement,
    labels: string[],
    title: string,
  ): void {
    const current = ensureHost(context, anchor);
    const chip = current?.shadowRoot?.querySelector<HTMLElement>('.chip');
    if (!current || !chip) return;
    chip.title = title;
    applyBestLabel(current, labels);

    // 창 크기나 필터 개수가 바뀌면 다시 고른다.
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => applyBestLabel(current, labels));
    resizeObserver.observe(current);
  }

  return {
    id: 'boardSprintInfo',

    reconcile(context: PageContext): void {
      const route = parseJiraBoardUrl(context.url.href);
      // 활성 스프린트 보드만 대상이다. 백로그·다른 화면에는 붙이지 않는다.
      if (!isJiraBoardRoute(route) || route.viewPath !== '') {
        dispose();
        return;
      }

      const anchor = context.document.querySelector<HTMLElement>(BOARD_FILTER_CONTAINER);
      if (!anchor) {
        dispose();
        return;
      }

      const boardId = route.boardId;
      // 이미 같은 보드 내용을 그려 뒀으면 자리만 확인하고 끝낸다.
      if (renderedKey.startsWith(`${boardId}:`) && host?.isConnected && host.parentElement === anchor) {
        return;
      }
      if (pendingBoardId === boardId) return;
      pendingBoardId = boardId;

      void requestActiveSprints(context.document, boardId).then((sprints) => {
        pendingBoardId = null;

        const summary = sprints.map(summarizeSprint).find((entry) => entry !== null);
        if (!summary) {
          // 읽지 못했으면 아무것도 보여주지 않는다. 틀린 기간을 띄우는 것보다 낫다.
          dispose();
          return;
        }

        const key = `${boardId}:${summary.label}`;
        const currentAnchor = context.document.querySelector<HTMLElement>(BOARD_FILTER_CONTAINER);
        if (!currentAnchor) return;
        if (key === renderedKey && host?.isConnected) return;

        render(context, currentAnchor, summary.labels, summary.title);
        renderedKey = key;
      });
    },

    dispose,
  };
}
