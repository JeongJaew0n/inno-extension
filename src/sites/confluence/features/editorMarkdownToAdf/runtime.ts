import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { parseConfluenceEditPageUrl } from '../../routes';
import {
  EDITOR_BODY,
  EDITOR_CODE_BLOCK,
  EDITOR_MARKDOWN_TO_ADF_ROOT,
  EDITOR_PRIMARY_TOOLBAR,
} from '../../selectors';
import type { CodeBlockAdfPayload } from './code-block-to-adf';
import { readConfluenceCodeBlockText } from './code-block';
import {
  buildConfluenceMermaidReplacementHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  isMermaidCodeBlockSource,
} from './mermaid';

const MERMAID_EXTENSION_INSERT_TIMEOUT_MS = 3000;

/**
 * Markdown -> ADF 변환기를 클릭 시점에 불러온다.
 *
 * 이 모듈은 `marked` 파서를 끌어오며 번들에서 47KB를 차지한다. 정적으로 import하면
 * Confluence 모든 `/wiki/*` 페이지에서 파싱·평가되는데, 실제로 필요한 조건은
 * `Markdown -> ADF` 기능이 켜져 있고(기본값 OFF) 사용자가 `edit-v2` 화면에서 변환
 * 버튼을 누른 경우뿐이다. 문서를 읽기만 하는 사용자는 한 번도 쓰지 않는다.
 *
 * 모듈 평가는 한 번만 일어나고 이후 호출은 같은 Promise를 재사용한다.
 */
let codeBlockConverterPromise: Promise<
  (markdown: string) => CodeBlockAdfPayload
> | null = null;

function loadCodeBlockConverter(): Promise<(markdown: string) => CodeBlockAdfPayload> {
  codeBlockConverterPromise ??= import('./code-block-to-adf')
    .then((module) => module.codeBlockMarkdownToAdfPayload)
    .catch((error) => {
      // 실패한 Promise를 남겨두면 이후 시도가 모두 같은 오류로 막힌다.
      codeBlockConverterPromise = null;
      throw error;
    });
  return codeBlockConverterPromise;
}
const PROSEMIRROR_SELECTION_TIMEOUT_MS = 1000;
const PROSEMIRROR_SELECT_REQUEST_EVENT = 'inno-extension:confluence:select-prosemirror-node';
const PROSEMIRROR_SELECT_RESPONSE_EVENT = 'inno-extension:confluence:select-prosemirror-node-result';

type ProseMirrorBridgeAction = 'read-node' | 'select-node';

interface ProseMirrorBridgeResponse {
  requestId?: unknown;
  success?: unknown;
  message?: unknown;
  text?: unknown;
}

async function requestProseMirrorBridge(
  editor: HTMLElement,
  action: ProseMirrorBridgeAction,
  node?: HTMLElement,
): Promise<ProseMirrorBridgeResponse> {
  const localId = node?.dataset.localId;
  if (!localId) throw new Error('Confluence codeBlock 식별자를 찾을 수 없습니다.');
  const document = editor.ownerDocument;
  const requestId = crypto.randomUUID();

  return new Promise<ProseMirrorBridgeResponse>((resolve, reject) => {
    const finish = (error?: Error): void => {
      document.removeEventListener(PROSEMIRROR_SELECT_RESPONSE_EVENT, onResponse);
      window.clearTimeout(timer);
      if (error) reject(error);
    };
    const onResponse = (event: Event): void => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      let detail: ProseMirrorBridgeResponse;
      try {
        detail = JSON.parse(event.detail) as ProseMirrorBridgeResponse;
      } catch {
        return;
      }
      if (detail.requestId !== requestId) return;
      if (detail.success === true) {
        finish();
        resolve(detail);
      } else {
        finish(new Error(
          typeof detail.message === 'string'
            ? detail.message
            : 'Confluence 편집기 상태 처리에 실패했습니다.',
        ));
      }
    };
    const timer = window.setTimeout(
      () => finish(new Error('Confluence 편집기 상태 브리지가 응답하지 않았습니다.')),
      PROSEMIRROR_SELECTION_TIMEOUT_MS,
    );

    document.addEventListener(PROSEMIRROR_SELECT_RESPONSE_EVENT, onResponse);
    document.dispatchEvent(new CustomEvent(PROSEMIRROR_SELECT_REQUEST_EVENT, {
      detail: JSON.stringify({ action, requestId, localId }),
    }));
  });
}

