import {
  markdownToConfluenceAdf,
  type MarkdownToAdfResult,
} from '../sites/confluence/adf';

type ActionStatus = 'idle' | 'success' | 'error';

interface ConfluenceConverterState {
  markdown: string;
  conversion: MarkdownToAdfResult | null;
  status: ActionStatus;
  notice: string;
}

const state: ConfluenceConverterState = {
  markdown: '',
  conversion: null,
  status: 'idle',
  notice: '',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setError(error: unknown): void {
  state.status = 'error';
  state.notice = error instanceof Error ? error.message : String(error);
}

function feedbackHtml(): string {
  if (state.status === 'idle' || !state.notice) return '';
  const className = state.status === 'error' ? 'action-feedback is-error' : 'action-feedback is-success';
  return `<p class="${className}" role="status">${escapeHtml(state.notice)}</p>`;
}

function warningsHtml(warnings: string[]): string {
  if (warnings.length === 0) return '';
  return `
    <div class="action-warnings" role="status">
      <strong>변환 경고</strong>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
    </div>
  `;
}

function resultHtml(): string {
  if (!state.conversion) return '';

  const { doc, mermaidCount, warnings } = state.conversion;
  return `
    <section class="converter-result" data-confluence-result aria-label="ADF 변환 결과">
      <div class="converter-result-heading">
        <h3>ADF JSON</h3>
        <span>최상위 블록 ${doc.content.length}개 · Mermaid ${mermaidCount}개 · 경고 ${warnings.length}개</span>
      </div>
      <textarea class="adf-output" rows="16" readonly spellcheck="false" aria-label="변환된 ADF JSON">${escapeHtml(JSON.stringify(doc, null, 2))}</textarea>
      ${warningsHtml(warnings)}
    </section>
  `;
}

export function renderConfluenceFeatureOptions(enabled: boolean): string {
  return `
    <div class="option-fields confluence-converter-options" data-confluence-converter-enabled="${enabled}">
      ${enabled ? '' : '<p class="notice">서비스와 이 기능을 켜야 변환할 수 있습니다.</p>'}
      <div class="editor-converter-guide">
        <strong>Confluence 편집 화면</strong>
        <p><code>edit-v2</code> 편집기 toolbar의 변환 버튼으로 본문의 Markdown 원문을 편집 콘텐츠로 바꿀 수 있습니다. 이미 서식화된 본문은 변환하지 않습니다.</p>
      </div>
      <section class="confluence-converter-section" aria-label="Markdown ADF 변환기">
        <label>
          <span>Markdown</span>
          <textarea class="markdown-input" data-confluence-markdown rows="10" placeholder="ADF로 변환할 Markdown을 입력하세요">${escapeHtml(state.markdown)}</textarea>
        </label>
        <label class="file-input-label">
          <span>.md 파일 불러오기</span>
          <input type="file" data-confluence-markdown-file accept=".md,.markdown,text/markdown" />
        </label>
        <p class="field-help">이 Popup 입력은 브라우저 안에서만 변환되며 Confluence 문서를 조회하거나 변경하지 않습니다.</p>
        <button type="button" class="primary-action" data-confluence-action="convert" ${enabled && state.markdown.trim() ? '' : 'disabled'}>ADF로 변환</button>
      </section>
      ${feedbackHtml()}
      ${resultHtml()}
    </div>
  `;
}

function convertMarkdown(): void {
  if (!state.markdown.trim()) throw new Error('변환할 Markdown을 입력하세요.');

  const conversion = markdownToConfluenceAdf(state.markdown);
  if (conversion.doc.content.length === 0) {
    throw new Error('변환 가능한 Markdown 내용이 없습니다.');
  }

  state.conversion = conversion;
  state.status = 'success';
  state.notice = 'Markdown을 ADF로 변환했습니다.';
}

export async function handleConfluencePopupAction(
  target: HTMLElement,
  rerender: () => Promise<void>,
): Promise<boolean> {
  const action = target.dataset.confluenceAction;
  if (!action) return false;
  if (action !== 'convert') return false;

  state.status = 'idle';
  state.notice = '';
  try {
    convertMarkdown();
  } catch (error) {
    state.conversion = null;
    setError(error);
  }

  await rerender();
  return true;
}

export function handleConfluencePopupInput(target: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (!target.hasAttribute('data-confluence-markdown')) return false;

  state.markdown = target.value;
  state.conversion = null;
  state.status = 'idle';
  state.notice = '';

  const panel = target.closest<HTMLElement>('.confluence-converter-options');
  const convertButton = panel?.querySelector<HTMLButtonElement>('[data-confluence-action="convert"]');
  if (convertButton) {
    const enabled = panel?.dataset.confluenceConverterEnabled === 'true';
    convertButton.disabled = !enabled || !state.markdown.trim();
  }
  panel?.querySelector<HTMLElement>('[data-confluence-result]')?.setAttribute('hidden', '');
  panel?.querySelector<HTMLElement>('.action-feedback')?.setAttribute('hidden', '');
  return true;
}

export async function handleConfluencePopupFile(
  target: HTMLInputElement,
  rerender: () => Promise<void>,
): Promise<boolean> {
  if (!target.hasAttribute('data-confluence-markdown-file')) return false;
  const file = target.files?.[0];
  if (!file) return true;

  try {
    state.markdown = await file.text();
    state.conversion = null;
    state.status = 'success';
    state.notice = `${file.name} 내용을 불러왔습니다.`;
  } catch (error) {
    setError(error);
  }
  await rerender();
  return true;
}
