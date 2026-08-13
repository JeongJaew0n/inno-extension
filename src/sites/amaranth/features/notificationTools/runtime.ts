import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import {
  INTEGRATED_NOTIFICATION_POPUP,
  NOTIFICATION_ACTIVE_CATEGORY_ITEM,
  NOTIFICATION_BODY_TEXT,
  NOTIFICATION_CATEGORY_ITEM,
  NOTIFICATION_CODE_ROW_CLASS,
  NOTIFICATION_COPY_BUTTON_CLASS,
  NOTIFICATION_DAYLINE,
  NOTIFICATION_ITEM,
  NOTIFICATION_REFRESH_BUTTON_ID,
  NOTIFICATION_SOURCE,
  NOTIFICATION_TITLE,
  NOTIFICATION_TODAY,
} from '../../selectors';
import { findVerificationCodeInNotification } from './contracts';
import { ensureNotificationToolsStyles, removeNotificationToolsStyles } from './styles';

const ALL_CATEGORY_LABEL = '전체';
const MAIL_CATEGORY_LABEL = '메일';
const REFRESH_TIMEOUT_MS = 2500;
const FEEDBACK_DURATION_MS = 1400;

type RefreshState = 'idle' | 'refreshing' | 'success' | 'error';

function normalizedText(element: Element | null): string {
  return element?.textContent?.trim() ?? '';
}

function findPopup(document: Document): HTMLElement | null {
  return document.querySelector<HTMLElement>(INTEGRATED_NOTIFICATION_POPUP);
}

function findCategory(popup: HTMLElement, label: string): HTMLElement | null {
  return Array.from(popup.querySelectorAll<HTMLElement>(NOTIFICATION_CATEGORY_ITEM))
    .find((item) => normalizedText(item) === label) ?? null;
}

function isAllCategoryActive(popup: HTMLElement): boolean {
  return normalizedText(popup.querySelector(NOTIFICATION_ACTIVE_CATEGORY_ITEM)) === ALL_CATEGORY_LABEL;
}

function findTodayLine(popup: HTMLElement): HTMLElement | null {
  const today = popup.querySelector<HTMLElement>(NOTIFICATION_TODAY);
  const dayline = today?.closest<HTMLElement>(NOTIFICATION_DAYLINE) ?? null;
  return dayline && popup.contains(dayline) ? dayline : null;
}

function waitFor(
  document: Document,
  predicate: () => boolean,
  isCurrent: () => boolean,
): Promise<boolean> {
  const view = document.defaultView;
  if (!view) return Promise.resolve(false);

  return new Promise((resolve) => {
    const startedAt = Date.now();

    const check = (): void => {
      if (!isCurrent()) {
        resolve(false);
        return;
      }
      if (predicate()) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= REFRESH_TIMEOUT_MS) {
        resolve(false);
        return;
      }
      view.setTimeout(check, 50);
    };

    check();
  });
}

