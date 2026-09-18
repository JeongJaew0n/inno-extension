/**
 * 활성 스프린트 보드에서 **종료된 스프린트**의 업무를 본다.
 *
 * 보드 카드를 갈아끼우지 않는다. **보드 위에 읽기 전용 패널을 덮는다.**
 *
 * 카드를 지워도 React 가 되살리지 않는 것을 실측으로 확인했지만, 그건 좋은 소식이 아니다.
 * React 는 자기 가상 DOM 이 맞다고 믿는 것만 고치므로 그때부터 둘이 어긋난 채 남는다. 그 상태에서
 * 드래그나 `스프린트 완료` 를 누르면 **보이는 것과 실제 대상이 달라진다.** 되돌릴 수 없는 동작이
 * 섞이는 것이 가장 위험하다.
 *
 * docs/plans/jira-past-sprint-view/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import {
  fetchBoardSprints,
  fetchSprintIssues,
  JiraApiError,
  type JiraBoardIssue,
  type JiraSprint,
} from '../../api/sprints';
import { isJiraBoardRoute, parseJiraBoardUrl } from '../../routes';
import {
  BOARD_CONTENT,
  BOARD_FILTER_CONTAINER,
  PAST_SPRINT_PANEL_ROOT,
  PAST_SPRINT_VIEW_ROOT,
} from '../../selectors';
import { closedSprintsNewestFirst, groupIssuesByStatus } from './columns';

const ACTIVE_VALUE = 'active';

function formatPeriod(sprint: JiraSprint): string {
  const format = (value: string | null): string => {
    if (!value) return '?';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '?';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  return `${format(sprint.startDate)} ~ ${format(sprint.endDate)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createPastSprintViewRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  let panel: HTMLDivElement | null = null;
  let boardId = '';
  /** 스프린트 목록은 셀렉트를 처음 열 때만 불러온다. 보드를 여는 것만으로 요청하지 않는다. */
  let sprints: JiraSprint[] | null = null;
  let loadingSprints = false;

  function closePanel(): void {
    panel?.remove();
    panel = null;
  }

  function dispose(): void {
    closePanel();
    host?.remove();
    host = null;
    sprints = null;
    loadingSprints = false;
  }

  function panelShadow(): ShadowRoot | null {
    return panel?.shadowRoot ?? null;
  }

  function ensurePanel(context: PageContext): ShadowRoot | null {
    const board = context.document.querySelector<HTMLElement>(BOARD_CONTENT);
    if (!board) return null;
    if (panel?.isConnected) return panelShadow();

    const next = context.document.createElement('div');
    next.setAttribute(FEATURE_ROOT_ATTRIBUTE, PAST_SPRINT_PANEL_ROOT);
    next.style.all = 'initial';
    next.style.position = 'absolute';
    next.style.inset = '0';
    next.style.zIndex = '20';

    const shadow = next.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .sheet {
          display: flex; flex-direction: column; height: 100%;
          box-sizing: border-box; background: #ffffff; border: 1px solid #dfe1e6;
          border-radius: 6px; box-shadow: 0 8px 24px #091e4229; overflow: hidden;
        }
        header {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-bottom: 1px solid #dfe1e6; background: #f7f8f9;
          color: #172b4d; font-size: 13px;
        }
        header strong { font-size: 14px; }
        .readonly {
          padding: 1px 7px; border-radius: 9px; background: #e9f2ff;
          color: #0055cc; font-size: 11px; font-weight: 700;
        }
        .period { color: #626f86; font-size: 12px; }
        .spacer { flex: 1; }
        .close {
          border: 0; border-radius: 3px; background: transparent; color: #44546f;
          cursor: pointer; font: inherit; font-size: 12px; padding: 4px 8px;
        }
        .close:hover { background: #091e420f; }
        .body { flex: 1; overflow: auto; padding: 12px; }
        .columns { display: flex; gap: 12px; align-items: flex-start; min-width: min-content; }
        .column {
          flex: 0 0 260px; border-radius: 6px; background: #f7f8f9; padding: 8px;
        }
        .column h3 {
          margin: 0 0 8px; color: #626f86; font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .column h3 span { color: #8590a2; font-weight: 400; }
        .card {
          display: block; margin-bottom: 8px; padding: 10px; border-radius: 4px;
          background: #ffffff; box-shadow: 0 1px 1px #091e4240; color: #172b4d;
          font-size: 13px; line-height: 18px; text-decoration: none;
        }
        .card:hover { background: #f1f2f4; }
        .card .parent { color: #626f86; font-size: 11px; }
        .card .meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: #626f86; font-size: 11px; }
        .card .meta img { width: 16px; height: 16px; border-radius: 50%; }
        .card .key { font-weight: 600; }
        .state { padding: 24px; color: #626f86; font-size: 13px; text-align: center; }
        .state.error { color: #ae2e24; }
      </style>
      <div class="sheet">
        <header>
          <strong data-panel-title></strong>
          <span class="period" data-panel-period></span>
          <span class="readonly">읽기 전용</span>
          <span class="spacer"></span>
          <button type="button" class="close" data-panel-close>닫기</button>
        </header>
        <div class="body"><div class="state">불러오는 중…</div></div>
      </div>
    `;

    shadow.querySelector('[data-panel-close]')?.addEventListener('click', () => {
      closePanel();
      const select = host?.shadowRoot?.querySelector<HTMLSelectElement>('select');
      if (select) select.value = ACTIVE_VALUE;
    });

    // 보드가 `position: static` 이면 절대 위치가 엉뚱한 곳을 기준으로 잡는다.
    if (getComputedStyle(board).position === 'static') board.style.position = 'relative';
    board.append(next);
    panel = next;
    return shadow;
  }

  function renderPanelState(shadow: ShadowRoot, html: string): void {
    const body = shadow.querySelector<HTMLElement>('.body');
    if (body) body.innerHTML = html;
  }

  function renderIssues(shadow: ShadowRoot, issues: JiraBoardIssue[]): void {
    if (issues.length === 0) {
      renderPanelState(shadow, '<div class="state">이 스프린트에는 업무가 없습니다.</div>');
      return;
    }

    const columns = groupIssuesByStatus(issues).map((column) => {
      const cards = column.issues.map((issue) => `
        <a class="card" href="/browse/${escapeHtml(issue.key)}" target="_blank" rel="noreferrer">
          ${issue.parentKey ? `<div class="parent">${escapeHtml(issue.parentSummary || issue.parentKey)}</div>` : ''}
          <div>${escapeHtml(issue.summary)}</div>
          <div class="meta">
            ${issue.issueTypeIconUrl ? `<img src="${escapeHtml(issue.issueTypeIconUrl)}" alt="${escapeHtml(issue.issueTypeName)}" />` : ''}
            <span class="key">${escapeHtml(issue.key)}</span>
            <span class="spacer"></span>
            ${issue.assigneeAvatarUrl ? `<img src="${escapeHtml(issue.assigneeAvatarUrl)}" alt="${escapeHtml(issue.assigneeName)}" title="${escapeHtml(issue.assigneeName)}" />` : ''}
          </div>
        </a>
      `).join('');
      return `
        <section class="column">
          <h3>${escapeHtml(column.name)} <span>${column.issues.length}</span></h3>
          ${cards}
        </section>
      `;
    }).join('');

    renderPanelState(shadow, `<div class="columns">${columns}</div>`);
  }

  async function showSprint(context: PageContext, sprint: JiraSprint): Promise<void> {
    const shadow = ensurePanel(context);
    if (!shadow) return;

    shadow.querySelector<HTMLElement>('[data-panel-title]')!.textContent = sprint.name || '지난 스프린트';
    shadow.querySelector<HTMLElement>('[data-panel-period]')!.textContent = formatPeriod(sprint);
    renderPanelState(shadow, '<div class="state">불러오는 중…</div>');

    try {
      const issues = await fetchSprintIssues(sprint.id);
      // 그 사이 사용자가 닫았거나 다른 것을 골랐을 수 있다.
      if (!panel?.isConnected) return;
      renderIssues(shadow, issues);
    } catch (error) {
      if (!panel?.isConnected) return;
      const message = error instanceof JiraApiError
        ? error.message
        : '업무를 불러오지 못했습니다.';
      console.error('[Inno Extension] 지난 스프린트 조회 실패', error);
      renderPanelState(shadow, `<div class="state error">${escapeHtml(message)}</div>`);
    }
  }

  function renderOptions(select: HTMLSelectElement, list: JiraSprint[]): void {
    const closed = closedSprintsNewestFirst(list);
    const current = select.value;
    select.innerHTML = [
      `<option value="${ACTIVE_VALUE}">활성 스프린트</option>`,
      ...closed.map((sprint) => (
        `<option value="${sprint.id}">${escapeHtml(sprint.name || `스프린트 ${sprint.id}`)}</option>`
      )),
    ].join('');
    select.value = current || ACTIVE_VALUE;
    if (closed.length === 0) {
      select.innerHTML += '<option disabled>종료된 스프린트가 없습니다</option>';
    }
  }

  /** 셀렉트를 처음 열 때만 목록을 불러온다. **보드를 여는 것만으로 요청하지 않는다.** */
  async function ensureSprints(select: HTMLSelectElement): Promise<void> {
    if (sprints || loadingSprints) return;
    loadingSprints = true;
    try {
      const list = await fetchBoardSprints(boardId);
      sprints = list;
      renderOptions(select, list);
    } catch (error) {
      console.error('[Inno Extension] 스프린트 목록 조회 실패', error);
      const message = error instanceof JiraApiError ? error.message : '스프린트 목록을 불러오지 못했습니다.';
      select.innerHTML = `<option value="${ACTIVE_VALUE}">활성 스프린트</option><option disabled>${escapeHtml(message)}</option>`;
    } finally {
      loadingSprints = false;
    }
  }

  function createHost(context: PageContext, anchor: HTMLElement): HTMLSpanElement | null {
    const next = context.document.createElement('span');
    next.setAttribute(FEATURE_ROOT_ATTRIBUTE, PAST_SPRINT_VIEW_ROOT);
    next.style.all = 'initial';
    next.style.display = 'inline-flex';
    next.style.alignItems = 'center';
    next.style.marginInlineStart = '8px';

    const shadow = next.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        select {
          box-sizing: border-box; min-height: 24px; max-width: 220px; padding: 0 6px;
          border: 1px solid #8590a2; border-radius: 3px; background: #ffffff;
          color: #172b4d; font: inherit; font-size: 12px; cursor: pointer;
        }
      </style>
      <select aria-label="스프린트 선택">
        <option value="${ACTIVE_VALUE}">활성 스프린트</option>
      </select>
    `;

    const select = shadow.querySelector<HTMLSelectElement>('select');
    if (!select) return null;

    // 목록을 여는 순간 불러온다. 이 기능에서 네트워크가 나가는 첫 지점이다.
    select.addEventListener('mousedown', () => { void ensureSprints(select); }, { once: false });
    select.addEventListener('focus', () => { void ensureSprints(select); });

    select.addEventListener('change', () => {
      if (select.value === ACTIVE_VALUE) {
        closePanel();
        return;
      }
      const sprint = sprints?.find((entry) => String(entry.id) === select.value);
      if (!sprint) return;
      void showSprint(context, sprint);
    });

    anchor.append(next);
    return next;
  }

  return {
    id: 'pastSprintView',

    reconcile(context: PageContext): void {
      const route = parseJiraBoardUrl(context.url.href);
      if (!isJiraBoardRoute(route) || route.viewPath !== '') {
        dispose();
        return;
      }

      const anchor = context.document.querySelector<HTMLElement>(BOARD_FILTER_CONTAINER);
      if (!anchor) {
        dispose();
        return;
      }

      if (route.boardId !== boardId) {
        dispose();
        boardId = route.boardId;
      }
      if (host?.isConnected && host.parentElement === anchor) return;

      host?.remove();
      host = createHost(context, anchor);
    },

    dispose,
  };
}
