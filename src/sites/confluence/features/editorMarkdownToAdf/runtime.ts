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

interface MarkdownEditorSource {
  markdown: string;
  isPlain: boolean;
}

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
  editor.focus();
}

function selectEditorNode(editor: HTMLElement, node: HTMLElement): void {
  const selection = editor.ownerDocument.getSelection();
  if (!selection) throw new Error('편집기 선택 영역을 만들 수 없습니다.');

  const range = editor.ownerDocument.createRange();
  range.setStartBefore(node);
  range.setEndAfter(node);
  selection.removeAllRanges();
  selection.addRange(range);
  editor.focus();
}

function pasteOverSelection(
  editor: HTMLElement,
  html: string,
  plainText: string,
  didChange: () => boolean,
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

  const inserted = editor.ownerDocument.execCommand('insertHTML', false, html);
  if (!inserted || !didChange()) {
    throw new Error('Confluence 편집기에 변경 내용을 적용하지 못했습니다.');
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
    `;

    const convertButton = shadow.querySelector<HTMLButtonElement>('[data-action="convert"]');
    const convertLabel = shadow.querySelector<HTMLElement>('[data-convert-label]');
    const unwrapButton = shadow.querySelector<HTMLButtonElement>('[data-action="unwrap"]');
    const unwrapLabel = shadow.querySelector<HTMLElement>('[data-unwrap-label]');
    if (!convertButton || !convertLabel || !unwrapButton || !unwrapLabel) return null;

    const buttons = [convertButton, unwrapButton];
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