async function selectEditorNode(editor: HTMLElement, node: HTMLElement): Promise<void> {
  await requestProseMirrorBridge(editor, 'select-node', node);
}

async function readProseMirrorCodeBlockText(
  editor: HTMLElement,
  codeBlock: HTMLElement,
): Promise<string> {
  const response = await requestProseMirrorBridge(editor, 'read-node', codeBlock);
  if (typeof response.text !== 'string') {
    throw new Error('Confluence codeBlock 전체 원문을 읽지 못했습니다.');
  }
  return response.text.replace(/\r\n?/g, '\n');
}

export interface CodeBlockSource {
  codeBlock: HTMLElement;
  index: number;
  localId: string;
  source: string;
}

export interface CodeBlockSourceReadResult {
  failures: Array<{ index: number; message: string }>;
  sources: CodeBlockSource[];
}

/**
 * codeBlock 원문을 순차로 읽는다.
 *
 * 이전에는 문서의 모든 코드블럭을 `Promise.all`로 동시에 읽었다. 브리지 응답 타임아웃이
 * 1000ms이므로 코드블럭이 많은 문서에서는 요청이 몰려 하나만 늦어도 전체가 실패했다.
 * 순차 실행으로 그 경합을 없애고, 개별 실패는 건너뛴 뒤 호출자가 판단하도록 남긴다.
 */
export async function readCodeBlockSources(
  editor: HTMLElement,
  entries: Array<{ codeBlock: HTMLElement; index: number }>,
  readSource: (
    editor: HTMLElement,
    codeBlock: HTMLElement,
  ) => Promise<string> = readProseMirrorCodeBlockText,
): Promise<CodeBlockSourceReadResult> {
  const sources: CodeBlockSource[] = [];
  const failures: Array<{ index: number; message: string }> = [];

  for (const { codeBlock, index } of entries) {
    try {
      sources.push({
        codeBlock,
        index,
        localId: codeBlock.dataset.localId ?? '',
        source: await readSource(editor, codeBlock),
      });
    } catch (error) {
      failures.push({
        index,
        message: error instanceof Error ? error.message : 'codeBlock 원문을 읽지 못했습니다.',
      });
    }
  }

  return { failures, sources };
}

/**
 * 브리지로 원문을 읽기 전에 DOM 원문으로 Mermaid 후보를 좁힌다.
 *
 * DOM 원문을 읽을 수 없는 코드블럭은 판정을 보류하고 후보로 남긴다. 잘못 걸러내면 변환 대상이
 * 사라지므로 확실히 Mermaid가 아닌 경우에만 제외한다.
 */
export function mayBeMermaidCodeBlock(codeBlock: HTMLElement): boolean {
  const domSource = readConfluenceCodeBlockText(codeBlock);
  if (!domSource.trim()) return true;
  return isMermaidCodeBlockSource(domSource);
}

const CONVERSION_FAILURE_CAUSES: ReadonlyArray<{ cause: string; match: RegExp }> = [
  { cause: '기존 컴포넌트 정리 필요', match: /^문서 다른 위치에/ },
  { cause: '편집기 응답 없음', match: /브리지가 응답하지 않았습니다/ },
  { cause: '교체 확인 실패', match: /원래 위치의 컴포넌트로 교체하지 못했습니다/ },
  { cause: '되돌리기 실패', match: /자동 되돌리기도 실패했습니다/ },
  { cause: '원문 읽기 실패', match: /원문을 (?:읽지 못했|찾을 수 없)습니다/ },
  { cause: '블록 선택 실패', match: /선택이 적용되지 않았습니다/ },
  { cause: '편집기 미발견', match: /편집 본문을 찾을 수 없습니다|편집기 상태를 찾을 수 없습니다/ },
  { cause: '블록 식별 실패', match: /codeBlock (?:식별자|위치)를 찾을 수 없습니다/ },
];

