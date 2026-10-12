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
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS } from '../../../../platform/design/parts';
import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { findDescriptionLabelRow } from '../../descriptionLabel';
import { fetchMediaImagesAsDataUris, isMediaImageUrl } from '../../api/media';
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

interface DescriptionMarkdown {
  markdown: string;
  /** 첨부 이미지 중 데이터로 넣은 수 / 넣으려 한 수 */
  images: { embedded: number; total: number };
}

/**
 * 지금 화면에서 Markdown 을 만든다.
 *
 * 읽기 중이면 렌더러를 옮기고, 편집 중이면 **ProseMirror 에서 ADF 를 직접 읽어** 옮긴다.
 * 편집기 DOM 을 긁으면 코드블럭이 CodeMirror 라 깨지고 긴 블록은 30줄 안팎에서 잘린다.
 *
 * **첨부 이미지는 데이터로 넣는다.** 화면에 그려진 이미지 주소로 다시 받아 `data:` URI 로 바꾼다.
 * 주소만 넣으면 토큰이 만료되거나 로그인이 없는 곳(VS Code)에서 깨진다. 못 받은 이미지는
 * `(이미지 첨부)` 로 남는다.
 *
 * docs/plans/adf-to-markdown/spec.md
 * docs/plans/jira-markdown-copy-images/spec.md
 */
async function buildMarkdown(document: Document): Promise<DescriptionMarkdown> {
  const body = findDescriptionBody(document);
  if (body) {
    const sources = Array.from(body.querySelectorAll<HTMLImageElement>('img'), (image) => image.src);
    const { dataUris, total } = await fetchMediaImagesAsDataUris(sources);
    const markdown = convertRendererToMarkdown(body, {
      // 첨부 이미지만 바꾼다. 못 받았으면 밖에서 열리지 않는 주소 대신 `(이미지 첨부)` 를 넣는다.
      resolveImage: (src) => (isMediaImageUrl(src) ? dataUris.get(src) ?? null : undefined),
    });
    if (!markdown) throw new Error('복사할 업무 설명이 비어 있습니다.');
    return { markdown, images: { embedded: dataUris.size, total } };
  }

  const editor = findDescriptionEditor(document);
  if (!editor) throw new Error('복사할 업무 설명을 찾을 수 없습니다.');

  /*
   * 편집 중에는 ADF 의 `media` 노드에 주소가 없다. 편집기가 그려 둔 이미지와 `id` 로 짝을 짓는다 —
   * `media` 노드의 `id` 속성이 ADF `attrs.id` 와 같고, 그 안의 `<img>` 가 첨부 이미지다(실측 2026-10-12).
   */
  const sourceById = new Map<string, string>();
  for (const media of editor.querySelectorAll<HTMLElement>('[data-prosemirror-node-name="media"]')) {
    const id = media.getAttribute('id');
    const src = media.querySelector('img')?.src;
    if (id && src) sourceById.set(id, src);
  }
  const { dataUris, total } = await fetchMediaImagesAsDataUris([...sourceById.values()]);

  const doc = await readProseMirrorDocument(editor) as AdfDocument;
  const { markdown, warnings } = adfToMarkdown(doc, {
    resolveMedia: (id) => dataUris.get(sourceById.get(id) ?? ''),
  });
  if (warnings.length > 0) {
    console.warn('[Inno Extension] Jira 설명 Markdown 복사 안내', warnings);
  }
  if (!markdown) throw new Error('복사할 업무 설명이 비어 있습니다.');
  return { markdown, images: { embedded: dataUris.size, total } };
}

/** 복사 결과 라벨. 이미지가 있으면 몇 장을 넣었는지 붙인다 */
export function describeCopyResult(images: { embedded: number; total: number }): string {
  return images.total > 0 ? `복사됨 · 이미지 ${images.embedded}/${images.total}` : '복사됨';
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
      <style>${DESIGN_TOKENS}${BUTTON_CSS}</style>
      <button type="button" class="inno-btn" aria-label="업무 설명 Markdown 복사">
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
      let feedbackMs = 1200;
      try {
        // 클릭 시점에 다시 본다. 그 사이 다른 업무로 바뀌었거나 편집을 시작했을 수 있다.
        const { markdown, images } = await buildMarkdown(context.document);
        await writePlainText(markdown);
        buttonLabel.textContent = describeCopyResult(images);
        // 이미지 수는 확인할 거리가 있는 결과다. 조금 더 오래 보여준다.
        feedbackMs = images.total > 0 ? 2500 : 1200;
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
      }, feedbackMs);
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
