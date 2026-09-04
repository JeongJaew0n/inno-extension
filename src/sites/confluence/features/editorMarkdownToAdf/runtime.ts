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
  describeUnconvertedMarkdown,
  findUnconvertedMarkdown,
  looksLikeMarkdownDocument,
} from './markdown-detection';
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

type ProseMirrorBridgeAction = 'read-node' | 'select-node' | 'select-range';

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
  endNode?: HTMLElement,
): Promise<ProseMirrorBridgeResponse> {
  const localId = node?.dataset.localId;
  if (!localId) throw new Error('Confluence 노드 식별자를 찾을 수 없습니다.');
  const endLocalId = endNode?.dataset.localId ?? localId;
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
      detail: JSON.stringify({ action, requestId, localId, endLocalId }),
    }));
  });
}

async function selectEditorNode(editor: HTMLElement, node: HTMLElement): Promise<void> {
  await requestProseMirrorBridge(editor, 'select-node', node);
}

/** 연속한 문단 구간을 한 번에 선택한다. 첫 문단과 마지막 문단을 잡으면 그 사이가 모두 들어간다. */
async function selectEditorRange(
  editor: HTMLElement,
  first: HTMLElement,
  last: HTMLElement,
): Promise<void> {
  await requestProseMirrorBridge(editor, 'select-range', first, last);
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

/**
 * 평문만 실어 붙여넣는다.
 *
 * `text/html`이 함께 있으면 Confluence가 그쪽을 우선하므로 Markdown 파서를 타지 않는다.
 * 문단으로 남은 Markdown은 Confluence 자체 파서에 맡기는 것이 낫다. 그쪽이 이 편집기의 실제
 * 규칙이고, 우리 변환기와 달리 취소선 구분자로 `~~`만 인정해 `1~3`ㆍ`4~5` 같은 범위 표기를
 * 깨뜨리지 않는다.
 *
 * docs/issue/2026-09-04-tilde-range-becomes-strikethrough.md
 */
async function pastePlainTextAndWaitForChange(
  editor: HTMLElement,
  plainText: string,
  didChange: () => boolean,
  failureMessage: string,
): Promise<void> {
  const clipboardData = new DataTransfer();
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
  return wrapsOnlyNode(expand, codeBlock) ? expand : codeBlock;
}

/** `container`가 `node` 하나만 콘텐츠로 담고 있으면 `true`. */
function wrapsOnlyNode(container: HTMLElement, node: HTMLElement): boolean {
  const innerNodes = Array.from(
    container.querySelectorAll<HTMLElement>('[data-prosemirror-node-name]'),
  );
  return innerNodes.length === 1 && innerNodes[0] === node;
}

/**
 * 코드블럭이 본문 최상위에 있으면 `true`.
 *
 * Confluence는 코드블럭을 `.fabric-editor-breakout-mark` 래퍼로 감싸므로 편집기의 직계 자식이
 * 아니다. `editor.children`에서 codeBlock을 찾으면 하나도 나오지 않는다. `findEditorTopLevelNode()`가
 * 돌려주는 최상위 노드가 이 코드블럭만 담고 있는지로 판정한다.
 *
 * 목록·인용·표 안의 코드블럭은 그 컨테이너가 최상위가 되므로 `false`다.
 */
function isTopLevelCodeBlock(editor: HTMLElement, codeBlock: HTMLElement): boolean {
  const topLevel = findEditorTopLevelNode(editor, codeBlock);
  if (!topLevel) return false;
  return topLevel === codeBlock || wrapsOnlyNode(topLevel, codeBlock);
}

/**
 * 코드블럭 벗기기를 실행할지 판정한다.
 *
 * 벗기기는 대상 코드블럭을 Markdown으로 해석해 산문으로 풀어버린다. 실제 소스 코드에 실행하면
 * 코드가 사라지므로, Markdown 원문을 통째로 붙여넣은 문서일 때만 실행한다.
 *
 * 세 조건을 모두 요구한다.
 *
 * 1. 보호 대상(이미 변환된 Mermaid 원본)이 아닌 코드블럭이 하나 이상 있다
 * 2. 그중 최상위에 놓인 것이 하나 이상 있다
 * 3. **전부** Markdown 문서로 보인다
 *
 * 3번이 핵심이다. 벗기기 동작 자체는 문서의 모든 코드블럭을 대상으로 하므로, 실제 코드가 하나라도
 * 섞여 있으면 실행해서는 안 된다. 하나라도 판정이 안 서면 벗기지 않는다.
 *
 * 판정에는 DOM 원문을 쓴다. CodeMirror가 30줄 안팎까지만 렌더하지만 Markdown 특징은 앞부분에
 * 나타나므로 게이트 용도로는 충분하다. 읽지 못한 코드블럭은 `looksLikeMarkdownDocument()`가
 * `false`를 돌려주어 자연히 벗기기가 막힌다.
 *
 * docs/plans/confluence-magic-button/spec.md
 */
function shouldUnwrapCodeBlocks(editor: HTMLElement): boolean {
  const codeBlocks = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK))
    .filter((codeBlock) => !hasValidMermaidPair(editor, codeBlock));
  if (codeBlocks.length === 0) return false;
  if (!codeBlocks.some((codeBlock) => isTopLevelCodeBlock(editor, codeBlock))) return false;
  return codeBlocks.every(
    (codeBlock) => looksLikeMarkdownDocument(readConfluenceCodeBlockText(codeBlock)),
  );
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

