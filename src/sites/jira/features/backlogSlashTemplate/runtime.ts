import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import type { FeatureSettings } from '../../../../platform/settings/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { MENU_CSS } from '../../../../platform/design/parts';
import { requestOpenSettings } from '../../../../platform/messaging/openSettings';
// 라우트 형식을 한 곳에서만 정의하려고 Popup 의 순수 헬퍼를 그대로 쓴다. DOM 의존이 없다.
import { featureRoute } from '../../../../popup/router';
import {
  BACKLOG_CARD_LIST_CONTAINER,
  BACKLOG_SLASH_TEMPLATE_ROOT,
  BACKLOG_SUMMARY_INPUT,
} from '../../selectors';
import {
  buildInsertion,
  filterTags,
  moveActiveIndex,
  normalizePrefixTagOptions,
  readSlashToken,
  SUMMARY_MAX_LENGTH,
  visibleTagLabels,
} from './contracts';

/**
 * React controlled input에 값을 넣는다.
 *
 * DOM 값만 바꾸면 React가 다음 렌더에서 되돌린다. React의 합성 이벤트가 값을 native setter를
 * 통해 읽으므로 그 setter로 넣고 `input` 이벤트를 쏴야 상태까지 갱신된다.
 *
 * 실측에서 순진한 대입도 통했지만 React 구현에 기대는 동작이라 표준 우회를 쓴다.
 *
 * docs/plans/jira-backlog-slash-template/context.md
 */
const PREFIX_TAG_SETTINGS_ROUTE = featureRoute('jira', 'backlogSlashTemplate');