/**
 * 실패 라벨에 덧붙일 짧은 원인을 찾는다.
 *
 * `변환 실패` 한 문구는 서로 다른 실패 분기를 모두 같은 모습으로 만든다. tooltip을 열지 않고도
 * 어느 단계에서 막혔는지 구분할 수 있게 한다.
 */
export function summarizeConversionFailure(message: string): string | null {
  return CONVERSION_FAILURE_CAUSES.find(({ match }) => match.test(message))?.cause ?? null;
}

function findCodeBlockByLocalId(
  editor: HTMLElement,
  localId: string,
): HTMLElement | undefined {
  return Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK))
    .find((codeBlock) => codeBlock.dataset.localId === localId);
}

function waitForEditorChange(
  editor: HTMLElement,
  didChange: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  if (didChange()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (changed: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(changed);
    };
    const observer = new MutationObserver(() => {
      if (didChange()) finish(true);
    });
    const timer = window.setTimeout(() => finish(didChange()), timeoutMs);
    observer.observe(editor, { childList: true, subtree: true, attributes: true });
  });
}

async function pasteAndWaitForChange(
  editor: HTMLElement,
  html: string,
  plainText: string,
  didChange: () => boolean,
  failureMessage: string,
): Promise<void> {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/html', html);
  clipboardData.setData('text/plain', plainText);

  editor.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData,
  }));

  if (!await waitForEditorChange(editor, didChange, MERMAID_EXTENSION_INSERT_TIMEOUT_MS)) {
    throw new Error(failureMessage);
  }
}

async function rollbackEditorChange(
  editor: HTMLElement,
  beforeHtml: string,
): Promise<boolean> {
  const undoButton = editor.ownerDocument.querySelector<HTMLButtonElement>(
    '[data-testid="ak-editor-toolbar-button-undo"]',
  );
  if (!undoButton || undoButton.disabled) return false;
  undoButton.click();
  return waitForEditorChange(
    editor,
    () => editor.innerHTML === beforeHtml,
    MERMAID_EXTENSION_INSERT_TIMEOUT_MS,
  );
}

async function replaceCodeBlockWithAdf(
  editor: HTMLElement,
  localId: string,
  html: string,
  markdown: string,
): Promise<void> {
  const codeBlock = findCodeBlockByLocalId(editor, localId);
  if (!codeBlock) throw new Error('변환할 코드블럭의 현재 위치를 찾을 수 없습니다.');
  await selectEditorNode(editor, codeBlock);
  const beforePasteHtml = editor.innerHTML;
  try {
    await pasteAndWaitForChange(
      editor,
      html,
      markdown,
      () => !codeBlock.isConnected,
      '코드블럭을 원래 위치의 ADF 내용으로 교체하지 못했습니다.',
    );
  } catch (error) {
    if (editor.innerHTML !== beforePasteHtml
      && !await rollbackEditorChange(editor, beforePasteHtml)) {
      throw new Error('코드블럭 -> ADF 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Confluence 실행 취소를 한 번 눌러주세요.');
    }
    throw error;
  }
}

function isMermaidExtension(node: Element): boolean {
  const extensionKey = node.getAttribute('extensionkey')
    ?? node.getAttribute('data-extension-key');
  return node.getAttribute('data-prosemirror-node-name') === 'extension'
    && extensionKey === CONFLUENCE_MERMAID_EXTENSION_KEY;
}

function countMermaidExtensions(editor: HTMLElement): number {
  return Array.from(editor.querySelectorAll<HTMLElement>(
    '[data-prosemirror-node-name="extension"]',
  )).filter(isMermaidExtension).length;
}

function findMermaidExtensionByLocalId(
  editor: HTMLElement,
  localId: string,
): HTMLElement | undefined {
  return Array.from(
    editor.querySelectorAll<HTMLElement>('[data-prosemirror-node-name="extension"]'),
  ).find((extension) => (
    extension.getAttribute('localid') === localId
    || extension.getAttribute('data-local-id') === localId
  ));
}

const EDITOR_EXPAND = '[data-prosemirror-node-name="expand"], [data-prosemirror-node-name="nestedExpand"]';

