import type { FeatureId } from '../catalog/types';
import {
  clearCredentials,
  fetchPageAdf,
  getCredentialStatus,
  saveCredentials,
  updatePageAdf,
  type ConfluenceCredentialSummary,
  type ConfluencePageAdfDocument,
} from '../platform/messages/confluence';
import { writePlainText } from '../platform/clipboard/writePlainText';
import {
  confluenceAdfToMarkdown,
  markdownToConfluenceAdf,
  type AdfDocument,
  type MarkdownToAdfResult,
} from '../sites/confluence/adf';
import { CONFLUENCE_ORIGIN, parseConfluencePageId } from '../sites/confluence/routes';

type ConfluencePopupFeatureId = Extract<FeatureId, 'pageMarkdownExport' | 'pageMarkdownAppend'>;
type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface AppendPreview {
  page: ConfluencePageAdfDocument;
  conversion: MarkdownToAdfResult;
}

interface ConfluencePopupState {
  loaded: boolean;
  activeTabId: number | null;
  activeTabUrl: string;
  credentials: ConfluenceCredentialSummary;
  markdown: string;
  preview: AppendPreview | null;
  status: ActionStatus;
  notice: string;
  warnings: string[];
  canReload: boolean;
}

const state: ConfluencePopupState = {
  loaded: false,
  activeTabId: null,
  activeTabUrl: '',
  credentials: { email: '', hasApiToken: false },
  markdown: '',
  preview: null,
  status: 'idle',
  notice: '',
  warnings: [],
  canReload: false,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isAdfDocument(value: unknown): value is AdfDocument {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AdfDocument>;
  return candidate.type === 'doc'
    && candidate.version === 1
    && Array.isArray(candidate.content);
}

function isSupportedConfluenceTab(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === CONFLUENCE_ORIGIN
      && parsed.pathname.startsWith('/wiki/')
      && parseConfluencePageId(url) !== null;
  } catch {
    return false;
  }
}

function resetFeedback(): void {
  state.status = 'idle';
  state.notice = '';
  state.warnings = [];
  state.canReload = false;
}

function setError(error: unknown): void {
  state.status = 'error';
  state.notice = error instanceof Error ? error.message : String(error);
}

function feedbackHtml(): string {
  if (state.status === 'idle' || !state.notice) return '';
  const className = state.status === 'error' ? 'action-feedback is-error' : 'action-feedback is-success';
  return `
    <div class="${className}" role="status">
      <p>${escapeHtml(state.notice)}</p>
      ${state.canReload ? '<button type="button" data-confluence-action="reload-tab">현재 탭 새로고침</button>' : ''}
    </div>
  `;
}

function warningsHtml(warnings: string[]): string {
  if (warnings.length === 0) return '';
  return `
    <div class="action-warnings" role="status">
      <strong>확인할 내용</strong>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
    </div>
  `;
}

function credentialsHtml(): string {
  const tokenStatus = state.credentials.hasApiToken
    ? 'API 토큰이 이 Chrome 프로필에 저장되어 있습니다.'
    : '저장된 API 토큰이 없습니다.';
  return `
    <section class="confluence-api-section" aria-label="Confluence API 인증">
      <h3>Atlassian API 인증</h3>
      <p class="field-help">고정밀 변환에만 사용합니다. 토큰은 동기화되지 않지만 암호화된 비밀 저장소는 아닙니다.</p>
      <label>
        <span>계정 이메일</span>
        <input type="email" data-confluence-email value="${escapeHtml(state.credentials.email)}" placeholder="you@example.com" autocomplete="username" />
      </label>
      <label>
        <span>API 토큰</span>
        <input type="password" data-confluence-token value="" placeholder="${state.credentials.hasApiToken ? '변경할 때만 입력' : 'API 토큰 입력'}" autocomplete="current-password" />
      </label>
      <small>${escapeHtml(tokenStatus)} 토큰 값은 화면에 다시 표시하지 않습니다.</small>
      <div class="action-row">
        <button type="button" class="secondary-button" data-confluence-action="save-credentials">인증 정보 저장</button>
        <button type="button" class="secondary-button" data-confluence-action="clear-credentials" ${state.credentials.hasApiToken ? '' : 'disabled'}>삭제</button>
      </div>
    </section>
  `;
}

function contextHtml(): string {
  if (!isSupportedConfluenceTab(state.activeTabUrl)) {
    return '<p class="action-context is-warning">사용할 Confluence 문서를 현재 탭에서 열어주세요.</p>';
  }
  return `<p class="action-context">현재 탭: <code>${escapeHtml(state.activeTabUrl)}</code></p>`;
}

