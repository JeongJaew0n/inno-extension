import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import type { FeatureSettings } from '../../../../platform/settings/types';
import { setFeatureOptions } from '../../../../platform/settings/repository';
import {
  FORM_CARD_LIST,
  FORM_CARD_NAME,
  SELECTED_FORM_CARD,
  TITLE_AUTOFILL_BUTTON_ID,
  TITLE_AUTOFILL_SETTINGS_BUTTON_ID,
  TITLE_FIELD_ROOT,
  TITLE_INPUT,
  TITLE_ROW_HEADER,
} from '../../selectors';
import {
  applyTitleTextEdits,
  filterFormNames,
  isTitleAutofillRoute,
  KNOWN_FORM_NAMES,
  normalizeFormName,
  normalizeTitleAutofillOptions,
  resolveTitleText,
  type TitleAutofillOptions,
} from './contracts';
import { closeTitleAutofillModal, openTitleAutofillModal } from './modal';
import { ensureTitleAutofillStyles, removeTitleAutofillStyles } from './styles';

interface TitleFieldElements {
  input: HTMLInputElement;
  label: HTMLElement;
}

function findTitleField(document: Document): TitleFieldElements | null {
  const input = document.querySelector<HTMLInputElement>(TITLE_INPUT);
  const row = document.querySelector<HTMLElement>(TITLE_FIELD_ROOT)?.closest('tr');
  const label = row?.querySelector<HTMLElement>(TITLE_ROW_HEADER);
  const hasTitleText = label
    ? Array.from(label.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === '제목',
    )
    : false;
  if (!input || !label || !hasTitleText) return null;
  return { input, label };
}

/** 왼쪽 카드 목록에서 선택된 양식 이름. 못 읽으면 null — 기본 문구만 쓴다 */
export function readCurrentFormName(document: Document): string | null {
  const name = document.querySelector(`${FORM_CARD_LIST} ${SELECTED_FORM_CARD} ${FORM_CARD_NAME}`);
  return normalizeFormName(name?.textContent) || null;
}

/** 카드 목록의 양식 이름들. 비어 있으면 실측한 목록으로 대신한다 */
function readFormNames(document: Document): string[] {
  const names = filterFormNames(
    [...document.querySelectorAll(`${FORM_CARD_LIST} ${FORM_CARD_NAME}`)].map((element) => element.textContent),
  );
  return names.length ? names : [...KNOWN_FORM_NAMES];
}

function replaceInputValue(input: HTMLInputElement, value: string): void {
  const inputPrototype = input.ownerDocument.defaultView?.HTMLInputElement.prototype;
  const valueSetter = inputPrototype
    ? Object.getOwnPropertyDescriptor(inputPrototype, 'value')?.set
    : undefined;

  if (valueSetter) valueSetter.call(input, value);
  else input.value = value;

  const EventConstructor = input.ownerDocument.defaultView?.Event ?? Event;
  input.dispatchEvent(new EventConstructor('input', { bubbles: true }));
  input.dispatchEvent(new EventConstructor('change', { bubbles: true }));
  input.focus();
}

const SETTINGS_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

export function createTitleAutofillRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let options: TitleAutofillOptions = normalizeTitleAutofillOptions({});
  let titleInput: HTMLInputElement | null = null;

  /** 버튼을 누르는 순간의 양식으로 고른다. 양식을 바꾼 뒤 reconcile 이 늦어도 틀리지 않게 */
  const currentText = (document: Document): string => resolveTitleText(options, readCurrentFormName(document));

  function updateButton(button: HTMLButtonElement): void {
    const document = button.ownerDocument;
    const form = readCurrentFormName(document);
    const isDisabled = currentText(document).length === 0;
    const guidance = '왼쪽 ⚙ 버튼에서 자동채움 문구를 설정하세요.';
    button.classList.toggle('is-disabled', isDisabled);
    button.setAttribute('aria-disabled', String(isDisabled));
    button.setAttribute('aria-label', isDisabled ? `자동채움 비활성화: ${guidance}` : '자동채움');
    const usesFormText = !!form && !!options.titleTextsByForm[form];
    button.title = isDisabled ? '' : `${usesFormText ? `${form} 문구` : '기본 문구'}로 제목을 채웁니다.`;
    if (isDisabled) button.dataset.innoTooltip = guidance;
    else delete button.dataset.innoTooltip;
  }

  function createButton(document: Document): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = TITLE_AUTOFILL_BUTTON_ID;
    button.type = 'button';
    button.textContent = '자동채움';
    button.setAttribute(FEATURE_ROOT_ATTRIBUTE, 'amaranth-title-autofill');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = currentText(document);
      if (titleInput && text) replaceInputValue(titleInput, text);
    });
    updateButton(button);
    return button;
  }

  function createSettingsButton(document: Document): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = TITLE_AUTOFILL_SETTINGS_BUTTON_ID;
    button.type = 'button';
    button.innerHTML = SETTINGS_ICON;
    button.title = '자동채움 문구 설정';
    button.setAttribute('aria-label', '자동채움 문구 설정');
    button.setAttribute(FEATURE_ROOT_ATTRIBUTE, 'amaranth-title-autofill-settings');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTitleAutofillModal(document, {
        options,
        currentForm: readCurrentFormName(document),
        formNames: readFormNames(document),
        save: (defaultText, entries) => setFeatureOptions(
          'amaranth',
          'titleAutofill',
          applyTitleTextEdits(options, defaultText, entries),
        ),
      });
    });
    return button;
  }

  function dispose(): void {
    if (activeDocument) {
      activeDocument.getElementById(TITLE_AUTOFILL_BUTTON_ID)?.remove();
      activeDocument.getElementById(TITLE_AUTOFILL_SETTINGS_BUTTON_ID)?.remove();
      closeTitleAutofillModal(activeDocument);
      removeTitleAutofillStyles(activeDocument);
    }
    activeDocument = null;
    titleInput = null;
  }

  return {
    id: 'titleAutofill',

    reconcile(context: PageContext, settings: FeatureSettings): void {
      if (!isTitleAutofillRoute(context.url)) {
        dispose();
        return;
      }

      const field = findTitleField(context.document);
      if (!field) {
        dispose();
        return;
      }

      activeDocument = context.document;
      titleInput = field.input;
      options = normalizeTitleAutofillOptions(settings.options);
      ensureTitleAutofillStyles(context.document);

      // 순서: [⚙] [자동채움] 제목
      let button = context.document.getElementById(TITLE_AUTOFILL_BUTTON_ID) as HTMLButtonElement | null;
      if (!button?.isConnected || button.parentElement !== field.label) {
        button?.remove();
        button = createButton(context.document);
        field.label.prepend(button);
      }
      let settingsButton = context.document.getElementById(TITLE_AUTOFILL_SETTINGS_BUTTON_ID);
      if (!settingsButton?.isConnected || settingsButton.nextElementSibling !== button) {
        settingsButton?.remove();
        settingsButton = createSettingsButton(context.document);
        button.before(settingsButton);
      }
      updateButton(button);
    },

    dispose,
  };
}