function isCollapsedMermaidSource(codeBlock: HTMLElement): boolean {
  return Boolean(codeBlock.closest(EDITOR_EXPAND));
}

/**
 * Mermaid 코드블럭을 교체할 때 실제로 선택할 노드를 고른다.
 *
 * 보통은 코드블럭 자신이다. 다만 코드블럭이 `expand` 안에 **홀로** 들어 있으면 그 `expand`를
 * 통째로 교체 단위로 삼는다.
 *
 * Confluence는 expand를 중첩할 수 없다. expand 안의 코드블럭 자리에 `extension + expand(원본)`을
 * 붙여넣으면 새 expand가 `nestedExpand`로 강등되고, 새 extension과 원본이 같은 top-level 노드에
 * 갇혀 `isMermaidReplacementAtOriginalPosition()`의 형제 비교가 영구히 거짓이 된다. 3초 타임아웃
 * 뒤 되돌아갈 뿐 절대 성공하지 못한다.
 *
 * 코드블럭 말고 다른 내용이 함께 든 expand는 건드리지 않는다. 통째로 교체하면 그 내용이 사라진다.
 * 그 경우는 종전대로 변환에 실패하고 되돌아간다 — 내용을 잃는 것보다 낫다.
 *
 * docs/issue/2026-09-02-mermaid-conversion-fails-inside-expand.md
 */
function resolveMermaidReplacementTarget(
  editor: HTMLElement,
  codeBlock: HTMLElement,
): HTMLElement {
  const expand = codeBlock.closest<HTMLElement>(EDITOR_EXPAND);
  if (!expand || !editor.contains(expand)) return codeBlock;

  const innerNodes = Array.from(
    expand.querySelectorAll<HTMLElement>('[data-prosemirror-node-name]'),
  );
  return innerNodes.length === 1 && innerNodes[0] === codeBlock ? expand : codeBlock;
}

function hasValidMermaidPair(editor: HTMLElement, codeBlock: HTMLElement): boolean {
  if (!isCollapsedMermaidSource(codeBlock)) return false;

  const sourceTopLevel = findEditorTopLevelNode(editor, codeBlock);
  const precedingTopLevel = sourceTopLevel?.previousElementSibling;
  return Boolean(precedingTopLevel && isMermaidExtension(precedingTopLevel));
}

function findEditorTopLevelNode(editor: HTMLElement, node: HTMLElement): HTMLElement | null {
  let current = node;
  while (current.parentElement && current.parentElement !== editor) {
    current = current.parentElement;
  }
  return current.parentElement === editor ? current : null;
}

function matchesMermaidSourceAtIndex(
  editor: HTMLElement,
  codeBlockIndex: number,
  source: string,
  requireCollapsed: boolean,
): boolean {
  const codeBlock = editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK)[codeBlockIndex];
  return Boolean(
    codeBlock
    && readConfluenceCodeBlockText(codeBlock) === source
    && (!requireCollapsed || isCollapsedMermaidSource(codeBlock)),
  );
}

function isMermaidReplacementAtOriginalPosition(
  editor: HTMLElement,
  codeBlockIndex: number,
  localId: string,
  source: string,
): boolean {
  const extension = findMermaidExtensionByLocalId(editor, localId);
  const codeBlock = editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK)[codeBlockIndex];
  if (!extension || !codeBlock
    || readConfluenceCodeBlockText(codeBlock) !== source
    || !isCollapsedMermaidSource(codeBlock)) return false;

  const extensionTopLevel = findEditorTopLevelNode(editor, extension);
  const sourceTopLevel = findEditorTopLevelNode(editor, codeBlock);
  return Boolean(
    extensionTopLevel
    && sourceTopLevel
    && extensionTopLevel.nextElementSibling === sourceTopLevel,
  );
}

