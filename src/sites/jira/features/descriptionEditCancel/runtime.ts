/**
 * 설명 편집 중에 `설명` 라벨 옆에서 바로 취소한다.
 *
 * 설명은 본문을 클릭하면 곧바로 편집 상태가 된다. 그런데 되돌리려면 **문서 끝까지 스크롤해서**
 * 아래쪽 `취소`를 눌러야 한다. 긴 설명일수록 멀다.
 *
 * 새로운 동작을 만들지 않는다. **아래쪽 `취소` 버튼을 그대로 누른다.** 확인 대화상자가 뜨는지
 * 여부까지 Jira 가 정하던 대로 둔다.
 *
 * docs/plans/jira-description-edit-cancel/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { findDescriptionLabelRow } from '../../descriptionLabel';
import {
  DESCRIPTION_EDITOR_CANCEL_BUTTON,
  DESCRIPTION_EDITOR_CONTAINER_FIELD,
  DESCRIPTION_EDIT_CANCEL_ROOT,
} from '../../selectors';

/**
 * 설명 편집기의 `취소` 버튼을 찾는다.
 *
 * **반드시 설명 편집 컨테이너 안에서 찾는다.** 버튼의 `data-testid` 가 `comment-cancel-button`
 * 인데, 이건 Jira 가 설명 편집에도 댓글 편집기 컴포넌트를 재사용해서 붙은 이름이다. 문서
 * 전체에서 찾으면 진짜 댓글 편집기의 취소를 누르게 된다.
 */
function findEditorCancelButton(document: Document): HTMLButtonElement | null {
  const container = document.querySelector<HTMLElement>(DESCRIPTION_EDITOR_CONTAINER_FIELD);
  return container?.querySelector<HTMLButtonElement>(DESCRIPTION_EDITOR_CANCEL_BUTTON) ?? null;
}

export function createDescriptionEditCancelRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;

  function dispose(): void {
    host?.remove();
    host = null;
  }

  function createButtonHost(context: PageContext, anchor: HTMLElement): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, DESCRIPTION_EDIT_CANCEL_ROOT);
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          box-sizing: border-box; min-height: 24px; padding: 0 8px; border: 0;
          border-radius: 3px; background: transparent; color: #44546f; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 500; line-height: 24px; white-space: nowrap;
        }
        svg { width: 14px; height: 14px; flex: 0 0 auto; }
        button:hover { background: #091e420f; color: #172b4d; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
      </style>
      <button type="button" aria-label="설명 편집 취소">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
        </svg>
        <span>취소</span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('button');
    if (!button) return null;

    button.addEventListener('click', () => {
      // 클릭 시점에 다시 찾는다. 그 사이 편집이 끝났을 수 있다.
      const cancel = findEditorCancelButton(context.document);
      if (!cancel) {
        console.warn('[Inno Extension] 설명 편집 취소 버튼을 찾지 못했습니다.');
        return;
      }
      cancel.click();
    });

    anchor.append(nextHost);
    return nextHost;
  }

  return {
    id: 'descriptionEditCancel',

    reconcile(context: PageContext): void {
      // 편집 중이 아니면 붙이지 않는다. 취소할 것이 없다.
      const cancel = findEditorCancelButton(context.document);
      const anchor = findDescriptionLabelRow(context.document);
      if (!cancel || !anchor) {
        dispose();
        return;
      }

      if (host?.isConnected && host.parentElement === anchor) return;

      dispose();
      host = createButtonHost(context, anchor);
    },

    dispose,
  };
}
