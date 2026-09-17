/**
 * 설명 편집 중에 `설명` 라벨 옆에서 바로 취소·저장한다.
 *
 * 설명은 본문을 클릭하면 곧바로 편집 상태가 된다. 그런데 끝내려면 **문서 끝까지 스크롤해서**
 * 아래쪽 버튼을 눌러야 한다. 긴 설명일수록 멀다.
 *
 * 새로운 동작을 만들지 않는다. **아래쪽 버튼을 그대로 누른다.** 확인 대화상자가 뜨는지, 초안을
 * 남기는지까지 Jira 가 정하던 대로 둔다.
 *
 * **`저장`은 되돌릴 수 없다.** 그래서 `취소`와 눈에 띄게 다르게 그린다. 위쪽에 있으면 아래쪽보다
 * 잘못 눌리기 쉬운데, 두 버튼이 같은 모양이면 그 위험이 커진다.
 *
 * 순서는 아래쪽 버튼 줄과 같이 `저장` 다음 `취소`다.
 *
 * docs/plans/jira-description-edit-actions/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { findDescriptionLabelRow } from '../../descriptionLabel';
import {
  DESCRIPTION_EDITOR_CANCEL_BUTTON,
  DESCRIPTION_EDITOR_CONTAINER_FIELD,
  DESCRIPTION_EDITOR_SAVE_BUTTON,
  DESCRIPTION_EDIT_ACTIONS_ROOT,
} from '../../selectors';

/**
 * 설명 편집기 아래쪽 버튼을 찾는다.
 *
 * **반드시 설명 편집 컨테이너 안에서 찾는다.** 버튼의 `data-testid` 가 `comment-cancel-button` ·
 * `comment-save-button` 인데, 이건 Jira 가 설명 편집에도 댓글 편집기 컴포넌트를 재사용해서 붙은
 * 이름이다. 문서 전체에서 찾으면 **진짜 댓글 편집기의 버튼을 누르게 된다.** 저장 쪽은 남의 댓글이
 * 그대로 등록되는 사고가 된다.
 */
function findEditorButton(document: Document, selector: string): HTMLButtonElement | null {
  const container = document.querySelector<HTMLElement>(DESCRIPTION_EDITOR_CONTAINER_FIELD);
  return container?.querySelector<HTMLButtonElement>(selector) ?? null;
}

export function createDescriptionEditActionsRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;

  function dispose(): void {
    host?.remove();
    host = null;
  }

  function createButtonHost(context: PageContext, anchor: HTMLElement): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, DESCRIPTION_EDIT_ACTIONS_ROOT);
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .row { display: inline-flex; align-items: center; gap: 4px; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          box-sizing: border-box; min-height: 24px; padding: 0 8px; border: 0;
          border-radius: 3px; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 500; line-height: 24px; white-space: nowrap;
        }
        svg { width: 14px; height: 14px; flex: 0 0 auto; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }

        /* 취소 — 눈에 덜 띄는 기본 모양 */
        .cancel { background: transparent; color: #44546f; }
        .cancel:hover { background: #091e420f; color: #172b4d; }

        /**
         * 저장 — 되돌릴 수 없으므로 확실히 구분되게 그린다.
         * 두 버튼이 같은 모양이면 위쪽에서 잘못 누를 위험이 커진다.
         */
        .save { background: #0c66e4; color: #ffffff; font-weight: 600; padding: 0 10px; }
        .save:hover { background: #0055cc; }
      </style>
      <span class="row">
        <button type="button" class="save" data-action="save" aria-label="설명 저장">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5"></path>
          </svg>
          <span>저장</span>
        </button>
        <button type="button" class="cancel" data-action="cancel" aria-label="설명 편집 취소">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
          </svg>
          <span>취소</span>
        </button>
      </span>
    `;

    const cancelButton = shadow.querySelector<HTMLButtonElement>('[data-action="cancel"]');
    const saveButton = shadow.querySelector<HTMLButtonElement>('[data-action="save"]');
    if (!cancelButton || !saveButton) return null;

    /**
     * 아래쪽 버튼을 그대로 누른다.
     *
     * 클릭 시점에 다시 찾는다. 그 사이 편집이 끝났을 수 있다. 못 찾으면 아무것도 하지 않는다 —
     * 특히 저장은 엉뚱한 곳을 누르느니 아무 일도 안 하는 편이 낫다.
     */
    const forwardClick = (selector: string, what: string) => (): void => {
      const target = findEditorButton(context.document, selector);
      if (!target) {
        console.warn(`[Inno Extension] 설명 ${what} 버튼을 찾지 못했습니다.`);
        return;
      }
      target.click();
    };

    cancelButton.addEventListener('click', forwardClick(DESCRIPTION_EDITOR_CANCEL_BUTTON, '취소'));
    saveButton.addEventListener('click', forwardClick(DESCRIPTION_EDITOR_SAVE_BUTTON, '저장'));

    anchor.append(nextHost);
    return nextHost;
  }

  return {
    id: 'descriptionEditActions',

    reconcile(context: PageContext): void {
      // 편집 중이 아니면 붙이지 않는다. 누를 대상이 없다.
      const cancel = findEditorButton(context.document, DESCRIPTION_EDITOR_CANCEL_BUTTON);
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
