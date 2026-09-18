/**
 * Mermaid 코드블럭을 Confluence Mermaid 컴포넌트로 바꾸는 단계.
 *
 * **Confluence 전용이다.** Jira에는 Mermaid 앱이 설치돼 있지 않아 같은 노드를 넣어도 그릴
 * 주체가 없다. 편집기 삽입 메뉴에서 `mermaid`·`diagram` 어느 것도 검색되지 않는 것을 실측으로
 * 확인했다.
 *
 * docs/plans/jira-editor-markdown-to-adf/context.md
 */

import { readEditorCodeBlockText } from '../../../../platform/editor/code-block';
import {
  selectEditorNode,
} from '../../../../platform/editor/bridge-client';
import {
  EDITOR_CODE_BLOCK,
  EDITOR_UNDO_BUTTON,
} from '../../../../platform/editor/selectors';
import {
  findEditorTopLevelNode,
  matchesCodeBlockSource,
  pasteAndWaitForChange,
  readCodeBlockSources,
  waitForEditorChange,
  wrapsOnlyNode,
  type ExtraPhaseResult,
  type PhaseFailure,
} from '../../../../platform/editor/markdown-to-adf-runtime';
import {
  buildConfluenceMermaidReplacementHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  isMermaidCodeBlockSource,
} from './mermaid';

const EDITOR_EXTENSION = '[data-prosemirror-node-name="extension"]';
const EDITOR_EXPAND = '[data-prosemirror-node-name="expand"], [data-prosemirror-node-name="nestedExpand"]';

function isMermaidExtension(node: Element): boolean {
  const extensionKey = node.getAttribute('extensionkey')
    ?? node.getAttribute('data-extension-key');
  return node.getAttribute('data-prosemirror-node-name') === 'extension'
    && extensionKey === CONFLUENCE_MERMAID_EXTENSION_KEY;
}

function countMermaidExtensions(editor: HTMLElement): number {
  return Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_EXTENSION))
    .filter(isMermaidExtension).length;
}

function findMermaidExtensionByLocalId(
  editor: HTMLElement,
  localId: string,
): HTMLElement | undefined {
  return Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_EXTENSION)).find((extension) => (
    extension.getAttribute('localid') === localId
    || extension.getAttribute('data-local-id') === localId
  ));
}

export function isCollapsedMermaidSource(codeBlock: HTMLElement): boolean {
  return Boolean(codeBlock.closest(EDITOR_EXPAND));
}

/**
 * 브리지로 원문을 읽기 전에 DOM 원문으로 Mermaid 후보를 좁힌다.
 *
 * DOM 원문을 읽을 수 없는 코드블럭은 판정을 보류하고 후보로 남긴다. 잘못 걸러내면 변환 대상이
 * 사라지므로 확실히 Mermaid가 아닌 경우에만 제외한다.
 */
export function mayBeMermaidCodeBlock(codeBlock: HTMLElement): boolean {
  const domSource = readEditorCodeBlockText(codeBlock);
  if (!domSource.trim()) return true;
  return isMermaidCodeBlockSource(domSource);
}

/** 이미 `컴포넌트 + 접힌 원본`으로 변환이 끝난 코드블럭이면 `true`. 벗기기에서 제외한다. */
export function hasValidMermaidPair(editor: HTMLElement, codeBlock: HTMLElement): boolean {
  if (!isCollapsedMermaidSource(codeBlock)) return false;

  const sourceTopLevel = findEditorTopLevelNode(editor, codeBlock);
  const precedingTopLevel = sourceTopLevel?.previousElementSibling;
  return Boolean(precedingTopLevel && isMermaidExtension(precedingTopLevel));
}

/** 짝을 찾지 못한 기존 Mermaid 컴포넌트 수. 0보다 크면 중복 생성 위험이 있어 변환하지 않는다. */
export function countUnpairedMermaidExtensions(editor: HTMLElement): number {
  const pairedCount = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK))
    .filter((codeBlock) => mayBeMermaidCodeBlock(codeBlock))
    .filter((codeBlock) => hasValidMermaidPair(editor, codeBlock))
    .length;
  return countMermaidExtensions(editor) - pairedCount;
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
  const undoButton = editor.ownerDocument.querySelector<HTMLButtonElement>(EDITOR_UNDO_BUTTON);
  if (!undoButton || undoButton.disabled) return false;
  undoButton.click();

  return waitForEditorChange(editor, () => (
    !findMermaidExtensionByLocalId(editor, localId)
    && matchesMermaidSourceAtIndex(editor, codeBlockIndex, source, false)
  ));
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

/**
 * Mermaid 코드블럭을 `extension + 접힌 원본`으로 교체한다.
 *
 * 대상이 없으면 오류가 아니라 `convertedCount: 0`으로 끝낸다. 앞 단계만 수행하는 문서도 정상이다.
 */
export async function runMermaidPhase(
  editor: HTMLElement,
  onProgress: (done: number, total: number) => void,
): Promise<ExtraPhaseResult> {
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
    const noFailures: PhaseFailure[] = failures;
    if (noFailures.length > 0) {
      throw new Error(`Mermaid 후보 코드블럭 ${noFailures.length}개의 원문을 읽지 못했습니다. ${noFailures[0].message}`);
    }
    return { convertedCount: 0, failures: noFailures };
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
