/**
 * 업무 **설명**을 클릭해도 편집으로 들어가지 않게 막는다.
 *
 * Jira 설명은 본문 아무 데나 클릭하면 곧바로 편집 상태가 된다. 읽다가 링크 옆을 누르거나 글을
 * 고르려다 편집으로 넘어가는 일이 잦다.
 *
 * `설명` 라벨 줄의 `Markdown 복사` 왼쪽에 스위치를 둔다. 켜면 클릭 편집이 막히고 `편집` 버튼이
 * 나타난다. 끄면 버튼은 사라지고 Jira 기본 동작으로 돌아간다.
 *
 * **막힘 상태는 전역이다.** `chrome.storage.sync` 에 저장하므로 다른 탭과 Popup 이 같이 바뀐다.
 *
 * docs/plans/jira-description-edit-lock/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS, TOGGLE_CSS } from '../../../../platform/design/parts';
import { setFeatureOptions } from '../../../../platform/settings/repository';
import { EDITOR_PROSEMIRROR } from '../../../../platform/editor/selectors';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import type { FeatureSettings } from '../../../../platform/settings/types';
import { findDescriptionLabelRow } from '../../descriptionLabel';
import {
  DESCRIPTION_EDITOR_CONTAINER_FIELD,
  DESCRIPTION_EDIT_LOCK_ROOT,
  DESCRIPTION_FIELD,
  DESCRIPTION_MARKDOWN_COPY_ROOT,
  DESCRIPTION_RENDERER,
} from '../../selectors';
import { normalizeEditLockOptions, shouldBlockDescriptionClick } from './contracts';

/** 본문 안에서 눌러도 편집이 아닌 것들. 링크·펼치기·체크박스 등 */
const INTERACTIVE_CONTENT = 'a, button, input, textarea, select, label, summary, '
  + '[role="button"], [role="link"], [role="checkbox"], [role="menuitem"]';

function isEditing(document: Document): boolean {
  const container = document.querySelector(DESCRIPTION_EDITOR_CONTAINER_FIELD);
  return container?.querySelector(EDITOR_PROSEMIRROR) != null;
}

/** 읽기 상태의 설명 필드. 편집 중이면 `null` */
function findReadField(document: Document): HTMLElement | null {
  if (isEditing(document)) return null;
  return document.querySelector<HTMLElement>(DESCRIPTION_FIELD);
}

