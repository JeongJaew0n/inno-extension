import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import type { FeatureSettings } from '../../../../platform/settings/types';
import {
  TITLE_AUTOFILL_BUTTON_ID,
  TITLE_FIELD_ROOT,
  TITLE_INPUT,
  TITLE_ROW_HEADER,
} from '../../selectors';
import { isTitleAutofillRoute, normalizeTitleAutofillText } from './contracts';
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

function readTitleText(settings: FeatureSettings): string {
  return normalizeTitleAutofillText(settings.options.titleText);
}

export function createTitleAutofillRuntime(): FeatureRuntime {
  let activeDocument: Document | null = null;
  let titleText = '';
  let titleInput: HTMLInputElement | null = null;

  function updateButton(button: HTMLButtonElement): void {
    const isDisabled = titleText.length === 0;
    const guidance = '확장 프로그램 → 아마란스 → 신청서 제목 자동채움에서 내용을 설정하세요.';
    button.classList.toggle('is-disabled', isDisabled);
    button.setAttribute('aria-disabled', String(isDisabled));
    button.setAttribute(
      'aria-label',
      isDisabled ? `자동채움 비활성화: ${guidance}` : '자동채움',
    );
    button.title = isDisabled ? '' : '저장된 문구로 제목을 자동 입력합니다.';
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
      if (titleInput && titleText) replaceInputValue(titleInput, titleText);
    });
    updateButton(button);
    return button;
  }

  function dispose(): void {
    if (activeDocument) {
      activeDocument.getElementById(TITLE_AUTOFILL_BUTTON_ID)?.remove();
      removeTitleAutofillStyles(activeDocument);
    }
    activeDocument = null;
    titleInput = null;
    titleText = '';
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
      titleText = readTitleText(settings);
      ensureTitleAutofillStyles(context.document);

      let button = context.document.getElementById(TITLE_AUTOFILL_BUTTON_ID) as HTMLButtonElement | null;
      if (!button?.isConnected || button.parentElement !== field.label) {
        button?.remove();
        button = createButton(context.document);
        field.label.prepend(button);
      }
      updateButton(button);
    },

    dispose,
  };
}
