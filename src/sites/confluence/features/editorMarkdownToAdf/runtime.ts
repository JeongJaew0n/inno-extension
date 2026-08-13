import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { parseConfluenceEditPageUrl } from '../../routes';
import {
  EDITOR_BODY,
  EDITOR_CODE_BLOCK,
  EDITOR_MARKDOWN_TO_ADF_ROOT,
  EDITOR_PRIMARY_TOOLBAR,
} from '../../selectors';
import { codeBlockMarkdownToAdfPayload } from './code-block-to-adf';
import { readConfluenceCodeBlockText } from './code-block';
import {
  buildConfluenceMermaidReplacementHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  isMermaidCodeBlockSource,
} from './mermaid';

const MERMAID_EXTENSION_INSERT_TIMEOUT_MS = 3000;
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

function isCollapsedMermaidSource(codeBlock: HTMLElement): boolean {
  return Boolean(codeBlock.closest(
    '[data-prosemirror-node-name="expand"], [data-prosemirror-node-name="nestedExpand"]',
  ));
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

  await selectEditorNode(editor, codeBlock);
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
        );
        if (codeBlocks.length === 0) throw new Error('ADF로 변환할 코드블럭이 없습니다.');

        const codeBlocksWithSource = await Promise.all(codeBlocks.map(async (codeBlock, index) => ({
          codeBlock,
          index,
          localId: codeBlock.dataset.localId ?? '',
          source: await readProseMirrorCodeBlockText(currentEditor, codeBlock),
        })));
        const protectedMermaidCount = codeBlocksWithSource.filter(({ codeBlock }) => (
          hasValidMermaidPair(currentEditor, codeBlock)
        )).length;
        const candidates = codeBlocksWithSource
          .filter(({ codeBlock }) => !hasValidMermaidPair(currentEditor, codeBlock))
          .map(({ index, localId, source }) => ({
            index,
            localId,
            payload: codeBlockMarkdownToAdfPayload(source),
          }));
        if (candidates.length === 0) {
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

        codeBlockAdfLabel.textContent = warnings.length > 0
          ? `${convertedCount}개 변환 · 경고 ${warnings.length}`
          : `${convertedCount}개 변환`;
        const notices = [
          ...warnings,
          ...(protectedMermaidCount > 0
            ? [`Mermaid 컴포넌트 원본 ${protectedMermaidCount}개는 제외했습니다.`]
            : []),
        ];
        if (notices.length > 0) {
          codeBlockAdfButton.title = notices.join('\n');
          console.warn('[Inno Extension] Confluence 코드블럭 -> ADF 변환 안내', notices);
        }
      } catch (error) {
        console.error('[Inno Extension] Confluence 코드블럭 -> ADF 변환 실패', error);
        const message = error instanceof Error ? error.message : '코드블럭을 ADF로 변환하지 못했습니다.';
        codeBlockAdfLabel.textContent = convertedCount > 0
          ? `${convertedCount}개 변환 · 일부 실패`
          : '변환 실패';
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
        );
        const codeBlocksWithSource = await Promise.all(allCodeBlocks.map(
          async (codeBlock, index) => ({
            codeBlock,
            index,
            source: await readProseMirrorCodeBlockText(currentEditor, codeBlock),
          }),
        ));
        const mermaidCodeBlocks = codeBlocksWithSource.filter(({ source }) => (
          isMermaidCodeBlockSource(source)
        ));
        const candidates = mermaidCodeBlocks.filter(
          ({ codeBlock }) => !hasValidMermaidPair(currentEditor, codeBlock),
        );
        const pairedCount = mermaidCodeBlocks.length - candidates.length;
        const unpairedExtensionCount = countMermaidExtensions(currentEditor) - pairedCount;

        if (unpairedExtensionCount > 0) {
          throw new Error(`문서 다른 위치에 Mermaid 컴포넌트 ${unpairedExtensionCount}개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.`);
        }

        if (candidates.length === 0) {
          throw new Error('변환할 Mermaid 코드블럭이 없습니다.');
        }

        for (const { codeBlock, index, source } of candidates.reverse()) {
          await replaceMermaidCodeBlock(currentEditor, codeBlock, index, source);
          convertedCount += 1;
        }

        mermaidLabel.textContent = `${convertedCount}개 변환`;
      } catch (error) {
        console.error('[Inno Extension] Confluence Mermaid -> ADF 변환 실패', error);
        const message = error instanceof Error ? error.message : 'Mermaid를 변환하지 못했습니다.';
        mermaidLabel.textContent = convertedCount > 0
          ? `${convertedCount}개 변환 · 일부 실패`
          : message.startsWith('변환할 Mermaid') ? '변환 대상 없음' : '변환 실패';
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
