/**
 * 업무 생성 모달 상단의 날짜 단축 버튼.
 *
 * `오늘부터 시작` 하나를 누르면 `시작 날짜`를 오늘로, `기한`을 오늘+3일로 넣는다.
 *
 * ## 왜 이렇게 번거로운가
 *
 * 그 두 필드는 **타이핑으로 값이 들어가지 않는다.** 7가지 형식을 다 넣어봤고 전부
 * `No options` 였다. 그 입력창은 값을 받는 곳이 아니라 달력 검색창이다.
 *
 * 그래서 달력을 열고, 목표 달까지 옮기고, 날짜 셀을 클릭한다.
 *
 * docs/plans/jira-create-helpers/context.md
 */

import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS } from '../../../../platform/design/parts';
import { CREATE_MODAL_SUMMARY_FIELD, CREATE_QUICK_DATES_ROOT } from '../../selectors';
import { expandAllFields, findCreateModal, findFieldByLabel, waitFor } from '../../createModal';
import {
  calendarCellPattern,
  isSameMonth,
  monthDistance,
  parseVisibleMonth,
  planFromToday,
  type CalendarDate,
} from './contracts';

const START_DATE_LABEL = '시작 날짜';
const DUE_DATE_LABEL = '기한';
const FEEDBACK_MS = 1600;

/** 달력을 옮기는 횟수 상한. 무한 반복을 막는다 */
const MAX_MONTH_STEPS = 24;

function findButtonByLabelPattern(root: HTMLElement, pattern: RegExp): HTMLElement | null {
  for (const candidate of root.querySelectorAll<HTMLElement>('button,[role="button"]')) {
    const label = candidate.getAttribute('aria-label');
    if (label && pattern.test(label)) return candidate;
  }
  return null;
}

function findMonthStepButton(field: HTMLElement, direction: 'next' | 'previous'): HTMLElement | null {
  const needle = direction === 'next' ? 'Next month' : 'Previous month';
  return [...field.querySelectorAll<HTMLElement>('button,[role="button"]')]
    .find((button) => (button.textContent ?? '').startsWith(needle)) ?? null;
}

function readVisibleMonth(field: HTMLElement): CalendarDate | null {
  const next = findMonthStepButton(field, 'next');
  return next ? parseVisibleMonth(next.textContent ?? '') : null;
}

/**
 * 한 필드에 날짜 하나를 넣는다.
 *
 * @returns 값이 들어갔으면 `true`
 */
async function setDate(modal: HTMLElement, label: string, target: CalendarDate): Promise<boolean> {
  const field = findFieldByLabel(modal, label);
  if (!field) return false;

  // 트리거를 눌러야 달력이 생긴다. 필드 자체는 아직 버튼일 뿐이다.
  const trigger = field.querySelector<HTMLElement>('[role="button"]');
  if (!trigger) return false;
  trigger.click();

  const opened = await waitFor(() => (findMonthStepButton(field, 'next') ? field : null));
  if (!opened) return false;

  // 목표 달까지 옮긴다. 보이는 달을 못 읽으면 옮기지 않고 바로 셀을 찾아본다 —
  // 이미 맞는 달일 수 있다.
  const visible = readVisibleMonth(field);
  if (visible && !isSameMonth(visible, target)) {
    const steps = monthDistance(visible, target);
    const direction = steps > 0 ? 'next' : 'previous';
    for (let moved = 0; moved < Math.min(Math.abs(steps), MAX_MONTH_STEPS); moved += 1) {
      const step = findMonthStepButton(field, direction);
      if (!step) break;
      step.click();
      // 격자가 다시 그려질 틈을 준다.
      await waitFor(() => {
        const now = readVisibleMonth(field);
        return now && monthDistance(now, target) !== steps ? now : null;
      }, 800);
    }
  }

  const cell = await waitFor(() => findButtonByLabelPattern(field, calendarCellPattern(target)), 1500);
  if (!cell) return false;
  cell.click();
  return true;
}

export function createQuickDatesRuntime(): FeatureRuntime {
  let host: HTMLElement | null = null;
  let running = false;
  let feedbackTimer: number | null = null;

  function dispose(): void {
    if (feedbackTimer !== null) window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
    host?.remove();
    host = null;
  }

  async function run(modal: HTMLElement, button: HTMLButtonElement, label: HTMLElement): Promise<void> {
    if (running) return;
    running = true;
    button.disabled = true;
    const original = label.textContent ?? '';
    label.textContent = '넣는 중';

    try {
      const plan = planFromToday(new Date());
      const expanded = await expandAllFields(modal, DUE_DATE_LABEL);
      if (!expanded) throw new Error('추가 필드를 펼치지 못했습니다.');

      const startOk = await setDate(modal, START_DATE_LABEL, plan.start);
      const dueOk = await setDate(modal, DUE_DATE_LABEL, plan.due);
      if (!startOk || !dueOk) throw new Error('날짜를 넣지 못했습니다.');

      label.textContent = '넣었음';
    } catch (error) {
      console.error('[Inno Extension] 업무 생성 날짜 단축 실패', error);
      label.textContent = '실패';
    } finally {
      feedbackTimer = window.setTimeout(() => {
        feedbackTimer = null;
        if (!host?.isConnected) return;
        label.textContent = original;
        button.disabled = false;
      }, FEEDBACK_MS);
      running = false;
    }
  }

  /**
   * 버튼을 폼 본문 맨 위, 요약 입력 바로 앞에 넣는다.
   *
   * 처음에는 헤더의 `h1` 뒤에 붙였는데 breadcrumb(`NPT | 작업`)을 오른쪽으로 밀어냈다.
   * 헤더는 Jira 의 것이고 우리가 자리를 뺏을 곳이 아니다.
   */
  function createHost(document: Document, modal: HTMLElement): HTMLElement | null {
    const summary = modal.querySelector<HTMLElement>(CREATE_MODAL_SUMMARY_FIELD);
    if (!summary) return null;

    const next = document.createElement('div');
    next.setAttribute(FEATURE_ROOT_ATTRIBUTE, CREATE_QUICK_DATES_ROOT);
    next.style.all = 'initial';
    next.style.display = 'flex';
    // 이 줄은 스크롤 영역의 **첫 요소**다. 여백이 없으면 위쪽이 경계에 잘린다 —
    // 실측에서 버튼 top 104, 스크롤 영역 top 110 이라 6px 이 먹혔다.
    next.style.margin = '12px 0 8px';

    const shadow = next.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${DESIGN_TOKENS}${BUTTON_CSS}</style>
      <button type="button" class="inno-btn inno-btn--outlined" data-action="today"
              title="시작 날짜를 오늘로, 기한을 오늘+3일로 넣습니다">
        <span data-label>오늘부터 시작</span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('[data-action="today"]');
    const label = shadow.querySelector<HTMLElement>('[data-label]');
    if (!button || !label) return null;
    button.addEventListener('click', () => void run(modal, button, label));

    summary.insertAdjacentElement('beforebegin', next);
    return next;
  }

  return {
    id: 'createQuickDates',

    reconcile(context: PageContext): void {
      const modal = findCreateModal(context.document);
      if (!modal) {
        dispose();
        return;
      }
      // 모달이 다시 그려지면 우리 것도 떨어져 나간다. 붙어 있는지로 판단한다.
      if (host?.isConnected && modal.contains(host)) return;

      dispose();
      host = createHost(context.document, modal);
    },

    dispose,
  };
}