/**
 * DOM에서 읽은 코드블럭 원문이 `source`와 같은 내용인지 판정한다.
 *
 * CodeMirror는 코드블럭을 30줄 안팎까지만 DOM에 렌더한다. 그래서 긴 블록에서는
 * `readConfluenceCodeBlockText()`가 원문의 일부만 돌려준다. 붙여넣을 `source`는 브리지로
 * ProseMirror node에서 전체를 읽으므로, 등호로 비교하면 31줄 이상인 블록은 검증을 영원히
 * 통과하지 못한다. 실측에서 35줄(748자) 블록의 DOM 읽기가 30줄(631자)에서 끊겼다.
 *
 * 렌더된 구간이 원문의 연속 부분이면 같은 블록으로 본다. 블록 내부 스크롤 위치에 따라 앞이
 * 아니라 중간이 렌더될 수 있으므로 접두사가 아니라 부분 문자열로 확인한다.
 *
 * 아무것도 렌더되지 않은 경우(`''`)는 통과시키지 않는다. 빈 문자열은 모든 원문의 부분
 * 문자열이라 검증이 무조건 참이 되기 때문이다.
 *
 * 이 완화는 단독으로 쓰이지 않는다. `localId` 일치 · 접힌 expand 여부 · 직전 최상위 노드가
 * 해당 extension인지가 함께 걸리므로 다른 코드블럭을 오인할 여지는 낮다.
 *
 * docs/issue/2026-09-04-mermaid-verification-reads-truncated-dom.md
 */
export function matchesCodeBlockSource(codeBlock: HTMLElement, source: string): boolean {
  const domSource = readConfluenceCodeBlockText(codeBlock);
  if (!domSource) return source === '';
  return source === domSource || source.includes(domSource);
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
    && matchesCodeBlockSource(codeBlock, source)
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
    || !matchesCodeBlockSource(codeBlock, source)
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
  /**
   * 원본 코드블럭이 소비됐는지 판정한다.
   *
   * `!codeBlock.isConnected`만 보면 안 된다. **ProseMirror는 DOM 노드를 재사용한다.** 문단 변환
   * 단계에서 교체가 제대로 됐는데도 원래 엘리먼트의 `isConnected`가 계속 `true`인 것을 실측으로
   * 확인했다. 특히 앞 단계가 문서를 통째로 다시 쓴 직후에는 재사용 양상이 달라진다.
   *
   * 교체가 성공하면 원본은 둘 중 하나다. 노드가 버려졌거나, 재사용되어 `Mermaid 원본` 접힌
   * 영역 **안으로** 들어갔거나. 붙여넣기가 실패했다면 원본은 접히지 않은 채 제자리에 남는다.
   *
   * docs/issue/2026-09-04-mermaid-phase-verification-node-reuse.md
   */
  const didConsumeOriginal = (): boolean => (
    !codeBlock.isConnected || isCollapsedMermaidSource(codeBlock)
  );
  const didReplaceSource = (): boolean => (
    didConsumeOriginal()
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
    // 노드 재사용 때문에 `isConnected`만으로는 변경 여부를 알 수 없다. 위 판정과 같은 기준을 쓴다.
    const changed = didConsumeOriginal() || Boolean(findMermaidExtensionByLocalId(editor, localId));
    if (changed && !await rollbackMermaidReplacement(editor, codeBlockIndex, localId, source)) {
      throw new Error('Mermaid 변환 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Confluence 실행 취소를 한 번 눌러주세요.');
    }
    throw error;
  }
}