function exportHtml(enabled: boolean): string {
  const usable = enabled && state.credentials.hasApiToken && isSupportedConfluenceTab(state.activeTabUrl);
  return `
    <section class="confluence-api-section" aria-label="ADF Markdown 내보내기">
      <h3>현재 문서 내보내기</h3>
      ${contextHtml()}
      <p class="field-help">화면 DOM이 아니라 Confluence 원본 문서 형식(ADF)을 Markdown으로 변환합니다.</p>
      <button type="button" class="primary-action" data-confluence-action="export" ${usable && state.status !== 'loading' ? '' : 'disabled'}>
        ${state.status === 'loading' ? '변환 중…' : 'Markdown으로 복사'}
      </button>
    </section>
  `;
}

function appendPreviewHtml(): string {
  if (!state.preview) return '';
  const { page, conversion } = state.preview;
  return `
    <div class="append-preview" aria-label="본문 추가 미리보기">
      <strong>${escapeHtml(page.title)}</strong>
      <dl>
        <div><dt>페이지 ID</dt><dd>${escapeHtml(page.id)}</dd></div>
        <div><dt>상태</dt><dd>${escapeHtml(page.status)}</dd></div>
        <div><dt>추가 블록</dt><dd>${conversion.doc.content.length}개</dd></div>
      </dl>
      <p>기존 본문은 유지하고 문서 맨 아래에 추가합니다.</p>
      ${warningsHtml(conversion.warnings)}
      <button type="button" class="primary-action is-danger" data-confluence-action="append" ${state.status === 'loading' ? 'disabled' : ''}>
        ${state.status === 'loading' ? '추가 중…' : '확인하고 현재 문서에 추가'}
      </button>
    </div>
  `;
}

function appendHtml(enabled: boolean): string {
  const usable = enabled && state.credentials.hasApiToken && isSupportedConfluenceTab(state.activeTabUrl);
  return `
    <section class="confluence-api-section" aria-label="Markdown 본문 추가">
      <h3>현재 문서 맨 아래에 추가</h3>
      ${contextHtml()}
      <label>
        <span>Markdown</span>
        <textarea data-confluence-markdown rows="9" placeholder="추가할 Markdown을 입력하세요">${escapeHtml(state.markdown)}</textarea>
      </label>
      <label class="file-input-label">
        <span>.md 파일 불러오기</span>
        <input type="file" data-confluence-markdown-file accept=".md,.markdown,text/markdown" />
      </label>
      <p class="field-help">검토 단계에서는 문서를 변경하지 않습니다. 대상과 변환 경고를 확인한 뒤 한 번 더 실행합니다.</p>
      <button type="button" class="secondary-button" data-confluence-action="preview" ${usable && state.markdown.trim() && state.status !== 'loading' ? '' : 'disabled'}>
        ${state.status === 'loading' && !state.preview ? '문서 확인 중…' : '추가 내용 검토'}
      </button>
      ${appendPreviewHtml()}
    </section>
  `;
}

export async function prepareConfluencePopupState(): Promise<void> {
  if (state.loaded) return;

  const [tabs, credentials] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    getCredentialStatus().catch(() => ({ email: '', hasApiToken: false })),
  ]);
  const activeTab = tabs[0];
  state.activeTabId = activeTab?.id ?? null;
  state.activeTabUrl = activeTab?.url ?? '';
  state.credentials = credentials;
  state.loaded = true;
}

export function renderConfluenceFeatureOptions(
  featureId: ConfluencePopupFeatureId,
  enabled: boolean,
): string {
  return `
    <div class="option-fields confluence-api-options">
      ${enabled ? '' : '<p class="notice">서비스와 이 기능을 켜야 작업 버튼을 사용할 수 있습니다.</p>'}
      ${credentialsHtml()}
      ${featureId === 'pageMarkdownExport' ? exportHtml(enabled) : appendHtml(enabled)}
      ${feedbackHtml()}
      ${warningsHtml(state.warnings)}
    </div>
  `;
}

async function saveCredentialsFromPanel(email: string, token: string): Promise<void> {
  state.credentials = await saveCredentials(email, token);
  state.status = 'success';
  state.notice = '인증 정보를 저장했습니다.';
}

async function exportMarkdown(): Promise<void> {
  if (!state.activeTabUrl) throw new Error('현재 탭 URL을 확인할 수 없습니다.');
  const page = await fetchPageAdf(state.activeTabUrl);
  if (!isAdfDocument(page.adf)) throw new Error('Confluence ADF 문서 형식을 확인할 수 없습니다.');
  const result = confluenceAdfToMarkdown(page.adf);
  if (!result.markdown.trim()) throw new Error('복사할 Markdown 본문이 비어 있습니다.');
  await writePlainText(result.markdown);
  state.status = 'success';
  state.notice = `“${page.title}” 본문을 Markdown으로 복사했습니다.`;
  state.warnings = result.warnings;
}

