import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import {
  ISSUE_DIALOG,
  ISSUE_MODAL_MINIMISE_BUTTON,
  ISSUE_MODAL_WIDTH_ROOT,
} from '../../selectors';
import {
  ensureIssueModalWidthStyles,
  isWideModeOn,
  removeIssueModalWidthStyles,
  setWideMode,
} from './styles';

const WIDE_LABEL = '기본 폭';
const NARROW_LABEL = '전체 폭';

const WIDE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>';
const NARROW_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3a2 2 0 0 0 2-2V3"></path><path d="M21 8h-3a2 2 0 0 1-2-2V3"></path><path d="M3 16h3a2 2 0 0 1 2 2v3"></path><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path></svg>';

/**
 * 보드의 업무 상세 모달을 브라우저 화면 전체 폭으로 넓힌다.
 *
 * Jira에는 이 기능이 없다. 우상단 화살표는 `사이드바로 전환`이라 오히려 좁아지고, `작업` 메뉴
 * 17개 항목에도 전체 화면이 없다. 전체 페이지 뷰가 가장 넓지만 보드를 벗어난다.
 *
 * 백로그는 모달이 아니라 `preview-panels.preview-panel`이 뜨므로 이 기능의 대상이 아니다.
 *
 * docs/plans/jira-issue-modal-fullwidth/spec.md
 */
export function createIssueModalWidthRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let host: HTMLSpanElement | null = null;

  function removeHost(document: Document): void {
    for (const existing of document.querySelectorAll(
      `[${FEATURE_ROOT_ATTRIBUTE}="${ISSUE_MODAL_WIDTH_ROOT}"]`,
    )) {
      existing.remove();
    }
    host = null;
  }

  function dispose(): void {
    if (activeDocument) {
      removeHost(activeDocument);
      removeIssueModalWidthStyles(activeDocument);
    }
    activeDocument = null;
  }

  function createToggleHost(document: Document, anchor: Element): HTMLSpanElement | null {
    const nextHost = document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, ISSUE_MODAL_WIDTH_ROOT);
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button {
          box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; padding: 0; border: 0; border-radius: 4px;
          background: transparent; color: #44546f; cursor: pointer;
        }
        button:hover { background: #091e420f; color: #172b4d; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
      </style>
      <button type="button" data-action="toggle"></button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('[data-action="toggle"]');
    if (!button) return null;

    const render = (): void => {
      const on = isWideModeOn(document);
      button.innerHTML = on ? NARROW_ICON : WIDE_ICON;
      const label = on ? WIDE_LABEL : NARROW_LABEL;
      button.setAttribute('aria-label', `업무 모달 ${label}으로 전환`);
      button.title = `업무 모달 ${label}으로 전환`;
      button.setAttribute('aria-pressed', String(on));
    };

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWideMode(document, !isWideModeOn(document));
      render();
    });

    render();
    // 사이트 기본 버튼 순서를 바꾸지 않도록 `사이드바로 전환` 왼쪽에 넣는다.
    anchor.insertAdjacentElement('beforebegin', nextHost);
    return nextHost;
  }

  return {
    id: 'issueModalWidth',

    reconcile(context: PageContext): void {
      activeDocument = context.document;

      const dialog = context.document.querySelector(ISSUE_DIALOG);
      if (!dialog) {
        // 모달이 닫히면 버튼만 거둔다. 스타일과 속성은 다음 모달을 위해 남긴다.
        removeHost(context.document);
        return;
      }

      ensureIssueModalWidthStyles(context.document);

      const anchor = dialog.querySelector(ISSUE_MODAL_MINIMISE_BUTTON);
      if (!anchor) return;

      // 이미 올바른 자리에 붙어 있으면 다시 만들지 않는다.
      if (host?.isConnected && host.nextElementSibling === anchor) return;

      removeHost(context.document);
      host = createToggleHost(context.document, anchor);
    },

    dispose,
  };
}