async function rollbackMermaidReplacement(
  editor: HTMLElement,
  codeBlockIndex: number,
  localId: string,
  source: string,
): Promise<boolean> {
  const undoButton = editor.ownerDocument.querySelector<HTMLButtonElement>(
    '[data-testid="ak-editor-toolbar-button-undo"]',
  );
  if (!undoButton || undoButton.disabled) return false;
  undoButton.click();

  return waitForEditorChange(
    editor,
    () => (
      !findMermaidExtensionByLocalId(editor, localId)
      && matchesMermaidSourceAtIndex(editor, codeBlockIndex, source, false)
    ),
    MERMAID_EXTENSION_INSERT_TIMEOUT_MS,
  );
}

async function replaceMermaidCodeBlock(
  editor: HTMLElement,
  codeBlock: HTMLElement,
  codeBlockIndex: number,
  source: string,
): Promise<void> {
  const localId = crypto.randomUUID();
  const html = buildConfluenceMermaidReplacementHtml(codeBlockIndex, localId, source);
  const didReplaceSource = (): boolean => (
    !codeBlock.isConnected
    && isMermaidReplacementAtOriginalPosition(editor, codeBlockIndex, localId, source)
  );

  await selectEditorNode(editor, resolveMermaidReplacementTarget(editor, codeBlock));
  try {
    await pasteAndWaitForChange(
      editor,
      html,
      source,
      didReplaceSource,
      'Mermaid 코드블럭을 원래 위치의 컴포넌트로 교체하지 못했습니다.',
    );
  } catch (error) {
    const changed = !codeBlock.isConnected || Boolean(findMermaidExtensionByLocalId(editor, localId));
    if (changed && !await rollbackMermaidReplacement(editor, codeBlockIndex, localId, source)) {
      throw new Error('Mermaid 변환 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Confluence 실행 취소를 한 번 눌러주세요.');
    }
    throw error;
  }
}

export function createEditorMarkdownToAdfRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  const feedbackTimers = new Set<number>();

  function dispose(): void {
    feedbackTimers.forEach((timer) => window.clearTimeout(timer));
    feedbackTimers.clear();
    host?.remove();
    host = null;
  }

  function createButtonHost(
    context: PageContext,
    toolbar: HTMLElement,
    pageId: string,
  ): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, EDITOR_MARKDOWN_TO_ADF_ROOT);
    nextHost.dataset.pageId = pageId;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.marginInlineStart = '4px';
    nextHost.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          box-sizing: border-box; min-height: 32px; padding: 0 10px; border: 0;
          border-radius: 3px; background: transparent; color: #172b4d; cursor: pointer;
          font: inherit; font-size: 13px; font-weight: 500; line-height: 32px; white-space: nowrap;
        }
        svg { width: 16px; height: 16px; flex: 0 0 auto; }
        button:hover { background: #091e420f; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
        button:disabled { cursor: default; opacity: 0.72; }
        .divider { width: 1px; height: 20px; margin: 0 2px; background: #dfe1e6; }
      </style>
      <button type="button" data-action="mermaid" aria-label="Mermaid -> ADF 변환">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 4v4"></path><path d="M17 4v4"></path><path d="M5 8h14"></path>
          <path d="M6 12h4l2 3 2-3h4"></path><path d="M12 15v5"></path>
        </svg>
        <span data-mermaid-label>Mermaid -&gt; ADF</span>
      </button>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" data-action="code-block-adf" aria-label="코드블럭 -> ADF">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h10"></path><path d="m11 4 3 3-3 3"></path>
          <path d="M20 17H10"></path><path d="m13 14-3 3 3 3"></path>
        </svg>
        <span data-code-block-adf-label>코드블럭 -&gt; ADF</span>
      </button>
    `;

    const codeBlockAdfButton = shadow.querySelector<HTMLButtonElement>('[data-action="code-block-adf"]');
    const codeBlockAdfLabel = shadow.querySelector<HTMLElement>('[data-code-block-adf-label]');
    const mermaidButton = shadow.querySelector<HTMLButtonElement>('[data-action="mermaid"]');
    const mermaidLabel = shadow.querySelector<HTMLElement>('[data-mermaid-label]');
    if (!codeBlockAdfButton || !codeBlockAdfLabel || !mermaidButton || !mermaidLabel) return null;

    const buttons = [codeBlockAdfButton, mermaidButton];
    const setBusy = (busy: boolean): void => {
      buttons.forEach((button) => { button.disabled = busy; });
    };
    const resetLater = (button: HTMLButtonElement, label: HTMLElement, text: string): void => {
      const timer = window.setTimeout(() => {
        feedbackTimers.delete(timer);
        if (nextHost.isConnected) {
          setBusy(false);
          label.textContent = text;
          button.removeAttribute('title');
        }
      }, 2200);
      feedbackTimers.add(timer);
    };

    codeBlockAdfButton.addEventListener('click', async () => {
      setBusy(true);
      codeBlockAdfLabel.textContent = '변환 중';
      codeBlockAdfButton.removeAttribute('title');
      let convertedCount = 0;

      try {
        const currentEditor = context.document.querySelector<HTMLElement>(EDITOR_BODY);
        if (!currentEditor) throw new Error('Confluence 편집 본문을 찾을 수 없습니다.');

        const codeBlocks = Array.from(
          currentEditor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK),
        ).map((codeBlock, index) => ({ codeBlock, index }));
        if (codeBlocks.length === 0) throw new Error('ADF로 변환할 코드블럭이 없습니다.');

        const protectedMermaidCount = codeBlocks.filter(({ codeBlock }) => (
          hasValidMermaidPair(currentEditor, codeBlock)
        )).length;
        // 보호 대상은 읽지 않는다. 변환하지 않을 블록까지 읽으면 브리지 요청만 늘어난다.
        const { failures, sources } = await readCodeBlockSources(
          currentEditor,
          codeBlocks.filter(({ codeBlock }) => !hasValidMermaidPair(currentEditor, codeBlock)),
        );
        const convertMarkdown = await loadCodeBlockConverter();
        const candidates = sources.map(({ index, localId, source }) => ({
          index,
          localId,
          payload: convertMarkdown(source),
        }));
        if (candidates.length === 0) {
          if (failures.length > 0) {
            throw new Error(`코드블럭 ${failures.length}개의 원문을 읽지 못했습니다. ${failures[0].message}`);
          }
          throw new Error('ADF로 변환할 코드블럭이 없습니다. Mermaid 컴포넌트 원본은 보호됩니다.');
        }

        const warnings = candidates.flatMap(({ index, payload }) => (
          payload.warnings.map((warning) => `코드블럭 ${index + 1}: ${warning}`)
        ));
        for (const { localId, payload } of candidates.reverse()) {
          await replaceCodeBlockWithAdf(
            currentEditor,
            localId,
            payload.html,
            payload.markdown,
          );
          convertedCount += 1;
        }

        codeBlockAdfLabel.textContent = failures.length > 0
          ? `${convertedCount}개 변환 · 제외 ${failures.length}`
          : warnings.length > 0
            ? `${convertedCount}개 변환 · 경고 ${warnings.length}`
            : `${convertedCount}개 변환`;
        const notices = [
          ...warnings,
          ...(protectedMermaidCount > 0
            ? [`Mermaid 컴포넌트 원본 ${protectedMermaidCount}개는 제외했습니다.`]
            : []),
          ...(failures.length > 0
            ? [`원문을 읽지 못해 제외한 코드블럭 ${failures.length}개: ${failures.map(({ index }) => index + 1).join(', ')}번`]
            : []),
        ];
        if (notices.length > 0) {
          codeBlockAdfButton.title = notices.join('\n');
          console.warn('[Inno Extension] Confluence 코드블럭 -> ADF 변환 안내', notices);
        }
      } catch (error) {
        console.error('[Inno Extension] Confluence 코드블럭 -> ADF 변환 실패', error);
        const message = error instanceof Error ? error.message : '코드블럭을 ADF로 변환하지 못했습니다.';
        const cause = summarizeConversionFailure(message);
        codeBlockAdfLabel.textContent = convertedCount > 0
          ? `${convertedCount}개 변환 · 일부 실패`
          : cause ? `변환 실패 · ${cause}` : '변환 실패';
        codeBlockAdfButton.title = message;
      }

      resetLater(codeBlockAdfButton, codeBlockAdfLabel, '코드블럭 -> ADF');
    });

    mermaidButton.addEventListener('click', async () => {
      setBusy(true);
      mermaidLabel.textContent = '변환 중';
      mermaidButton.removeAttribute('title');
      let convertedCount = 0;

      try {
        const currentEditor = context.document.querySelector<HTMLElement>(EDITOR_BODY);
        if (!currentEditor) throw new Error('Confluence 편집 본문을 찾을 수 없습니다.');

        const allCodeBlocks = Array.from(
          currentEditor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK),
        ).map((codeBlock, index) => ({ codeBlock, index }));

        // 브리지 요청을 Mermaid 후보로 한정한다. 문서 전체를 읽으면 실패 표면만 넓어진다.
        const mermaidCandidateBlocks = allCodeBlocks.filter(
          ({ codeBlock }) => mayBeMermaidCodeBlock(codeBlock),
        );
        // 짝 판정은 DOM 구조만 사용하므로 원문 읽기 성공 여부와 무관하게 계산한다.
        const pairedCount = mermaidCandidateBlocks.filter(
          ({ codeBlock }) => hasValidMermaidPair(currentEditor, codeBlock),
        ).length;
        const unpairedExtensionCount = countMermaidExtensions(currentEditor) - pairedCount;

        if (unpairedExtensionCount > 0) {
          throw new Error(`문서 다른 위치에 Mermaid 컴포넌트 ${unpairedExtensionCount}개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.`);
        }

        const { failures, sources } = await readCodeBlockSources(
          currentEditor,
          mermaidCandidateBlocks.filter(
            ({ codeBlock }) => !hasValidMermaidPair(currentEditor, codeBlock),
          ),
        );
        const candidates = sources.filter(({ source }) => isMermaidCodeBlockSource(source));

        if (candidates.length === 0) {
          if (failures.length > 0) {
            throw new Error(`Mermaid 후보 코드블럭 ${failures.length}개의 원문을 읽지 못했습니다. ${failures[0].message}`);
          }
          throw new Error('변환할 Mermaid 코드블럭이 없습니다.');
        }

        for (const { codeBlock, index, source } of candidates.reverse()) {
          await replaceMermaidCodeBlock(currentEditor, codeBlock, index, source);
          convertedCount += 1;
        }

        mermaidLabel.textContent = failures.length > 0
          ? `${convertedCount}개 변환 · 제외 ${failures.length}`
          : `${convertedCount}개 변환`;
        if (failures.length > 0) {
          const notice = `원문을 읽지 못해 제외한 코드블럭 ${failures.length}개: ${failures.map(({ index }) => index + 1).join(', ')}번`;
          mermaidButton.title = notice;
          console.warn('[Inno Extension] Confluence Mermaid -> ADF 변환 안내', notice, failures);
        }
      } catch (error) {
        console.error('[Inno Extension] Confluence Mermaid -> ADF 변환 실패', error);
        const message = error instanceof Error ? error.message : 'Mermaid를 변환하지 못했습니다.';
        const cause = summarizeConversionFailure(message);
        mermaidLabel.textContent = convertedCount > 0
          ? `${convertedCount}개 변환 · 일부 실패`
          : message.startsWith('변환할 Mermaid') ? '변환 대상 없음'
            : cause ? `변환 실패 · ${cause}` : '변환 실패';
        mermaidButton.title = message;
      }

      resetLater(mermaidButton, mermaidLabel, 'Mermaid -> ADF');
    });

    toolbar.append(nextHost);
    return nextHost;
  }

  return {
    id: 'pageMarkdownAppend',

    reconcile(context: PageContext): void {
      const route = parseConfluenceEditPageUrl(context.url);
      if (!route) {
        dispose();
        return;
      }

      const toolbar = context.document.querySelector<HTMLElement>(EDITOR_PRIMARY_TOOLBAR);
      const editor = context.document.querySelector<HTMLElement>(EDITOR_BODY);
      if (!toolbar || !editor) {
        dispose();
        return;
      }

      if (host?.isConnected && host.dataset.pageId === route.pageId && host.parentElement === toolbar) {
        return;
      }

      dispose();
      host = createButtonHost(context, toolbar, route.pageId);
    },

    dispose,
  };
}
