import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { markdownToConfluenceAdf } from '../../adf';
import { parseConfluenceEditPageUrl } from '../../routes';
import {
  EDITOR_BODY,
  EDITOR_CODE_BLOCK,
  EDITOR_MARKDOWN_TO_ADF_ROOT,
  EDITOR_PRIMARY_TOOLBAR,
} from '../../selectors';
import { adfDocumentToEditorHtml } from './adf-to-editor-html';
import {
  codeBlockTextToEditorHtml,
  readConfluenceCodeBlockText,
} from './code-block';
import {
  buildCollapsedMermaidSourceHtml,
  buildConfluenceMermaidExtensionHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  CONFLUENCE_MERMAID_TITLE,
  isMermaidCodeBlockSource,
} from './mermaid';

interface MarkdownEditorSource {
  markdown: string;
  isPlain: boolean;
}

const MERMAID_EXTENSION_INSERT_TIMEOUT_MS = 3000;

function readNodeText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';

  const element = node as Element;
  if (element.getAttribute('contenteditable') === 'false'
    || element.classList.contains('ProseMirror-widget')) {
    return '';
  }
  if (element.tagName === 'BR') return '\n';
  return Array.from(element.childNodes).map(readNodeText).join('');
}

function readMarkdownEditorSource(editor: HTMLElement): MarkdownEditorSource {
  const documentNodes = Array.from(editor.children).filter(
    (element): element is HTMLElement => (
      element instanceof HTMLElement
      && element.getAttribute('data-prosemirror-content-type') === 'node'
    ),
  );

  if (documentNodes.length === 0) return { markdown: '', isPlain: true };

  const isPlain = documentNodes.every((node) => {
    if (node.getAttribute('data-prosemirror-node-name') !== 'paragraph') return false;
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[contenteditable="false"], .ProseMirror-widget').forEach(
      (element) => element.remove(),
    );
    return Array.from(clone.querySelectorAll('*')).every((element) => element.tagName === 'BR');
  });

  const markdown = documentNodes
    .map((node) => readNodeText(node).replace(/\r\n?/g, '\n').trimEnd())
    .join('\n\n')
    .trim();

  return { markdown, isPlain };
}

