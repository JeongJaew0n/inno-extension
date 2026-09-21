/**
 * 업무 생성 모달의 설명에서 `$` 로 템플릿을 고른다.
 *
 * 백로그 prefix 태그(`backlogSlashTemplate`)와 같은 얼개다. 다른 점 둘.
 *
 * | | prefix 태그 | 여기 |
 * | --- | --- | --- |
 * | 대상 | `<input>` | ProseMirror 편집기 |
 * | 트리거 | `/` | `$` — Jira 가 `/` 를 이미 쓴다 |
 *
 * docs/plans/jira-create-helpers/spec.md
 */

import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import type { FeatureSettings } from '../../../../platform/settings/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { MENU_CSS } from '../../../../platform/design/parts';
import { requestOpenSettings } from '../../../../platform/messaging/openSettings';
import { featureRoute } from '../../../../popup/router';
import { CREATE_MODAL_DESCRIPTION, CREATE_TEMPLATE_INSERT_ROOT } from '../../selectors';
import { findCreateModal } from '../../createModal';
import type { CodeBlockAdfPayload } from '../../../../platform/editor/code-block-to-adf';
import {
  filterTemplates,
  moveActiveIndex,
  normalizeTemplateOptions,
  readTemplateToken,
  visibleTemplates,
  type Template,
} from './contracts';

const SETTINGS_ROUTE = featureRoute('jira', 'createTemplateInsert');

/**
 * Markdown -> 편집기 HTML 변환기를 **쓸 때만** 불러온다.
 *
 * 이 변환기는 `marked`(43KB)를 끌고 온다. 정적으로 넣으면 모든 Jira 페이지가 그걸
 * 파싱·평가하는데, 실제로 필요한 건 사용자가 템플릿을 고른 순간뿐이다.
 * 편집기 Markdown 변환 기능이 쓰는 것과 같은 방식이다.
 */
let converterPromise: Promise<(markdown: string) => CodeBlockAdfPayload> | null = null;

function loadConverter(): Promise<(markdown: string) => CodeBlockAdfPayload> {
  converterPromise ??= import('../../../../platform/editor/code-block-to-adf')
    .then((module) => module.codeBlockMarkdownToAdfPayload)
    .catch((error) => {
      // 실패한 Promise 를 남겨두면 이후 시도가 모두 같은 오류로 막힌다.
      converterPromise = null;
      throw error;
    });
  return converterPromise;
}

