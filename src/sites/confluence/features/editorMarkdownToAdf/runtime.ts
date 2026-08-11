import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { markdownToConfluenceAdf } from '../../adf';
import { parseConfluenceEditPageUrl } from '../../routes';
import {
  EDITOR_BODY,
  EDITOR_MARKDOWN_TO_ADF_ROOT,
  EDITOR_PRIMARY_TOOLBAR,
} from '../../selectors';
import { adfDocumentToEditorHtml } from './adf-to-editor-html';

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

function replaceEditorContents(editor: HTMLElement, html: string, markdown: string): void {
  selectEditorContents(editor);
  const beforeHtml = editor.innerHTML;
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/html', html);
  clipboardData.setData('text/plain', markdown);

  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData,
  });
  editor.dispatchEvent(pasteEvent);

  if (editor.innerHTML !== beforeHtml) return;

  selectEditorContents(editor);
  const inserted = editor.ownerDocument.execCommand('insertHTML', false, html);
  if (!inserted || editor.innerHTML === beforeHtml) {
    throw new Error('Confluence 편집기에 변환 결과를 적용하지 못했습니다.');
  }
}

export function createEditorMarkdownToAdfRuntime(): FeatureRuntime {
  let host: HTMLSpanElement | null = null;
  let feedbackTimer: number | null = null;

  function dispose(): void {
    if (feedbackTimer !== null) window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
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
      </style>
      <button type="button" aria-label="Markdown -> ADF 변환">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h10"></path><path d="m11 4 3 3-3 3"></path>
          <path d="M20 17H10"></path><path d="m13 14-3 3 3 3"></path>
        </svg>
        <span data-convert-label>Markdown -&gt; ADF 변환</span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('button');
    const label = shadow.querySelector<HTMLElement>('[data-convert-label]');
    if (!button || !label) return null;

    button.addEventListener('click', () => {
      button.disabled = true;
      label.textContent = '변환 중';
      button.removeAttribute('title');

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

        label.textContent = conversion.warnings.length > 0
          ? `변환됨 · 경고 ${conversion.warnings.length}`
          : '변환됨';
        if (conversion.warnings.length > 0) {
          button.title = conversion.warnings.join('\n');
          console.warn('[Inno Extension] Markdown -> ADF 변환 경고', conversion.warnings);
        }
      } catch (error) {
        console.error('[Inno Extension] Markdown -> ADF 편집기 변환 실패', error);
        const message = error instanceof Error ? error.message : '변환에 실패했습니다.';
        label.textContent = message.startsWith('이미 서식이 적용된 본문') ? '변환 불가' : '변환 실패';
        button.title = message;
      }

      feedbackTimer = window.setTimeout(() => {
        if (nextHost.isConnected) {
          button.disabled = false;
          label.textContent = 'Markdown -> ADF 변환';
          button.removeAttribute('title');
        }
        feedbackTimer = null;
      }, 2200);
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