async function previewAppend(): Promise<void> {
  if (!state.activeTabUrl) throw new Error('현재 탭 URL을 확인할 수 없습니다.');
  const conversion = markdownToConfluenceAdf(state.markdown);
  if (conversion.doc.content.length === 0) throw new Error('추가할 Markdown 내용이 없습니다.');
  const page = await fetchPageAdf(state.activeTabUrl);
  if (!isAdfDocument(page.adf)) throw new Error('Confluence ADF 문서 형식을 확인할 수 없습니다.');
  if (page.status !== 'current' && page.status !== 'draft') {
    throw new Error('현재 문서 또는 초안 상태에서만 본문을 추가할 수 있습니다.');
  }
  state.preview = { page, conversion };
  state.status = 'success';
  state.notice = '대상 문서와 변환 결과를 확인했습니다. 아직 문서는 변경되지 않았습니다.';
}

async function appendMarkdown(): Promise<void> {
  if (!state.preview) throw new Error('먼저 추가할 내용을 검토하세요.');
  if (state.activeTabId === null) throw new Error('현재 탭을 확인할 수 없습니다.');
  const { page, conversion } = state.preview;
  if (!isAdfDocument(page.adf)) throw new Error('Confluence ADF 문서 형식을 확인할 수 없습니다.');

  const confirmed = window.confirm(
    `“${page.title}” 문서의 맨 아래에 ${conversion.doc.content.length}개 블록을 추가합니다. 계속할까요?`,
  );
  if (!confirmed) {
    state.status = 'idle';
    state.notice = '';
    return;
  }

  const adf: AdfDocument = {
    ...page.adf,
    content: [...page.adf.content, ...conversion.doc.content],
  };
  await updatePageAdf({
    pageId: page.id,
    pageUrl: state.activeTabUrl,
    tabId: state.activeTabId,
    title: page.title,
    status: page.status,
    currentVersion: page.version,
    adf,
  });
  state.markdown = '';
  state.preview = null;
  state.status = 'success';
  state.notice = '현재 문서 맨 아래에 Markdown 내용을 추가했습니다. 탭을 새로고침해 확인하세요.';
  state.warnings = conversion.warnings;
  state.canReload = true;
}

export async function handleConfluencePopupAction(
  target: HTMLElement,
  rerender: () => Promise<void>,
): Promise<boolean> {
  const action = target.dataset.confluenceAction;
  if (!action) return false;

  const panel = target.closest<HTMLElement>('.confluence-api-options');
  const pendingCredentials = action === 'save-credentials' && panel
    ? {
      email: panel.querySelector<HTMLInputElement>('[data-confluence-email]')?.value ?? '',
      token: panel.querySelector<HTMLInputElement>('[data-confluence-token]')?.value ?? '',
    }
    : null;
  resetFeedback();
  state.status = 'loading';
  await rerender();

  try {
    switch (action) {
      case 'save-credentials':
        if (!pendingCredentials) throw new Error('인증 설정 영역을 찾을 수 없습니다.');
        await saveCredentialsFromPanel(pendingCredentials.email, pendingCredentials.token);
        break;
      case 'clear-credentials':
        await clearCredentials();
        state.credentials = { email: '', hasApiToken: false };
        state.status = 'success';
        state.notice = '저장된 Confluence 인증 정보를 삭제했습니다.';
        break;
      case 'export':
        await exportMarkdown();
        break;
      case 'preview':
        await previewAppend();
        break;
      case 'append':
        await appendMarkdown();
        break;
      case 'reload-tab':
        if (state.activeTabId !== null) await chrome.tabs.reload(state.activeTabId);
        state.status = 'success';
        state.notice = '현재 탭을 새로고침했습니다.';
        state.canReload = false;
        break;
      default:
        state.status = 'idle';
        return false;
    }
  } catch (error) {
    setError(error);
  }

  await rerender();
  return true;
}

export function handleConfluencePopupInput(target: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (!target.hasAttribute('data-confluence-markdown')) return false;
  state.markdown = target.value;
  state.preview = null;
  resetFeedback();
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
    state.preview = null;
    state.status = 'success';
    state.notice = `${file.name} 내용을 불러왔습니다.`;
  } catch (error) {
    setError(error);
  }
  await rerender();
  return true;
}
