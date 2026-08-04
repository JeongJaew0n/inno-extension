import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  ACTIVE_CLASS,
  ATTENDANCE_KIND,
  CHECKIN_LI,
  CHECKOUT_LI,
  INJECTED_ID,
  NOTI_DETAILS,
  type AttendanceKind,
} from '../../selectors';
import { ensureAttendanceStyles, removeAttendanceStyles } from './styles';

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

  function buildContainer(document: Document): HTMLDivElement {
    const container = document.createElement('div');
    container.id = INJECTED_ID;
    container.setAttribute(FEATURE_ROOT_ATTRIBUTE, 'amaranth-attendance-header');

    const checkin = createButton(document, '출근', ATTENDANCE_KIND.checkin);
    const checkout = createButton(document, '퇴근', ATTENDANCE_KIND.checkout);
    container.append(checkin, checkout);
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