interface PhaseFailure {
  index: number;
  message: string;
}

interface CodeBlockPhaseResult {
  convertedCount: number;
  failures: PhaseFailure[];
  warnings: string[];
  protectedMermaidCount: number;
}

interface MermaidPhaseResult {
  convertedCount: number;
  failures: PhaseFailure[];
}

/** 짝을 찾지 못한 기존 Mermaid 컴포넌트 수. 0보다 크면 중복 생성 위험이 있어 변환하지 않는다. */
function countUnpairedMermaidExtensions(editor: HTMLElement): number {
  const pairedCount = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK))
    .filter((codeBlock) => mayBeMermaidCodeBlock(codeBlock))
    .filter((codeBlock) => hasValidMermaidPair(editor, codeBlock))
    .length;
  return countMermaidExtensions(editor) - pairedCount;
}

/**
 * 1단계 — 코드블럭 원문을 Markdown으로 해석해 원위치 ADF로 교체한다.
 *
 * 대상 범위는 종전 `코드블럭 -> ADF`와 같다. 실행 여부만 `shouldUnwrapCodeBlocks()`가 가른다.
 */
async function runCodeBlockPhase(
  editor: HTMLElement,
  onProgress: (done: number, total: number) => void,
): Promise<CodeBlockPhaseResult> {
  const codeBlocks = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK))
    .map((codeBlock, index) => ({ codeBlock, index }));
  if (codeBlocks.length === 0) throw new Error('ADF로 변환할 코드블럭이 없습니다.');

  const protectedMermaidCount = codeBlocks
    .filter(({ codeBlock }) => hasValidMermaidPair(editor, codeBlock)).length;
  // 보호 대상은 읽지 않는다. 변환하지 않을 블록까지 읽으면 브리지 요청만 늘어난다.
  const { failures, sources } = await readCodeBlockSources(
    editor,
    codeBlocks.filter(({ codeBlock }) => !hasValidMermaidPair(editor, codeBlock)),
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

  let convertedCount = 0;
  const total = candidates.length;
  onProgress(0, total);
  for (const { localId, payload } of candidates.reverse()) {
    await replaceCodeBlockWithAdf(editor, localId, payload.html, payload.markdown);
    convertedCount += 1;
    onProgress(convertedCount, total);
  }

  return { convertedCount, failures, warnings, protectedMermaidCount };
}

/**
 * 2단계 — Mermaid 코드블럭을 `extension + 접힌 원본`으로 교체한다.
 *
 * 대상이 없으면 오류가 아니라 `convertedCount: 0`으로 끝낸다. 1단계만 수행하는 문서도 정상이다.
 */
async function runMermaidPhase(
  editor: HTMLElement,
  onProgress: (done: number, total: number) => void,
): Promise<MermaidPhaseResult> {
  const allCodeBlocks = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK))
    .map((codeBlock, index) => ({ codeBlock, index }));

  // 브리지 요청을 Mermaid 후보로 한정한다. 문서 전체를 읽으면 실패 표면만 넓어진다.
  const mermaidCandidateBlocks = allCodeBlocks.filter(
    ({ codeBlock }) => mayBeMermaidCodeBlock(codeBlock),
  );
  const { failures, sources } = await readCodeBlockSources(
    editor,
    mermaidCandidateBlocks.filter(({ codeBlock }) => !hasValidMermaidPair(editor, codeBlock)),
  );
  const candidates = sources.filter(({ source }) => isMermaidCodeBlockSource(source));

  if (candidates.length === 0) {
    if (failures.length > 0) {
      throw new Error(`Mermaid 후보 코드블럭 ${failures.length}개의 원문을 읽지 못했습니다. ${failures[0].message}`);
    }
    return { convertedCount: 0, failures };
  }

  let convertedCount = 0;
  const total = candidates.length;
  onProgress(0, total);
  for (const { codeBlock, index, source } of candidates.reverse()) {
    await replaceMermaidCodeBlock(editor, codeBlock, index, source);
    convertedCount += 1;
    onProgress(convertedCount, total);
  }

  return { convertedCount, failures };
}

/**
 * 편집 본문에서 변환되지 않고 문단으로 남은 Markdown을 찾는다.
 *
 * 두 단계 모두 할 일이 없을 때만 호출한다. 그 경우 `변환할 내용이 없습니다`만 보여주면 사용자가
 * 원인을 알 수 없기 때문이다. 코드블럭이 아니라 문단으로 붙여넣은 Markdown이 이 상태가 된다.
 */