function selectEditorContents(editor: HTMLElement): void {
  editor.focus();
  const selection = editor.ownerDocument.getSelection();
  if (!selection) throw new Error('편집기 선택 영역을 만들 수 없습니다.');

  const range = editor.ownerDocument.createRange();
  const documentNodes = Array.from(editor.children).filter(
    (element) => element.getAttribute('data-prosemirror-content-type') === 'node',
  );
  const firstNode = documentNodes[0];
  const lastNode = documentNodes[documentNodes.length - 1];
  if (firstNode && lastNode) {
    range.setStartBefore(firstNode);
    range.setEndAfter(lastNode);
  } else {
    range.selectNodeContents(editor);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectEditorNode(editor: HTMLElement, node: HTMLElement): void {
  editor.focus();
  const selection = editor.ownerDocument.getSelection();
  if (!selection) throw new Error('편집기 선택 영역을 만들 수 없습니다.');

  const range = editor.ownerDocument.createRange();
  range.setStartBefore(node);
  range.setEndAfter(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

function findTopLevelEditorNode(editor: HTMLElement, node: HTMLElement): HTMLElement {
  let current = node;
  while (current.parentElement && current.parentElement !== editor) {
    current = current.parentElement;
  }
  if (current.parentElement !== editor) {
    throw new Error('Mermaid 원본의 편집기 위치를 찾을 수 없습니다.');
  }
  return current;
}

function placeCaretBeforeEditorNode(editor: HTMLElement, node: HTMLElement): void {
  editor.focus();
  const selection = editor.ownerDocument.getSelection();
  if (!selection) throw new Error('편집기 선택 영역을 만들 수 없습니다.');

  const range = editor.ownerDocument.createRange();
  range.setStartBefore(findTopLevelEditorNode(editor, node));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function pasteOverSelection(
  editor: HTMLElement,
  html: string,
  plainText: string,
  didChange: () => boolean,
  allowInsertHtmlFallback = true,
): void {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/html', html);
  clipboardData.setData('text/plain', plainText);

  editor.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData,
  }));

  if (didChange()) return;

  if (!allowInsertHtmlFallback) {
    throw new Error('Confluence 편집기가 ADF extension 붙여넣기를 수용하지 않았습니다.');
  }

  const inserted = editor.ownerDocument.execCommand('insertHTML', false, html);
  if (!inserted || !didChange()) {
    throw new Error('Confluence 편집기에 변경 내용을 적용하지 못했습니다.');
  }
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

function replaceEditorContents(editor: HTMLElement, html: string, markdown: string): void {
  selectEditorContents(editor);
  const beforeHtml = editor.innerHTML;
  pasteOverSelection(editor, html, markdown, () => editor.innerHTML !== beforeHtml);
}

function unwrapCodeBlock(editor: HTMLElement, codeBlock: HTMLElement): void {
  const plainText = readConfluenceCodeBlockText(codeBlock);
  const html = codeBlockTextToEditorHtml(plainText);
  selectEditorNode(editor, codeBlock);
  pasteOverSelection(editor, html, plainText, () => !codeBlock.isConnected);
}

function isMermaidExtension(node: Element): boolean {
  const extensionKey = node.getAttribute('extensionkey')
    ?? node.getAttribute('data-extension-key');
  return node.getAttribute('data-prosemirror-node-name') === 'extension'
    && extensionKey === CONFLUENCE_MERMAID_EXTENSION_KEY;
}

function hasPrecedingMermaidExtension(editor: HTMLElement, codeBlock: HTMLElement): boolean {
  const editorNodes = Array.from(editor.querySelectorAll<HTMLElement>(
    `${EDITOR_CODE_BLOCK}, [data-prosemirror-node-name="extension"]`,
  ));
  const codeBlockPosition = editorNodes.indexOf(codeBlock);
  if (codeBlockPosition < 0) return false;

  const precedingNode = editorNodes[codeBlockPosition - 1];
  return precedingNode ? isMermaidExtension(precedingNode) : false;
}

function countMermaidExtensions(editor: HTMLElement): number {
  return Array.from(editor.querySelectorAll<HTMLElement>(
    '[data-prosemirror-node-name="extension"]',
  )).filter(isMermaidExtension).length;
}

async function insertMermaidExtension(
  editor: HTMLElement,
  codeBlock: HTMLElement,
  codeBlockIndex: number,
): Promise<void> {
  const localId = crypto.randomUUID();
  const html = buildConfluenceMermaidExtensionHtml(codeBlockIndex, localId);
  const didInsertTargetExtension = (): boolean => Array.from(
    editor.querySelectorAll<HTMLElement>('[data-prosemirror-node-name="extension"]'),
  ).some((extension) => (
    extension.getAttribute('localid') === localId
    || extension.getAttribute('data-local-id') === localId
  ));

  placeCaretBeforeEditorNode(editor, codeBlock);
  await pasteAndWaitForChange(
    editor,
    html,
    CONFLUENCE_MERMAID_TITLE,
    didInsertTargetExtension,
    'Confluence 편집기가 ADF extension 붙여넣기를 수용하지 않았습니다.',
  );
}

async function collapseMermaidSource(
  editor: HTMLElement,
  codeBlock: HTMLElement,
): Promise<void> {
  if (codeBlock.closest('[data-prosemirror-node-name="expand"], [data-prosemirror-node-name="nestedExpand"]')) {
    return;
  }

  const source = readConfluenceCodeBlockText(codeBlock);
  const topLevelNode = findTopLevelEditorNode(editor, codeBlock);
  selectEditorNode(editor, topLevelNode);
  await pasteAndWaitForChange(
    editor,
    buildCollapsedMermaidSourceHtml(source),
    source,
    () => !topLevelNode.isConnected,
    'Mermaid 원본 코드블럭을 접힌 영역으로 바꾸지 못했습니다.',
  );
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
      <button type="button" data-action="convert" aria-label="Markdown -> ADF 변환">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h10"></path><path d="m11 4 3 3-3 3"></path>
          <path d="M20 17H10"></path><path d="m13 14-3 3 3 3"></path>
        </svg>
        <span data-convert-label>Markdown -&gt; ADF 변환</span>
      </button>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" data-action="unwrap" aria-label="코드블럭 벗기기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m8 9-3 3 3 3"></path><path d="m16 9 3 3-3 3"></path>
          <path d="M14 5 10 19"></path>
        </svg>
        <span data-unwrap-label>코드블럭 벗기기</span>
      </button>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" data-action="mermaid" aria-label="Mermaid -> ADF 변환">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 4v4"></path><path d="M17 4v4"></path><path d="M5 8h14"></path>
          <path d="M6 12h4l2 3 2-3h4"></path><path d="M12 15v5"></path>
        </svg>
        <span data-mermaid-label>Mermaid -&gt; ADF</span>
      </button>
    `;

    const convertButton = shadow.querySelector<HTMLButtonElement>('[data-action="convert"]');
    const convertLabel = shadow.querySelector<HTMLElement>('[data-convert-label]');
    const unwrapButton = shadow.querySelector<HTMLButtonElement>('[data-action="unwrap"]');
    const unwrapLabel = shadow.querySelector<HTMLElement>('[data-unwrap-label]');
    const mermaidButton = shadow.querySelector<HTMLButtonElement>('[data-action="mermaid"]');
    const mermaidLabel = shadow.querySelector<HTMLElement>('[data-mermaid-label]');
    if (!convertButton || !convertLabel || !unwrapButton || !unwrapLabel
      || !mermaidButton || !mermaidLabel) return null;

    const buttons = [convertButton, unwrapButton, mermaidButton];
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

    convertButton.addEventListener('click', () => {
      setBusy(true);
      convertLabel.textContent = '변환 중';
      convertButton.removeAttribute('title');

      try {
        const currentEditor = context.document.querySelector<HTMLElement>(EDITOR_BODY);
        if (!currentEditor) {
          throw new Error('Confluence 편집 본문을 찾을 수 없습니다.');
        }

        const source = readMarkdownEditorSource(currentEditor);
        if (!source.markdown) throw new Error('변환할 본문이 비어 있습니다.');
        if (!source.isPlain) {
          throw new Error('이미 서식이 적용된 본문은 변환하지 않습니다. Markdown 원문만 있는 본문에서 실행하세요.');
        }

        const conversion = markdownToConfluenceAdf(source.markdown);
        if (conversion.doc.content.length === 0) throw new Error('변환 가능한 Markdown 내용이 없습니다.');

        const html = adfDocumentToEditorHtml(conversion.doc);
        if (!html) throw new Error('편집기에 적용할 변환 결과가 없습니다.');
        replaceEditorContents(currentEditor, html, source.markdown);

        convertLabel.textContent = conversion.warnings.length > 0
          ? `변환됨 · 경고 ${conversion.warnings.length}`
          : '변환됨';
        if (conversion.warnings.length > 0) {
          convertButton.title = conversion.warnings.join('\n');
          console.warn('[Inno Extension] Markdown -> ADF 변환 경고', conversion.warnings);
        }
      } catch (error) {
        console.error('[Inno Extension] Markdown -> ADF 편집기 변환 실패', error);
        const message = error instanceof Error ? error.message : '변환에 실패했습니다.';
        convertLabel.textContent = message.startsWith('이미 서식이 적용된 본문') ? '변환 불가' : '변환 실패';
        convertButton.title = message;
      }

      resetLater(convertButton, convertLabel, 'Markdown -> ADF 변환');
    });

    unwrapButton.addEventListener('click', () => {
      setBusy(true);
      unwrapLabel.textContent = '벗기는 중';
      unwrapButton.removeAttribute('title');
      let unwrappedCount = 0;

      try {
        const currentEditor = context.document.querySelector<HTMLElement>(EDITOR_BODY);
        if (!currentEditor) throw new Error('Confluence 편집 본문을 찾을 수 없습니다.');

        const codeBlocks = Array.from(
          currentEditor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK),
        );
        if (codeBlocks.length === 0) throw new Error('벗길 코드블럭이 없습니다.');

        for (const codeBlock of codeBlocks.reverse()) {
          unwrapCodeBlock(currentEditor, codeBlock);
          unwrappedCount += 1;
        }

        unwrapLabel.textContent = `${unwrappedCount}개 벗김`;
      } catch (error) {
        console.error('[Inno Extension] Confluence 코드블럭 벗기기 실패', error);
        const message = error instanceof Error ? error.message : '코드블럭을 벗기지 못했습니다.';
        unwrapLabel.textContent = unwrappedCount > 0 ? `${unwrappedCount}개 벗김 · 일부 실패` : '벗기기 실패';
        unwrapButton.title = message;
      }

      resetLater(unwrapButton, unwrapLabel, '코드블럭 벗기기');
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
        const mermaidCodeBlocks = allCodeBlocks
          .map((codeBlock, index) => ({ codeBlock, index }))
          .filter(({ codeBlock }) => isMermaidCodeBlockSource(
            readConfluenceCodeBlockText(codeBlock),
          ));
        const candidates = mermaidCodeBlocks.filter(
          ({ codeBlock }) => !hasPrecedingMermaidExtension(currentEditor, codeBlock),
        );
        const pairedCount = mermaidCodeBlocks.length - candidates.length;
        const unpairedExtensionCount = countMermaidExtensions(currentEditor) - pairedCount;

        if (unpairedExtensionCount > 0) {
          throw new Error(`문서 다른 위치에 Mermaid 컴포넌트 ${unpairedExtensionCount}개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.`);
        }

        if (candidates.length === 0) {
          throw new Error('변환할 Mermaid 코드블럭이 없습니다.');
        }

        for (const { codeBlock, index } of candidates.reverse()) {
          await insertMermaidExtension(currentEditor, codeBlock, index);
          const currentCodeBlock = currentEditor.querySelectorAll<HTMLElement>(
            EDITOR_CODE_BLOCK,
          )[index];
          if (!currentCodeBlock) {
            throw new Error(`${index + 1}번째 Mermaid 원본을 다시 찾을 수 없습니다.`);
          }
          await collapseMermaidSource(currentEditor, currentCodeBlock);
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
