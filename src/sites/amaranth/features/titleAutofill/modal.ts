import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS, INPUT_CSS } from '../../../../platform/design/parts';
import { TITLE_AUTOFILL_MAX_LENGTH, type TitleAutofillOptions } from './contracts';

/**
 * 자동채움 문구 설정 모달.
 *
 * 화면의 버튼은 표 안이라 light DOM 이지만, 모달은 body 에 따로 띄우므로 Shadow DOM 으로 격리한다.
 * **저장만 한다.** 제목 칸을 건드리거나 신청서를 제출하지 않는다.
 *
 * docs/plans/amaranth-title-autofill-per-form/spec.md
 */

export const TITLE_AUTOFILL_MODAL_ROOT = 'amaranth-title-autofill-modal';

export interface TitleAutofillModalInput {
  options: TitleAutofillOptions;
  /** 지금 열린 양식. 못 읽었으면 null — 그때는 기본 문구와 전체 목록만 보인다 */
  currentForm: string | null;
  /** 화면에서 읽은 양식 목록 */
  formNames: readonly string[];
  /** 저장. 모은 입력을 넘긴다. 실패하면 throw 한다 */
  save(defaultText: string, entries: Array<[string, string]>): Promise<void>;
}

const STYLE = `
:host{all:initial}
.scrim{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(0,0,0,.32);font-family:var(--inno-font)}
.dialog{box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 64px);display:flex;flex-direction:column;
  border-radius:var(--inno-shape-md);background:var(--inno-surface);color:var(--inno-on-surface);box-shadow:var(--inno-shadow-3);overflow:hidden}
.head{display:flex;align-items:center;justify-content:space-between;padding:var(--inno-space-4) var(--inno-space-4) var(--inno-space-2)}
.head h2{margin:0;font-size:var(--inno-title-md);line-height:var(--inno-title-md-lh);font-weight:var(--inno-title-md-weight)}
.body{display:grid;gap:var(--inno-space-3);padding:var(--inno-space-2) var(--inno-space-4);overflow-y:auto}
.current{color:var(--inno-primary)}
details{border-top:1px solid var(--inno-outline-variant);padding-top:var(--inno-space-2)}
summary{cursor:pointer;color:var(--inno-on-surface-variant);font-size:var(--inno-label-md);font-weight:600}
.others{display:grid;gap:var(--inno-space-2);margin-top:var(--inno-space-2)}
.foot{display:flex;align-items:center;justify-content:flex-end;gap:var(--inno-space-2);padding:var(--inno-space-3) var(--inno-space-4)}
.status{margin-right:auto;font-size:var(--inno-label-md);color:var(--inno-on-surface-variant)}
.status[data-tone="fail"]{color:var(--inno-error)}
`;

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function field(label: string, name: string | null, value: string, help = ''): string {
  return `
    <label class="inno-field">
      <span class="inno-field__label">${label}</span>
      <input class="inno-input" type="text" maxlength="${TITLE_AUTOFILL_MAX_LENGTH}"
        ${name === null ? 'data-default' : `data-form="${escapeHtml(name)}"`} value="${escapeHtml(value)}" />
      ${help ? `<span class="inno-help">${help}</span>` : ''}
    </label>`;
}

/**
 * 열려 있는 모달의 닫기 함수.
 *
 * 밖에서 닫을 때도 이걸 불러야 한다. 요소만 지우면 Escape 를 잡던 `keydown` 리스너가 문서에 남아
 * 다음 Escape 한 번을 삼킨다.
 */
let closeOpenModal: (() => void) | null = null;

/** 열려 있으면 닫는다. 기능이 꺼지거나 화면을 떠날 때 부른다 */
export function closeTitleAutofillModal(document: Document): void {
  closeOpenModal?.();
  document.querySelectorAll(`[${FEATURE_ROOT_ATTRIBUTE}="${TITLE_AUTOFILL_MODAL_ROOT}"]`).forEach((host) => host.remove());
}

export function openTitleAutofillModal(document: Document, input: TitleAutofillModalInput): void {
  closeTitleAutofillModal(document);

  const { options, currentForm } = input;
  const others = input.formNames.filter((name) => name !== currentForm);

  const host = document.createElement('div');
  host.setAttribute(FEATURE_ROOT_ATTRIBUTE, TITLE_AUTOFILL_MODAL_ROOT);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${DESIGN_TOKENS}${BUTTON_CSS}${INPUT_CSS}${STYLE}</style>
    <div class="scrim" data-scrim>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="title">
        <div class="head">
          <h2 id="title">자동채움 문구</h2>
          <button type="button" class="inno-btn inno-btn--icon" data-close aria-label="닫기">✕</button>
        </div>
        <div class="body">
          ${currentForm ? field(`현재 양식 · <span class="current">${escapeHtml(currentForm)}</span>`, currentForm, options.titleTextsByForm[currentForm] ?? '', '비워 두면 아래 기본 문구를 씁니다.') : ''}
          ${field('기본 문구', null, options.titleText, '양식별 문구가 없을 때 씁니다.')}
          ${others.length ? `
            <details>
              <summary>다른 양식 (${others.length})</summary>
              <div class="others">${others.map((name) => field(escapeHtml(name), name, options.titleTextsByForm[name] ?? '')).join('')}</div>
            </details>` : ''}
        </div>
        <div class="foot">
          <span class="status" aria-live="polite"></span>
          <button type="button" class="inno-btn inno-btn--md" data-close>취소</button>
          <button type="button" class="inno-btn inno-btn--filled inno-btn--md" data-save>저장</button>
        </div>
      </div>
    </div>`;

  const close = (): void => {
    document.removeEventListener('keydown', onKeydown, true);
    host.remove();
    if (closeOpenModal === close) closeOpenModal = null;
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKeydown, true);
  closeOpenModal = close;

  shadow.querySelector('[data-scrim]')?.addEventListener('mousedown', (event) => {
    if (event.target === event.currentTarget) close();
  });
  shadow.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));

  const saveButton = shadow.querySelector<HTMLButtonElement>('[data-save]');
  const status = shadow.querySelector<HTMLElement>('.status');
  saveButton?.addEventListener('click', async () => {
    const defaultText = shadow.querySelector<HTMLInputElement>('[data-default]')?.value ?? '';
    const entries = [...shadow.querySelectorAll<HTMLInputElement>('[data-form]')]
      .map((element) => [element.dataset.form ?? '', element.value] as [string, string]);

    saveButton.disabled = true;
    if (status) { status.textContent = '저장 중…'; delete status.dataset.tone; }
    try {
      await input.save(defaultText, entries);
      close();
    } catch {
      saveButton.disabled = false;
      if (status) { status.textContent = '저장하지 못했습니다. 다시 시도하세요.'; status.dataset.tone = 'fail'; }
    }
  });

  document.body.append(host);
  // 지금 양식 칸, 없으면 기본 문구 칸에 커서를 둔다
  const first = (currentForm ? shadow.querySelector<HTMLInputElement>('.body > .inno-field [data-form]') : null)
    ?? shadow.querySelector<HTMLInputElement>('[data-default]');
  first?.focus();
}