function findUnconvertedMarkdownInEditor(editor: HTMLElement): string {
  const paragraphTexts = Array.from(
    editor.querySelectorAll<HTMLElement>('[data-prosemirror-node-name="paragraph"]'),
  )
    .map((paragraph) => (paragraph.textContent ?? '').trim())
    .filter(Boolean);
  if (paragraphTexts.length === 0) return '';

  const findings = findUnconvertedMarkdown(
    paragraphTexts,
    (nodeName) => editor.querySelectorAll(`[data-prosemirror-node-name="${nodeName}"]`).length,
  );
  return describeUnconvertedMarkdown(findings);
}

interface ParagraphRun {
  paragraphs: HTMLElement[];
  markdown: string;
}

/**
 * 본문 최상위의 **연속한 문단** 구간을 모은다.
 *
 * 원문을 코드블럭이 아니라 본문에 그대로 붙여넣으면 각 줄이 문단이 된다. 그 줄들을 다시 이어
 * 붙이면 원래 Markdown이 복원된다. 빈 줄도 빈 문단으로 남아 있으므로 블록 구분이 유지된다.
 *
 * Confluence가 붙여넣기 과정에서 이미 변환해 둔 노드(목록·표 등)는 문단이 아니므로 구간을
 * 끊는다. 그 노드들은 건드리지 않고 그대로 둔다.
 */
function collectParagraphRuns(editor: HTMLElement): ParagraphRun[] {
  const runs: ParagraphRun[] = [];
  let current: HTMLElement[] | null = null;

  for (const child of Array.from(editor.children)) {
    const element = child as HTMLElement;
    // 데코레이션은 문서 내용이 아니므로 구간을 끊지 않는다.
    if (element.classList.contains('ProseMirror-widget')) continue;

    if (element.getAttribute('data-prosemirror-node-name') === 'paragraph') {
      if (!current) { current = []; runs.push({ paragraphs: current, markdown: '' }); }
      current.push(element);
    } else {
      current = null;
    }
  }

  return runs
    .filter((run) => run.paragraphs.length > 0)
    .map((run) => ({
      paragraphs: run.paragraphs,
      // NBSP는 Markdown 파서가 공백으로 보지 않아 빈 줄 판정을 망친다.
      markdown: run.paragraphs
        .map((paragraph) => (paragraph.textContent ?? '').replace(/\u00a0/g, ' '))
        .join('\n'),
    }));
}

/**
 * 2단계 — 문단으로 남은 Markdown을 Confluence에 다시 맡긴다.
 *
 * 구간의 문단 텍스트를 그대로 이어 붙여 **평문으로 다시 붙여넣는다.** 그러면 Confluence 자체
 * Markdown 파서가 제목·표·코드블럭·목록·인용을 만들어 준다. 실측으로 확인했다.
 *
 * 우리 변환기를 쓰지 않는 이유는 두 파서의 규칙이 다르기 때문이다. `marked`는 취소선 구분자로
 * 물결표 1개도 인정해 `1~3장 ... 4~5장` 같은 범위 표기를 취소선으로 만들고 글자를 지운다.
 * Confluence는 `~~`만 인정한다. 사용자가 직접 붙여넣었을 때와 같은 결과를 내는 쪽이 맞다.
 *
 * 구간은 **뒤에서부터** 처리한다. 앞 구간을 먼저 바꾸면 뒤 구간의 ProseMirror 위치가 어긋난다.
 *
 * docs/plans/confluence-magic-button/spec.md
 * docs/issue/2026-09-04-tilde-range-becomes-strikethrough.md
 */
