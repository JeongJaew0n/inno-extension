/**
 * Jira 업무 **설명**을 Markdown으로 복사한다.
 *
 * Jira 설명 읽기 화면은 Confluence 문서 본문과 **같은 `.ak-renderer-document`** 를 쓴다. 그래서
 * 변환기(`platform/editor/renderer-to-markdown`)를 그대로 쓴다.
 *
 * docs/plans/jira-description-markdown-copy/spec.md
 */

import { adfToMarkdown } from '../../../../platform/adf';
import type { AdfDocument } from '../../../../platform/adf';
import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import { readProseMirrorDocument } from '../../../../platform/editor/bridge-client';
import { convertRendererToMarkdown } from '../../../../platform/editor/renderer-to-markdown';
import { EDITOR_PROSEMIRROR } from '../../../../platform/editor/selectors';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { findDescriptionLabelRow } from '../../descriptionLabel';
import { parseJiraBoardUrl, parseJiraIssueUrl } from '../../routes';
import {
  DESCRIPTION_EDITOR_CONTAINER_FIELD,
  DESCRIPTION_FIELD,
  DESCRIPTION_MARKDOWN_COPY_ROOT,
  DESCRIPTION_RENDERER,
} from '../../selectors';

const DEFAULT_LABEL = 'Markdown 복사';

/** 지금 보고 있는 업무 키. 업무가 바뀌면 버튼을 다시 만든다. */
function currentIssueKey(url: URL): string {
  return parseJiraIssueUrl(url.href)?.issueKey
    ?? parseJiraBoardUrl(url.href)?.selectedIssueKey
    ?? 'description';
}

/**
 * 설명 본문을 찾는다.
 *
 * **설명 필드 안에서만 찾는다.** 댓글도 같은 렌더러를 쓰므로 문서 전체에서 찾으면 댓글 본문을
 * 복사하게 된다.
 *
 * 편집 중에는 렌더러가 사라지므로 자연히 `null`이 되어 버튼이 빠진다.
 */
function findDescriptionBody(document: Document): HTMLElement | null {
  const field = document.querySelector<HTMLElement>(DESCRIPTION_FIELD);
  return field?.querySelector<HTMLElement>(DESCRIPTION_RENDERER) ?? null;
}

/** 편집 중인 설명 편집기. 읽기 모드에서는 없다. */
function findDescriptionEditor(document: Document): HTMLElement | null {
  const container = document.querySelector<HTMLElement>(DESCRIPTION_EDITOR_CONTAINER_FIELD);
  return container?.querySelector<HTMLElement>(EDITOR_PROSEMIRROR) ?? null;
}

/**
 * 지금 화면에서 Markdown 을 만든다.
 *
 * 읽기 중이면 렌더러를 옮기고, 편집 중이면 **ProseMirror 에서 ADF 를 직접 읽어** 옮긴다.
 * 편집기 DOM 을 긁으면 코드블럭이 CodeMirror 라 깨지고 긴 블록은 30줄 안팎에서 잘린다.
 *
 * docs/plans/adf-to-markdown/spec.md
 */
async function buildMarkdown(document: Document): Promise<string> {
  const body = findDescriptionBody(document);
  if (body) {
    const markdown = convertRendererToMarkdown(body);
    if (!markdown) throw new Error('복사할 업무 설명이 비어 있습니다.');
    return markdown;
  }

  const editor = findDescriptionEditor(document);
  if (!editor) throw new Error('복사할 업무 설명을 찾을 수 없습니다.');

  const doc = await readProseMirrorDocument(editor) as AdfDocument;
  const { markdown, warnings } = adfToMarkdown(doc);
  if (warnings.length > 0) {
    console.warn('[Inno Extension] Jira 설명 Markdown 복사 안내', warnings);
  }
  if (!markdown) throw new Error('복사할 업무 설명이 비어 있습니다.');
  return markdown;
}

export function createDescriptionMarkdownCopyRuntime(): FeatureRuntime {
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
    anchor: HTMLElement,
    issueKey: string,
  ): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, DESCRIPTION_MARKDOWN_COPY_ROOT);
    nextHost.dataset.issueKey = issueKey;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    nextHost.style.verticalAlign = 'middle';

    const shadow = nextHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          box-sizing: border-box; min-height: 24px; padding: 0 8px; border: 0;
          border-radius: 3px; background: transparent; color: #44546f; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 500; line-height: 24px; white-space: nowrap;
        }
        svg { width: 14px; height: 14px; flex: 0 0 auto; }
        button:hover { background: #091e420f; color: #172b4d; }
        button:focus-visible { outline: 2px solid #0c66e4; outline-offset: 1px; }
        button:disabled { cursor: default; opacity: 0.72; }
      </style>
      <button type="button" aria-label="업무 설명 Markdown 복사">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2"></rect>
          <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span data-copy-label>${DEFAULT_LABEL}</span>
      </button>
    `;

    const button = shadow.querySelector<HTMLButtonElement>('button');
    const buttonLabel = shadow.querySelector<HTMLElement>('[data-copy-label]');
    if (!button || !buttonLabel) return null;

    button.addEventListener('click', async () => {
      button.disabled = true;
      buttonLabel.textContent = '복사 중';
      try {
        // 클릭 시점에 다시 본다. 그 사이 다른 업무로 바뀌었거나 편집을 시작했을 수 있다.
        const markdown = await buildMarkdown(context.document);
        await writePlainText(markdown);
        buttonLabel.textContent = '복사됨';
      } catch (error) {
        console.error('[Inno Extension] Jira 설명 Markdown 복사 실패', error);
        buttonLabel.textContent = '복사 실패';
      }

      feedbackTimer = window.setTimeout(() => {
        if (nextHost.isConnected) {
          button.disabled = false;
          buttonLabel.textContent = DEFAULT_LABEL;
        }
        feedbackTimer = null;
      }, 1200);
    });

    anchor.append(nextHost);
    return nextHost;
  }

  return {
    id: 'descriptionMarkdownCopy',

    reconcile(context: PageContext): void {
      // 읽기 중이면 렌더러가, 편집 중이면 편집기가 있다. 둘 다 없으면 붙이지 않는다.
      const hasBody = findDescriptionBody(context.document) !== null
        || findDescriptionEditor(context.document) !== null;
      const anchor = findDescriptionLabelRow(context.document);
      if (!hasBody || !anchor) {
        dispose();
        return;
      }

      const issueKey = currentIssueKey(context.url);
      if (host?.isConnected && host.dataset.issueKey === issueKey && host.parentElement === anchor) {
        return;
      }

      dispose();
      host = createButtonHost(context, anchor, issueKey);
    },

    dispose,
  };
}