export function createNotificationToolsRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let refreshState: RefreshState = 'idle';
  let refreshSequence = 0;
  let feedbackTimer: number | null = null;

  function clearFeedbackTimer(): void {
    const view = activeDocument?.defaultView;
    if (view && feedbackTimer !== null) view.clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }

  function updateRefreshButton(button: HTMLButtonElement): void {
    const labels: Record<RefreshState, string> = {
      idle: '새로고침',
      refreshing: '갱신 중…',
      success: '갱신됨',
      error: '갱신 실패',
    };
    button.textContent = labels[refreshState];
    button.disabled = refreshState === 'refreshing';
    button.dataset.state = refreshState;
    button.setAttribute('aria-busy', String(refreshState === 'refreshing'));
    button.setAttribute('aria-label', labels[refreshState]);
  }

  function removeInjectedElements(document: Document): void {
    document.getElementById(NOTIFICATION_REFRESH_BUTTON_ID)?.remove();
    for (const button of document.querySelectorAll<HTMLButtonElement>(`.${NOTIFICATION_COPY_BUTTON_CLASS}`)) {
      const row = button.parentElement;
      button.remove();
      row?.classList.remove(NOTIFICATION_CODE_ROW_CLASS);
    }
  }

  function createCopyButton(document: Document, code: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = NOTIFICATION_COPY_BUTTON_CLASS;
    button.textContent = '복사';
    button.dataset.verificationCode = code;
    button.dataset.state = 'idle';
    button.setAttribute(FEATURE_ROOT_ATTRIBUTE, 'amaranth-notification-tools');
    button.setAttribute('aria-label', `인증번호 ${code} 복사`);
    button.title = `인증번호 ${code} 복사`;

    const stopPropagation = (event: Event): void => event.stopPropagation();
    button.addEventListener('pointerdown', stopPropagation);
    button.addEventListener('mousedown', stopPropagation);
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;

      try {
        await writePlainText(code);
        button.textContent = '복사됨';
        button.dataset.state = 'success';
      } catch (error) {
        console.error('[Inno Extension] 아마란스 인증번호 복사 실패', error);
        button.textContent = '실패';
        button.dataset.state = 'error';
      }

      document.defaultView?.setTimeout(() => {
        if (!button.isConnected) return;
        button.textContent = '복사';
        button.dataset.state = 'idle';
        button.disabled = false;
      }, FEEDBACK_DURATION_MS);
    });

    return button;
  }

  function ensureCopyButtons(document: Document, popup: HTMLElement): void {
    for (const item of popup.querySelectorAll<HTMLElement>(NOTIFICATION_ITEM)) {
      const existingButton = item.querySelector<HTMLButtonElement>(`.${NOTIFICATION_COPY_BUTTON_CLASS}`);
      const source = normalizedText(item.querySelector(NOTIFICATION_SOURCE));
      const title = item.querySelector<HTMLElement>(NOTIFICATION_TITLE);
      if (!title) continue;

      const body = Array.from(item.querySelectorAll<HTMLElement>(NOTIFICATION_BODY_TEXT))
        .map((element) => normalizedText(element))
        .join('\n');
      const match = findVerificationCodeInNotification({
        source,
        title: normalizedText(title),
        body,
      });

      const titleRow = title.parentElement;
      if (!titleRow) continue;
      if (!match) {
        existingButton?.remove();
        titleRow.classList.remove(NOTIFICATION_CODE_ROW_CLASS);
        continue;
      }
      if (existingButton?.dataset.verificationCode === match.code) continue;

      existingButton?.remove();
      titleRow.classList.add(NOTIFICATION_CODE_ROW_CLASS);
      title.after(createCopyButton(document, match.code));
    }
  }

  function render(document: Document): void {
    const popup = findPopup(document);
    if (!popup || !isAllCategoryActive(popup)) {
      removeInjectedElements(document);
      return;
    }

    ensureNotificationToolsStyles(document);
    const todayLine = findTodayLine(popup);
    if (todayLine) {
      let button = document.getElementById(NOTIFICATION_REFRESH_BUTTON_ID) as HTMLButtonElement | null;
      if (!button?.isConnected || button.parentElement !== todayLine) {
        button?.remove();
        button = document.createElement('button');
        button.id = NOTIFICATION_REFRESH_BUTTON_ID;
        button.type = 'button';
        button.setAttribute(FEATURE_ROOT_ATTRIBUTE, 'amaranth-notification-tools');
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          void refreshNotifications(document);
        });
        todayLine.appendChild(button);
      }
      updateRefreshButton(button);
    }

    ensureCopyButtons(document, popup);
  }

  function finishRefresh(document: Document, state: 'success' | 'error'): void {
    refreshState = state;
    render(document);
    clearFeedbackTimer();
    const view = document.defaultView;
    if (!view) return;
    feedbackTimer = view.setTimeout(() => {
      feedbackTimer = null;
      refreshState = 'idle';
      if (activeDocument === document) render(document);
    }, FEEDBACK_DURATION_MS);
  }

  async function refreshNotifications(document: Document): Promise<void> {
    if (refreshState === 'refreshing' || activeDocument !== document) return;

    const popup = findPopup(document);
    const mailTab = popup ? findCategory(popup, MAIL_CATEGORY_LABEL) : null;
    if (!popup || !isAllCategoryActive(popup) || !mailTab) {
      finishRefresh(document, 'error');
      return;
    }

    clearFeedbackTimer();
    refreshState = 'refreshing';
    const sequence = ++refreshSequence;
    const isCurrent = (): boolean => activeDocument === document && refreshSequence === sequence;
    render(document);

    mailTab.click();
    const switchedToMail = await waitFor(
      document,
      () => {
        const currentPopup = findPopup(document);
        return currentPopup !== null
          && normalizedText(currentPopup.querySelector(NOTIFICATION_ACTIVE_CATEGORY_ITEM)) === MAIL_CATEGORY_LABEL;
      },
      isCurrent,
    );
    if (!switchedToMail) {
      if (isCurrent()) finishRefresh(document, 'error');
      return;
    }

    const currentPopup = findPopup(document);
    const allTab = currentPopup ? findCategory(currentPopup, ALL_CATEGORY_LABEL) : null;
    if (!allTab) {
      if (isCurrent()) finishRefresh(document, 'error');
      return;
    }
    allTab.click();

    const restoredAll = await waitFor(
      document,
      () => {
        const restoredPopup = findPopup(document);
        return restoredPopup !== null
          && isAllCategoryActive(restoredPopup)
          && findTodayLine(restoredPopup) !== null;
      },
      isCurrent,
    );
    if (isCurrent()) finishRefresh(document, restoredAll ? 'success' : 'error');
  }

  function dispose(): void {
    refreshSequence += 1;
    clearFeedbackTimer();
    if (activeDocument) {
      removeInjectedElements(activeDocument);
      removeNotificationToolsStyles(activeDocument);
    }
    activeDocument = null;
    refreshState = 'idle';
  }

  return {
    id: 'notificationTools',

    reconcile(context: PageContext): void {
      activeDocument = context.document;
      render(context.document);
    },

    dispose,
  };
}