async function runParagraphMarkdownPhase(
  editor: HTMLElement,
  onProgress: (done: number, total: number) => void,
): Promise<{ convertedRuns: number }> {
  const targets = collectParagraphRuns(editor).filter(
    (run) => findUnconvertedMarkdown(
      run.markdown.split('\n').map((line) => line.trim()),
      () => 0,
    ).length > 0,
  );
  if (targets.length === 0) return { convertedRuns: 0 };

  let convertedRuns = 0;
  onProgress(0, targets.length);

  for (const run of targets.reverse()) {
    const first = run.paragraphs[0];
    const last = run.paragraphs[run.paragraphs.length - 1];
    // 되돌리기 판정이 이 스냅샷과의 일치로 이뤄지므로 붙여넣기 직전에 잡는다.
    const beforeHtml = editor.innerHTML;

    /**
     * 교체 성공 판정에 쓸 표시 줄.
     *
     * ProseMirror는 문단 DOM 노드를 **재사용**한다. 실측에서 교체가 제대로 됐는데도 원래
     * 엘리먼트의 `isConnected`가 계속 `true`였다. 그래서 노드 동일성이 아니라 **문법이 남은
     * 줄이 사라졌는지**로 판정한다.
     */
    const signature = run.markdown
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^ {0,3}#{1,6}[ \t]+\S/.test(line) || line.includes('|'));

    await selectEditorRange(editor, first, last);
    const didReplace = (): boolean => {
      if (editor.innerHTML === beforeHtml) return false;
      if (!signature) return true;
      return !Array.from(
        editor.querySelectorAll<HTMLElement>('[data-prosemirror-node-name="paragraph"]'),
      ).some((paragraph) => (paragraph.textContent ?? '').trim() === signature);
    };

    try {
      await pastePlainTextAndWaitForChange(
        editor,
        run.markdown,
        didReplace,
        '문단으로 남은 Markdown을 원래 위치에서 교체하지 못했습니다.',
      );
    } catch (error) {
      if (!await rollbackEditorChange(editor, beforeHtml)) {
        throw new Error('Markdown 변환 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Confluence 실행 취소를 한 번 눌러주세요.');
      }
      throw error;
    }

    convertedRuns += 1;
    onProgress(convertedRuns, targets.length);
  }

  return { convertedRuns };
}

