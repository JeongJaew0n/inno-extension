/**
 * 보드 상단에 활성 스프린트의 기간과 목표를 보여준다.
 *
 * 보드 화면 어디에도 스프린트 기간·목표가 표시되지 않는다. `스프린트 세부 정보` 아이콘을 눌러야
 * 팝업으로 나온다.
 *
 * ## 언제 읽나
 *
 * | 때 | 무엇을 | 네트워크 |
 * | --- | --- | --- |
 * | 보드를 열 때 | 페이지가 이미 들고 있는 상태(`SPA_STATE` · Relay)를 브리지로 읽는다. 날짜가 있으면 바로 보여준다 | 없음 |
 * | 칩을 누를 때 | 활성 스프린트(Agile REST)와 Jira 가 센 남은 작업일을 읽는다 | GET 2번 |
 *
 * 예전 보드는 `SPA_STATE` 에 날짜가 있어 처음부터 채워진다. 새 보드(2026-11)는 사용자가 Jira 의
 * `스프린트 세부 정보` 를 열기 전까지 페이지에 날짜가 없다. 그래서 `스프린트 정보` 칩으로 시작하고
 * 누르면 채운다. **화면을 연 것만으로는 요청하지 않는다**(2026-11-03 사용자 결정).
 *
 * docs/plans/jira-board-sprint-info/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { CHIP_CSS } from '../../../../platform/design/parts';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { fetchActiveSprint, fetchSprintRemainingDays, JiraApiError } from '../../api/sprints';
import { BOARD_TOOL_ORDER, ensureBoardToolSlot, releaseBoardToolSlot } from '../../boardToolRow';
import { isJiraBoardRoute, parseJiraBoardUrl } from '../../routes';
import { BOARD_SPRINT_INFO_ROOT } from '../../selectors';
import { requestBoardSprintState } from '../../sprintState/client';
import { describeSprintChip, summarizeSprint, type SprintChipState } from './format';

const SLOT_NAME = 'sprint-info';

export function createBoardSprintInfoRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let activeDocument: Document | null = null;
  let boardId = '';
  let chip: SprintChipState = { kind: 'idle' };
  /**
   * 이 보드가 스프린트를 쓰는가. `undefined` 는 아직 안 읽었고 `null` 은 읽었지만 모른다.
   * Kanban 보드(`false`)에는 칩을 만들지 않는다 — 보여줄 스프린트가 없다.
   */
  let sprintSupport: boolean | null | undefined;
  let checkingSprintSupport = false;
  /** 보드를 떠난 뒤 늦게 온 응답을 버린다 */
  let seq = 0;

  /** 그린 것을 치운다. 보드에 대해 읽은 상태는 남긴다 */
  function unmount(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    host?.remove();
    host = null;
    if (activeDocument) releaseBoardToolSlot(activeDocument, SLOT_NAME);
  }

  function dispose(): void {
    unmount();
    activeDocument = null;
    boardId = '';
    chip = { kind: 'idle' };
    sprintSupport = undefined;
    checkingSprintSupport = false;
    seq += 1;
  }

  /**
   * 들어가는 것 중 가장 자세한 것을 고른다.
   *
   * 보드 상단은 자리가 좁다. 넘치면 **잘라내는 대신 덜 중요한 것부터 뺀다.** 전체 내용은 hover 에
   * 항상 남아 있으므로 잃는 정보는 없다.
   */
  function applyBestLabel(current: HTMLElement, labels: string[]): void {
    const text = current.shadowRoot?.querySelector<HTMLElement>('[data-sprint-text]');
    const button = current.shadowRoot?.querySelector<HTMLElement>('.inno-chip');
    if (!text || !button) return;

    for (const candidate of labels) {
      text.textContent = candidate;
      button.classList.toggle('inno-chip--icon-only', candidate === '');
      // 마지막 후보(아이콘만)까지 왔으면 더 줄일 것이 없다.
      if (candidate === '' || text.scrollWidth <= text.clientWidth) return;
    }
  }

  /** 지금 상태를 칩에 그린다 */
  function render(): void {
    const current = host;
    const button = current?.shadowRoot?.querySelector<HTMLButtonElement>('[data-sprint-chip]');
    if (!current || !button) return;

    const view = describeSprintChip(chip);
    button.title = view.title;
    button.disabled = view.busy;
    button.setAttribute('aria-busy', String(view.busy));
    // 아이콘만 남아도 읽을 수 있게 가장 자세한 문구를 이름으로 둔다.
    button.setAttribute('aria-label', view.labels[0] || '스프린트 정보');
    applyBestLabel(current, view.labels);

    // 창 크기나 필터 개수가 바뀌면 다시 고른다.
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => applyBestLabel(current, view.labels));
    resizeObserver.observe(current);
  }

  /** 칩을 눌렀을 때만 부른다. **보드를 여는 것만으로 요청하지 않는다.** */
  async function load(): Promise<void> {
    if (chip.kind === 'loading' || !boardId) return;
    const mySeq = seq;
    const id = boardId;
    chip = { kind: 'loading' };
    render();

    let next: SprintChipState;
    try {
      const sprint = await fetchActiveSprint(id);
      if (!sprint) {
        next = { kind: 'empty' };
      } else {
        // 남은 일수는 따로 읽는다. 못 읽어도 기간·목표는 보여준다.
        const daysRemaining = await fetchSprintRemainingDays(id, sprint.id).catch((error: unknown) => {
          console.warn('[Inno Extension] 스프린트 남은 일수를 읽지 못했습니다.', error);
          return null;
        });
        const summary = summarizeSprint({
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal,
          isoStartDate: sprint.startDate,
          isoEndDate: sprint.endDate,
          daysRemaining,
        });
        // 날짜를 못 읽으면 절반만 맞는 정보를 띄우지 않는다.
        next = summary ? { kind: 'shown', summary } : { kind: 'error', message: '스프린트 기간을 읽지 못했습니다.' };
      }
    } catch (error) {
      console.error('[Inno Extension] 활성 스프린트 조회 실패', error);
      next = {
        kind: 'error',
        message: error instanceof JiraApiError ? error.message : '활성 스프린트를 읽지 못했습니다.',
      };
    }

    if (mySeq !== seq || id !== boardId) return;
    chip = next;
    render();
  }

  function createHost(context: PageContext, anchor: HTMLElement): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, BOARD_SPRINT_INFO_ROOT);
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    // flex 항목이 줄어들려면 min-width 를 0 으로 풀어야 한다. 안 그러면 내용 폭 그대로
    // 버티다가 **바깥에서 잘린다.** 말줄임도 자기가 넉넉하다고 믿어 작동하지 않는다.
    nextHost.style.minWidth = '0';
    nextHost.style.flex = '0 1 auto';
    nextHost.style.overflow = 'hidden';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${DESIGN_TOKENS}${CHIP_CSS}</style>
      <button type="button" class="inno-chip inno-chip--action" data-sprint-chip>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <path d="M16 2v4M8 2v4M3 10h18"></path>
        </svg>
        <span class="inno-chip__text" data-sprint-text></span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('[data-sprint-chip]');
    if (!button) return null;
    button.addEventListener('click', () => void load());

    anchor.append(nextHost);
    return nextHost;
  }

  /** 칩을 자리에 둔다. 이미 제자리면 아무것도 바꾸지 않는다 */
  function mount(context: PageContext): void {
    const anchor = ensureBoardToolSlot(context.document, SLOT_NAME, BOARD_TOOL_ORDER.sprintInfo);
    if (!anchor) {
      unmount();
      return;
    }
    if (host?.isConnected && host.parentElement === anchor) return;

    host?.remove();
    host = createHost(context, anchor);
    render();
  }

  /**
   * 보드가 스프린트를 쓰는지, 페이지가 날짜를 이미 들고 있는지 브리지로 읽는다. **요청은 보내지 않는다.**
   *
   * 답이 오기 전에는 자리를 만들지 않는다. 만들었다 지우면 그 DOM 변화가 다시 reconcile 을 불러
   * 끝없이 돈다(재현 2026-10-02: 3초에 17번). 모르면(`null`) 칩을 두고 다음 reconcile 에서 다시
   * 읽는다 — 새 보드는 Relay 저장소가 늦게 채워질 수 있다.
   */
  function checkSprintSupport(context: PageContext): void {
    if (checkingSprintSupport) return;
    checkingSprintSupport = true;
    const mySeq = seq;
    const id = boardId;
    void requestBoardSprintState(context.document, id).then((state) => {
      if (mySeq !== seq || id !== boardId) return;
      checkingSprintSupport = false;
      sprintSupport = state.sprintsEnabled;
      if (sprintSupport === false) {
        unmount();
        return;
      }
      // 페이지가 이미 날짜를 들고 있으면(예전 보드, 새 보드에서 `스프린트 세부 정보` 를 연 뒤)
      // 요청 없이 바로 보여준다. 누른 뒤의 상태는 덮지 않는다.
      if (chip.kind === 'idle') {
        const summary = state.sprints.map(summarizeSprint).find((entry) => entry !== null);
        if (summary) {
          chip = { kind: 'shown', summary };
          render();
        }
      }
      mount(context);
    });
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

      // 보드가 바뀌면 **자리를 만들기 전에** 정리한다. 다른 보드의 칩·응답을 남기지 않는다.
      if (route.boardId !== boardId) {
        dispose();
        boardId = route.boardId;
      }

      activeDocument = context.document;
      // Kanban: 아무것도 만들지 않는다. DOM 을 건드리지 않아야 이 reconcile 이 다시 불리지 않는다.
      if (sprintSupport === false) return;
      if (sprintSupport !== true) checkSprintSupport(context);
      // 첫 답을 기다린다. 답이 오면 `checkSprintSupport` 가 직접 자리를 만든다.
      if (sprintSupport === undefined) return;
      mount(context);
    },

    dispose,
  };
}