export function createTemplateInsertRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let boundEditor: HTMLElement | null = null;
  let host: HTMLDivElement | null = null;
  let listRoot: HTMLElement | null = null;
  let templates: Template[] = [];
  let matches: Template[] = [];
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
    if (boundEditor) {
      boundEditor.removeEventListener('keydown', onKeyDown, true);
      boundEditor.removeEventListener('input', onInput);
      boundEditor.removeEventListener('blur', onBlur);
    }
    boundEditor = null;
    closeList();
  }

  function dispose(): void {
    unbind();
    if (activeDocument) {
      for (const stale of activeDocument.querySelectorAll(
        `[${FEATURE_ROOT_ATTRIBUTE}="${CREATE_TEMPLATE_INSERT_ROOT}"]`,
      )) {
        stale.remove();
      }
    }
    activeDocument = null;
  }

  function ensureHost(document: Document): HTMLElement {
    if (host?.isConnected && listRoot) return listRoot;

    host = document.createElement('div');
    host.setAttribute(FEATURE_ROOT_ATTRIBUTE, CREATE_TEMPLATE_INSERT_ROOT);
    host.style.all = 'initial';
    host.style.position = 'fixed';
    // 모달 위에 떠야 한다. Jira 모달이 높은 z-index 를 쓴다.
    host.style.zIndex = '9999';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${DESIGN_TOKENS}${MENU_CSS}</style>
      <ul class="inno-listbox" role="listbox" aria-label="업무 템플릿 목록"></ul>
      <button type="button" class="inno-listbox__footer" tabindex="-1">＋ 템플릿 추가·관리…</button>
    `;
    listRoot = shadow.querySelector('ul');

    // **마우스 전용이다.** prefix 태그와 같은 이유 — `Enter` 로 닿으면 템플릿을 넣으려다
    // 창이 뜬다. `mousedown` 으로 처리해 편집기의 `blur` 보다 먼저 잡는다.
    shadow.querySelector('button.inno-listbox__footer')?.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeList();
      requestOpenSettings(SETTINGS_ROUTE);
    });

    document.body.appendChild(host);
    return listRoot as HTMLElement;
  }

  /**
   * 목록을 **캐럿 줄** 밑에 붙인다.
   *
   * 편집기 아래에 붙이면 안 된다. 이 편집기는 빈 상태에서도 70px 쯤 되는 블록이라
   * 첫 줄에서 `$` 를 쳐도 목록이 한참 밑에 뜬다. prefix 태그 쪽은 한 줄짜리 `input`
   * 이라 그 차이가 없었다.
   *
   * 접힌 선택 영역은 높이 0 인 사각형을 주기도 한다. 그때는 편집기 사각형으로 떨어진다.
   */
  function positionHost(editor: HTMLElement): void {
    if (!host) return;
    const view = editor.ownerDocument.defaultView;
    const editorRect = editor.getBoundingClientRect();
    const selection = view?.getSelection();
    const caret = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).getBoundingClientRect()
      : null;
    const anchored = caret && caret.height > 0 && caret.top >= editorRect.top
      ? caret
      : editorRect;
    const rect = {
      left: editorRect.left,
      top: anchored.top,
      bottom: anchored.bottom,
      width: editorRect.width,
    };
    const spaceBelow = (view?.innerHeight ?? 0) - rect.bottom;

    host.style.left = `${Math.round(rect.left)}px`;
    host.style.minWidth = `${Math.max(220, Math.round(rect.width * 0.5))}px`;
    if (spaceBelow < 200) {
      host.style.top = 'auto';
      host.style.bottom = `${Math.round((view?.innerHeight ?? 0) - rect.top + 4)}px`;
    } else {
      host.style.bottom = 'auto';
      host.style.top = `${Math.round(rect.bottom + 4)}px`;
    }
  }

  function renderList(editor: HTMLElement): void {
    const document = editor.ownerDocument;
    const list = ensureHost(document);
    list.innerHTML = '';

    matches.forEach((template, index) => {
      const item = document.createElement('li');
      item.className = 'inno-listbox__item';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === activeIndex));
      item.textContent = template.title;
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        insert(editor, template);
      });
      item.addEventListener('mouseenter', () => {
        activeIndex = index;
        renderList(editor);
      });
      list.appendChild(item);
    });

    positionHost(editor);
  }

  function refresh(editor: HTMLElement): void {
    const token = readTemplateToken(editor.textContent ?? '');
    if (token === null) {
      closeList();
      return;
    }

    const next = filterTemplates(templates, token);
    if (next.length === 0) {
      closeList();
      return;
    }

    if (next.map((t) => t.title).join('\u0000') !== matches.map((t) => t.title).join('\u0000')) {
      activeIndex = 0;
    }
    matches = next;
    renderList(editor);
  }

  /**
   * 편집기 내용을 템플릿으로 바꾼다.
   *
   * **Markdown 을 서식으로 바꿔서 넣는다.** `## Goal` 이 글자가 아니라 진짜 제목이 된다.
   *
   * 경로는 `Markdown -> ADF -> 편집기 HTML -> 붙여넣기` 다. 붙여넣기에 `text/html` 을
   * 함께 실으면 **편집기가 그쪽을 우선하고 자기 Markdown 파서를 타지 않는다.**
   * `text/plain` 만 보내면 편집기 파서에 맡기게 되는데, 실측에서 그게 일정하지 않았다 —
   * 같은 본문이 어떤 때는 제목이 되고 어떤 때는 글자로 남았다.
   *
   * `selectAll` 로 `$토큰` 까지 함께 덮어쓴다. 지금 편집기 내용은 그것뿐이다.
   *
   * docs/plans/jira-create-helpers/context.md
   */
  async function insert(editor: HTMLElement, template: Template): Promise<void> {
    // **목록을 먼저 닫지 않는다.** 닫으면 이 핸들러가 달린 요소가 사라지면서 포커스 흐름이
    // 끊긴다. 넣고 나서 닫는다.
    editor.focus();
    const document = editor.ownerDocument;
    document.execCommand('selectAll');

    try {
      const convert = await loadConverter();
      const payload = convert(template.body);

      const clipboardData = new DataTransfer();
      clipboardData.setData('text/html', payload.html);
      clipboardData.setData('text/plain', template.body);
      editor.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData,
      }));
    } catch (error) {
      // 변환이 안 되면 아무것도 안 넣는 것보다 원문이라도 넣는 편이 낫다.
      console.error('[Inno Extension] 템플릿 변환 실패, 원문으로 넣습니다', error);
      document.execCommand('insertText', false, template.body);
    }

    closeList();
  }

  function onInput(event: Event): void {
    if ((event as InputEvent).isComposing) return;
    refresh(event.currentTarget as HTMLElement);
  }

  function onBlur(): void {
    closeList();
  }

  /**
   * 키 입력을 가로챈다.
   *
   * **목록이 열려 있을 때만** 개입한다. 닫혀 있으면 아무것도 하지 않는다. 편집기의 `Enter`
   * 는 줄바꿈이라 잘못 가로채면 글을 못 쓴다.
   */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || event.keyCode === 229) return;
    if (!isListOpen()) return;

    const editor = event.currentTarget as HTMLElement;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      activeIndex = moveActiveIndex(activeIndex, matches.length, event.key === 'ArrowDown' ? 1 : -1);
      renderList(editor);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      insert(editor, matches[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeList();
    }
  }

  function bind(editor: HTMLElement): void {
    if (boundEditor === editor) return;
    unbind();
    boundEditor = editor;
    editor.addEventListener('keydown', onKeyDown, true);
    editor.addEventListener('input', onInput);
    editor.addEventListener('blur', onBlur);
  }

  return {
    id: 'createTemplateInsert',

    reconcile(context: PageContext, settings: FeatureSettings): void {
      activeDocument = context.document;
      templates = visibleTemplates(normalizeTemplateOptions(settings.options));

      // 보여줄 템플릿이 하나도 없으면 목록을 띄울 이유가 없다.
      if (templates.length === 0) {
        unbind();
        return;
      }

      const modal = findCreateModal(context.document);
      const editor = modal
        ?.querySelector(CREATE_MODAL_DESCRIPTION)
        ?.querySelector<HTMLElement>('.ProseMirror');
      if (!editor) {
        unbind();
        return;
      }

      bind(editor);
    },

    dispose,
  };
}