/** 두 단계의 결과를 버튼 라벨 한 줄로 요약한다. */
export function describeConversionResult(
  unwrapped: number,
  paragraphRuns: number,
  mermaid: number,
): string {
  if (unwrapped === 0 && paragraphRuns === 0 && mermaid === 0) return '변환할 내용이 없습니다';
  const parts: string[] = [];
  if (unwrapped > 0) parts.push(`코드블럭 ${unwrapped}`);
  if (paragraphRuns > 0) parts.push(`문단 ${paragraphRuns}`);
  if (mermaid > 0) parts.push(`Mermaid ${mermaid}`);
  return `${parts.join(' · ')} 변환`;
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
      <button type="button" data-action="markdown-convert" aria-label="Markdown 변환">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
          <path d="M14 3v5h5"></path>
          <path d="M9 13h6"></path><path d="M9 17h3"></path>
        </svg>
        <span data-markdown-convert-label>Markdown 변환</span>
      </button>
    `;

    const markdownButton = shadow.querySelector<HTMLButtonElement>('[data-action="markdown-convert"]');
    const markdownLabel = shadow.querySelector<HTMLElement>('[data-markdown-convert-label]');
    if (!markdownButton || !markdownLabel) return null;

    const setBusy = (busy: boolean): void => { markdownButton.disabled = busy; };
    /** 성공·무변경 결과는 잠깐 보여주고 원래 라벨로 되돌린다. */
    const resetLater = (): void => {
      const timer = window.setTimeout(() => {
        feedbackTimers.delete(timer);
        if (nextHost.isConnected) {
          setBusy(false);
          markdownLabel.textContent = 'Markdown 변환';
          markdownButton.removeAttribute('title');
        }
      }, 2200);
      feedbackTimers.add(timer);
    };

    /**
     * 실패와 진단 결과는 **다음 클릭까지 남긴다.**
     *
     * 2.2초 만에 사라지면 사용자가 원인 문구를 읽지 못한다. 실제로 Mermaid 변환이 실패했을 때
     * 사용자도 개발자도 어느 분기에서 끊겼는지 확인하지 못해 원인 규명이 막혔다. 버튼은 곧바로
     * 다시 누를 수 있게 풀어두고, 라벨과 hover 문구만 유지한다. 다음 클릭이 `확인 중`으로
     * 덮어쓴다.
     */
    const keepUntilNextClick = (): void => {
      if (nextHost.isConnected) setBusy(false);
    };

    /**
     * 한 번의 클릭에서 두 단계를 순서대로 수행한다.
     *
     * 1단계 코드블럭 벗기기는 `shouldUnwrapCodeBlocks()`가 참일 때만 실행한다. Markdown 원문의
     * ` ```mermaid ` 펜스는 1단계를 거쳐야 개별 코드블럭이 되므로 순서를 바꿀 수 없다.
     */
    markdownButton.addEventListener('click', async () => {
      setBusy(true);
      markdownLabel.textContent = '확인 중';
      markdownButton.removeAttribute('title');

      let unwrapped = 0;
      let paragraphRuns = 0;
      let mermaidConverted = 0;
      const notices: string[] = [];

      try {
        const getEditor = (): HTMLElement => {
          const found = context.document.querySelector<HTMLElement>(EDITOR_BODY);
          if (!found) throw new Error('Confluence 편집 본문을 찾을 수 없습니다.');
          return found;
        };

        let editor = getEditor();

        // 1단계가 문서를 바꾼 뒤에 걸리면 되돌리기 곤란하므로 미리 확인한다.
        const unpaired = countUnpairedMermaidExtensions(editor);
        if (unpaired > 0) {
          throw new Error(`문서 다른 위치에 Mermaid 컴포넌트 ${unpaired}개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.`);
        }

        if (shouldUnwrapCodeBlocks(editor)) {
          const result = await runCodeBlockPhase(editor, (done, total) => {
            unwrapped = done;
            markdownLabel.textContent = total > 1 ? `코드블럭 ${done}/${total}` : '코드블럭 변환 중';
          });
          unwrapped = result.convertedCount;
          notices.push(...result.warnings);
          if (result.protectedMermaidCount > 0) {
            notices.push(`Mermaid 컴포넌트 원본 ${result.protectedMermaidCount}개는 제외했습니다.`);
          }
          if (result.failures.length > 0) {
            notices.push(`원문을 읽지 못해 제외한 코드블럭 ${result.failures.length}개: ${result.failures.map(({ index }) => index + 1).join(', ')}번`);
          }
          // 1단계가 코드블럭 순번과 노드 참조를 모두 바꾸므로 본문을 다시 잡는다.
          editor = getEditor();
        }

        // 문단으로 남은 Markdown을 우리 변환기로 바꾼다. Confluence 평문 붙여넣기는 제목을
        // 변환하지 못하고 `#`만 지워버리므로 여기에 맡기지 않는다.
        const paragraphPhase = await runParagraphMarkdownPhase(editor, (done, total) => {
          paragraphRuns = done;
          markdownLabel.textContent = `문단 Markdown ${done}/${total}`;
        });
        paragraphRuns = paragraphPhase.convertedRuns;
        if (paragraphRuns > 0) editor = getEditor();

        markdownLabel.textContent = 'Mermaid 확인 중';
        const mermaid = await runMermaidPhase(editor, (done, total) => {
          mermaidConverted = done;
          markdownLabel.textContent = `Mermaid ${done}/${total}`;
        });
        mermaidConverted = mermaid.convertedCount;
        if (mermaid.failures.length > 0) {
          notices.push(`원문을 읽지 못해 제외한 Mermaid 후보 ${mermaid.failures.length}개: ${mermaid.failures.map(({ index }) => index + 1).join(', ')}번`);
        }

        if (unwrapped === 0 && paragraphRuns === 0 && mermaidConverted === 0) {
          const unconverted = findUnconvertedMarkdownInEditor(editor);
          if (unconverted) {
            markdownLabel.textContent = `미변환 Markdown · ${unconverted}`;
            markdownButton.title = [
              'Markdown이 코드블럭이 아니라 문단으로 들어와 있습니다.',
              `문단에 남은 문법: ${unconverted}`,
              '',
              '원문 전체를 코드블럭 하나에 넣은 뒤 다시 실행하세요.',
            ].join('\n');
            keepUntilNextClick();
            return;
          }
        }

        markdownLabel.textContent = describeConversionResult(unwrapped, paragraphRuns, mermaidConverted);
        if (notices.length > 0) {
          markdownButton.title = notices.join('\n');
          console.warn('[Inno Extension] Confluence Markdown 변환 안내', notices);
        }
      } catch (error) {
        console.error('[Inno Extension] Confluence Markdown 변환 실패', error);
        const message = error instanceof Error ? error.message : 'Markdown을 변환하지 못했습니다.';
        const cause = summarizeConversionFailure(message);
        markdownLabel.textContent = unwrapped + paragraphRuns + mermaidConverted > 0
          ? `${describeConversionResult(unwrapped, paragraphRuns, mermaidConverted)} · 일부 실패`
          : cause ? `변환 실패 · ${cause}` : '변환 실패';
        markdownButton.title = message;
        keepUntilNextClick();
        return;
      }

      resetLater();
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
