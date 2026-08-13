import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import {
  ACTIVE_CLASS,
  ATTENDANCE_KIND,
  CHECKIN_LI,
  CHECKOUT_LI,
  INJECTED_ID,
  NOTI_DETAILS,
  type AttendanceKind,
} from '../../selectors';
import { formatCheckinGreeting } from './greeting';
import { ensureAttendanceStyles, removeAttendanceStyles } from './styles';

const GREETING_COPY_LABEL = '인사말 복사';
const GREETING_FEEDBACK_DURATION_MS = 1400;

interface InjectedButton {
  element: HTMLButtonElement;
  kind: AttendanceKind;
}

function originalSelector(kind: AttendanceKind): string {
  return kind === ATTENDANCE_KIND.checkin ? CHECKIN_LI : CHECKOUT_LI;
}

export function createAttendanceHeaderRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let injectedButtons: InjectedButton[] = [];

  function delegateClick(kind: AttendanceKind): boolean {
    const original = activeDocument?.querySelector<HTMLElement>(originalSelector(kind));
    if (!original) return false;
    original.click();
    return true;
  }

  function createButton(document: Document, label: string, kind: AttendanceKind): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inno-amaranth-attendance-button';
    button.textContent = label;
    button.dataset.innoAttendanceKind = kind;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!delegateClick(kind)) {
        button.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 200 },
        );
      }
    });
    return button;
  }

  function createGreetingCopyButton(document: Document): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inno-amaranth-attendance-greeting-copy';
    button.textContent = GREETING_COPY_LABEL;
    button.setAttribute('aria-label', '현재 시각으로 출근 인사말 복사');
    button.title = "현재 시각으로 'n시 n분 출근입니다.'를 복사합니다.";
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;

      try {
        await writePlainText(formatCheckinGreeting(new Date()));
        button.textContent = '복사됨';
        button.dataset.state = 'success';
      } catch (error) {
        console.error('[Inno Extension] 아마란스 출근 인사말 복사 실패', error);
        button.textContent = '실패';
        button.dataset.state = 'error';
      }

      document.defaultView?.setTimeout(() => {
        if (!button.isConnected) return;
        button.textContent = GREETING_COPY_LABEL;
        delete button.dataset.state;
        button.disabled = false;
      }, GREETING_FEEDBACK_DURATION_MS);
    });
    return button;
  }

  function buildContainer(document: Document): HTMLDivElement {
    const container = document.createElement('div');
    container.id = INJECTED_ID;
    container.setAttribute(FEATURE_ROOT_ATTRIBUTE, 'amaranth-attendance-header');

    const checkin = createButton(document, '출근', ATTENDANCE_KIND.checkin);
    const checkout = createButton(document, '퇴근', ATTENDANCE_KIND.checkout);
    const checkinGroup = document.createElement('div');
    checkinGroup.className = 'inno-amaranth-attendance-checkin-group';
    checkinGroup.append(checkin, createGreetingCopyButton(document));
    container.append(checkinGroup, checkout);
    injectedButtons = [
      { element: checkin, kind: ATTENDANCE_KIND.checkin },
      { element: checkout, kind: ATTENDANCE_KIND.checkout },
    ];
    return container;
  }

  function syncActiveState(document: Document): void {
    for (const { element, kind } of injectedButtons) {
      if (!element.isConnected) continue;
      const original = document.querySelector<HTMLElement>(originalSelector(kind));
      if (!original) continue;
      element.classList.toggle('is-active', original.classList.contains(ACTIVE_CLASS));
    }
  }

  return {
    id: 'attendanceHeader',

    reconcile(context: PageContext): void {
      activeDocument = context.document;
      const anchor = context.document.querySelector<HTMLElement>(NOTI_DETAILS);
      if (!anchor) return;

      let container = context.document.getElementById(INJECTED_ID);
      if (!container?.isConnected) {
        ensureAttendanceStyles(context.document);
        container = buildContainer(context.document);
        anchor.appendChild(container);
      }
      syncActiveState(context.document);
    },

    dispose(): void {
      if (activeDocument) {
        activeDocument.getElementById(INJECTED_ID)?.remove();
        removeAttendanceStyles(activeDocument);
      }
      injectedButtons = [];
      activeDocument = null;
    },
  };
}