function setInputValue(input: HTMLInputElement, value: string, caret: number): void {
  const setter = Object.getOwnPropertyDescriptor(
    input.ownerDocument.defaultView?.HTMLInputElement.prototype ?? HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.setSelectionRange(caret, caret);
}

export function createBacklogSlashTemplateRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let boundInput: HTMLInputElement | null = null;
  let host: HTMLDivElement | null = null;
  let listRoot: HTMLElement | null = null;
  let tags: string[] = [];
  let tagsSignature = '';
  let matches: string[] = [];
  let activeIndex = 0;

  function isListOpen(): boolean {
    return matches.length > 0 && host?.isConnected === true;
  }

  function closeList(): void {
    matches = [];
    activeIndex = 0;
    host?.remove();
    host = null;
    listRoot = null;
  }

  function unbind(): void {
    if (boundInput) {
      boundInput.removeEventListener('keydown', onKeyDown, true);
      boundInput.removeEventListener('input', onInput);
      boundInput.removeEventListener('blur', onBlur);
    }
    boundInput = null;
    closeList();
  }

  function dispose(): void {
    unbind();
    if (activeDocument) {
      for (const stale of activeDocument.querySelectorAll(
        `[${FEATURE_ROOT_ATTRIBUTE}="${BACKLOG_SLASH_TEMPLATE_ROOT}"]`,
      )) {
        stale.remove();
      }
    }
    activeDocument = null;
  }

  function ensureHost(document: Document): HTMLElement {
    if (host?.isConnected && listRoot) return listRoot;

    host = document.createElement('div');
    host.setAttribute(FEATURE_ROOT_ATTRIBUTE, BACKLOG_SLASH_TEMPLATE_ROOT);
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.zIndex = '9999';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${DESIGN_TOKENS}${MENU_CSS}</style>
      <ul class="inno-listbox" role="listbox" aria-label="prefix 태그 목록"></ul>
      <button type="button" class="inno-listbox__footer" tabindex="-1">＋ prefix 태그 추가·관리…</button>
    `;
    listRoot = shadow.querySelector('ul');

    const manage = shadow.querySelector('button.inno-listbox__footer');
    // **마우스 전용이다.** 키보드 선택 대상이 아니므로 `matches` 에 넣지 않고
    // `tabindex="-1"` 로 포커스에서도 뺀다. 잘못 눌리면 입력 중이던 제목을 두고
    // 창이 뜨는 셈이라, 의도한 클릭에만 반응해야 한다.
    manage?.addEventListener('mousedown', (event) => {
      // mousedown 으로 처리해야 입력창의 blur 보다 먼저 잡힌다.
      event.preventDefault();
      event.stopPropagation();
      closeList();
      requestOpenSettings(PREFIX_TAG_SETTINGS_ROUTE);
    });

    document.body.appendChild(host);
    return listRoot as HTMLElement;
  }

  function positionHost(input: HTMLInputElement): void {
    if (!host) return;
    const rect = input.getBoundingClientRect();
    const view = input.ownerDocument.defaultView;
    const spaceBelow = (view?.innerHeight ?? 0) - rect.bottom;

    host.style.left = `${Math.round(rect.left)}px`;
    host.style.minWidth = `${Math.max(200, Math.round(rect.width * 0.4))}px`;
    // 아래 공간이 좁으면 위로 뒤집는다.
    if (spaceBelow < 160) {
      host.style.top = 'auto';
      host.style.bottom = `${Math.round((view?.innerHeight ?? 0) - rect.top + 4)}px`;
    } else {
      host.style.bottom = 'auto';
      host.style.top = `${Math.round(rect.bottom + 4)}px`;
    }
  }

  function renderList(input: HTMLInputElement): void {
    const document = input.ownerDocument;
    const list = ensureHost(document);
    list.innerHTML = '';

    matches.forEach((tag, index) => {
      const item = document.createElement('li');
      item.className = 'inno-listbox__item';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === activeIndex));
      item.textContent = tag;
      item.addEventListener('mousedown', (event) => {
        // mousedown 으로 처리해야 input 의 blur 보다 먼저 잡힌다.
        event.preventDefault();
        insert(input, tag);
      });
      item.addEventListener('mouseenter', () => {
        // 같은 항목이면 다시 그리지 않는다. 다시 그리면 커서 밑에 새 요소가 놓이고 그것이
        // 또 `mouseenter` 를 내서 끝없이 돈다.
        if (activeIndex === index) return;
        activeIndex = index;
        renderList(input);
      });
      list.appendChild(item);
    });

    positionHost(input);
  }

  function refresh(input: HTMLInputElement): void {
    const token = readSlashToken(input.value);
    if (token === null) {
      closeList();
      return;
    }

    const next = filterTags(tags, token);
    if (next.length === 0) {
      closeList();
      return;
    }

    // 목록이 바뀌면 커서를 처음으로 되돌린다.
    if (next.join('\u0000') !== matches.join('\u0000')) activeIndex = 0;
    matches = next;
    renderList(input);
  }

  function insert(input: HTMLInputElement, tag: string): void {
    const insertion = buildInsertion(input.value, tag, SUMMARY_MAX_LENGTH);
    closeList();
    if (!insertion) return;
    setInputValue(input, insertion.value, insertion.caret);
    input.focus();
  }

  function onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // IME 조합 중에는 값이 확정되지 않았다. `compositionend` 뒤에 다시 계산한다.
    if ((event as InputEvent).isComposing) return;
    refresh(input);
  }

  function onBlur(): void {
    closeList();
  }

  /**
   * 키 입력을 가로챈다.
   *
   * **목록이 열려 있을 때만** 개입한다. 닫혀 있으면 아무것도 하지 않는다. 이 입력창의 `Enter`는
   * 이슈 생성이므로, 잘못 가로채면 정상적인 생성이 막힌다.
   *
   * `capture` 단계에서 듣고 `stopPropagation`까지 해야 Jira의 `onKeyDown`에 닿지 않는다.
   */
  function onKeyDown(event: KeyboardEvent): void {
    // IME 조합 중의 Enter 는 한자·후보 확정이다. 건드리면 안 된다.
    if (event.isComposing || event.keyCode === 229) return;
    if (!isListOpen()) return;

    const input = event.target as HTMLInputElement;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      activeIndex = moveActiveIndex(activeIndex, matches.length, event.key === 'ArrowDown' ? 1 : -1);
      renderList(input);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      insert(input, matches[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeList();
    }
  }

  function bind(input: HTMLInputElement): void {
    if (boundInput === input) return;
    unbind();
    boundInput = input;
    input.addEventListener('keydown', onKeyDown, true);
    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);
    refresh(input);
  }

  return {
    id: 'backlogSlashTemplate',

    reconcile(context: PageContext, settings: FeatureSettings): void {
      activeDocument = context.document;
      tags = visibleTagLabels(normalizePrefixTagOptions(settings.options));

      // 설정 창에서 태그를 고치면 `storage.onChanged` 로 여기까지 온다. 열려 있는
      // 목록도 새 태그로 다시 그려야 방금 추가한 것이 바로 보인다.
      const signature = tags.join('\u0000');
      const tagsChanged = signature !== tagsSignature;
      tagsSignature = signature;

      // 보여줄 태그가 하나도 없으면 목록을 띄울 이유가 없다.
      if (tags.length === 0) {
        unbind();
        return;
      }

      const input = context.document.querySelector<HTMLInputElement>(BACKLOG_SUMMARY_INPUT);
      // 카드 리스트 안의 입력만 대상으로 한다. 다른 화면의 동명 입력을 잡지 않기 위해서다.
      if (!input || !input.closest(BACKLOG_CARD_LIST_CONTAINER)) {
        unbind();
        return;
      }

      bind(input);
      if (tagsChanged) refresh(input);
    },

    dispose,
  };
}