export function createDescriptionEditLockRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  let activeDocument: Document | null = null;
  let locked = false;
  /** `편집` 버튼이 보내는 클릭은 막지 않는다 */
  let bypass = false;
  let listening = false;

  /**
   * `window` capture 단계에서 클릭을 끊는다.
   *
   * React 는 루트 컨테이너에서 이벤트를 받는다. capture 는 `window` 부터 내려가므로 여기서
   * 끊으면 Jira 의 편집 전환이 아예 일어나지 않는다. `preventDefault` 는 하지 않는다 —
   * 링크 이동과 텍스트 선택은 그대로 둔다.
   */
  function onClickCapture(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const field = target.closest<HTMLElement>(DESCRIPTION_FIELD);
    const renderer = field?.querySelector<HTMLElement>(DESCRIPTION_RENDERER) ?? null;
    const interactive = target.closest(INTERACTIVE_CONTENT);

    const block = shouldBlockDescriptionClick({
      locked,
      bypass,
      insideDescription: field !== null,
      insideOurUi: target.closest(`[${FEATURE_ROOT_ATTRIBUTE}]`) !== null,
      onInteractiveContent: interactive !== null && renderer !== null && renderer.contains(interactive),
    });
    if (!block) return;

    event.stopImmediatePropagation();
  }

  function setListening(view: Window | null, next: boolean): void {
    if (!view || listening === next) return;
    if (next) view.addEventListener('click', onClickCapture, true);
    else view.removeEventListener('click', onClickCapture, true);
    listening = next;
  }

  /**
   * 편집에 들어간다.
   *
   * Jira 가 원래 받던 것과 같은 클릭을 본문에 보낸다. 새로운 경로를 만들지 않아야 Jira 가
   * 바뀌어도 같이 따라간다. 설명이 비어 있으면 렌더러가 없으므로 필드 자체를 누른다.
   */
  function enterEdit(document: Document): void {
    const field = findReadField(document);
    if (!field) return;
    const target = field.querySelector<HTMLElement>(DESCRIPTION_RENDERER)
      ?? field.firstElementChild as HTMLElement | null
      ?? field;

    bypass = true;
    try {
      target.click();
    } finally {
      bypass = false;
    }
  }

  function dispose(): void {
    setListening(activeDocument?.defaultView ?? null, false);
    host?.remove();
    host = null;
    activeDocument = null;
  }

  function createHost(document: Document): HTMLSpanElement | null {
    const next = document.createElement('span');
    next.setAttribute(FEATURE_ROOT_ATTRIBUTE, DESCRIPTION_EDIT_LOCK_ROOT);
    next.style.all = 'initial';
    next.style.display = 'inline-flex';
    next.style.alignItems = 'center';
    next.style.verticalAlign = 'middle';

    const shadow = next.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${DESIGN_TOKENS}${BUTTON_CSS}${TOGGLE_CSS}
        .row { display: inline-flex; align-items: center; gap: var(--inno-space-2); }
        .lock {
          display: inline-flex; align-items: center; gap: var(--inno-space-1);
          color: var(--inno-on-surface-variant); font-family: var(--inno-font);
          font-size: var(--inno-label-md); font-weight: var(--inno-label-md-weight);
          white-space: nowrap; cursor: pointer;
        }
        [hidden] { display: none !important; }
      </style>
      <span class="row">
        <label class="lock" title="켜면 본문을 클릭해도 편집으로 들어가지 않습니다">
          <span>클릭 편집 방지</span>
          <span class="inno-switch">
            <input type="checkbox" data-lock aria-label="클릭 편집 방지" />
            <span class="inno-switch__track" aria-hidden="true"></span>
          </span>
        </label>
        <button type="button" class="inno-btn inno-btn--outlined" data-edit hidden
                aria-label="설명 편집">편집</button>
      </span>
    `;

    const checkbox = shadow.querySelector<HTMLInputElement>('[data-lock]');
    const edit = shadow.querySelector<HTMLButtonElement>('[data-edit]');
    if (!checkbox || !edit) return null;

    checkbox.addEventListener('change', () => {
      // 저장만 한다. 화면은 `storage.onChanged` 가 부르는 다음 reconcile 이 맞춘다 —
      // 그래야 다른 탭도 같은 경로로 바뀐다.
      void setFeatureOptions('jira', 'descriptionEditLock', { locked: checkbox.checked })
        .catch((error: unknown) => {
          console.error('[Inno Extension] 클릭 편집 방지 저장 실패', error);
          checkbox.checked = locked;
        });
    });
    edit.addEventListener('click', () => enterEdit(document));

    return next;
  }

  /**
   * `Markdown 복사` 왼쪽에 둔다.
   *
   * 그 버튼이 이미 있으면 바로 앞에 끼운다. 없으면 줄 끝에 붙이는데, 런타임 등록 순서가
   * 이쪽이 먼저라 나중에 붙는 Markdown 복사가 오른쪽에 온다.
   */
  function place(anchor: HTMLElement, element: HTMLElement): void {
    const copy = anchor.querySelector(`:scope > [${FEATURE_ROOT_ATTRIBUTE}="${DESCRIPTION_MARKDOWN_COPY_ROOT}"]`);
    if (copy) {
      if (element.nextElementSibling !== copy) anchor.insertBefore(element, copy);
    } else if (element.parentElement !== anchor) {
      anchor.append(element);
    }
  }

  function sync(document: Document): void {
    const shadow = host?.shadowRoot;
    const checkbox = shadow?.querySelector<HTMLInputElement>('[data-lock]');
    const edit = shadow?.querySelector<HTMLButtonElement>('[data-edit]');
    if (checkbox && checkbox.checked !== locked) checkbox.checked = locked;
    // 편집 버튼은 막혀 있고 **읽는 중일 때만.** 편집 중에는 누를 이유가 없다.
    if (edit) edit.hidden = !(locked && findReadField(document) !== null);
  }

  return {
    id: 'descriptionEditLock',

    reconcile(context: PageContext, settings: FeatureSettings): void {
      activeDocument = context.document;
      locked = normalizeEditLockOptions(settings.options).locked;
      setListening(context.document.defaultView, locked);

      const anchor = findDescriptionLabelRow(context.document);
      const hasDescription = context.document.querySelector(DESCRIPTION_FIELD) !== null
        || isEditing(context.document);
      if (!anchor || !hasDescription) {
        host?.remove();
        host = null;
        return;
      }

      if (!host?.isConnected) {
        host?.remove();
        host = createHost(context.document);
        if (!host) return;
      }
      place(anchor, host);
      sync(context.document);
    },

    dispose,
  };
}
