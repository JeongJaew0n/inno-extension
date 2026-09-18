/**
 * Atlassian ADF 편집기의 `Markdown 변환` 버튼 — 사이트 공용 구현.
 *
 * Confluence와 Jira가 같은 편집기를 쓴다. 사이트마다 다른 것은 **어느 화면의 어느 편집기를
 * 대상으로 삼는가**와 **뒤에 붙는 추가 단계가 있는가**뿐이다. 그 둘만 `EditorMarkdownToAdfSite`
 * 로 받고 나머지는 여기서 처리한다.
 *
 * 공통 단계는 둘이다.
 *
 * 1. **코드블럭 벗기기** — 원문을 통째로 담은 코드블럭을 Markdown으로 해석해 원위치 ADF로 교체
 * 2. **문단 Markdown 변환** — 문단으로 남은 Markdown을 편집기 자체 파서에 다시 맡긴다
 *
 * Confluence는 뒤에 Mermaid 단계를 더 붙인다. **Jira에는 Mermaid 앱이 없어 붙이지 않는다.**
 *
 * docs/plans/confluence-magic-button/spec.md
 * docs/plans/jira-editor-markdown-to-adf/spec.md
 */

import { FEATURE_ROOT_ATTRIBUTE } from '../runtime/featureRoot';
import type { FeatureRuntime, PageContext } from '../runtime/types';
import type { FeatureId } from '../../catalog/types';
import type { CodeBlockAdfPayload } from './code-block-to-adf';
import { readEditorCodeBlockText } from './code-block';
import {
  describeUnconvertedMarkdown,
  findUnconvertedMarkdown,
  looksLikeMarkdownDocument,
} from './markdown-detection';
import {
  readProseMirrorCodeBlockText,
  selectEditorNode,
  selectEditorRange,
} from './bridge-client';
import {
  EDITOR_CODE_BLOCK,
  EDITOR_PARAGRAPH,
  EDITOR_PROSEMIRROR,
  EDITOR_UNDO_BUTTON,
} from './selectors';

/** 붙여넣기 결과가 DOM에 반영되기를 기다리는 한도. */
const EDITOR_CHANGE_TIMEOUT_MS = 3000;

/**
 * Markdown -> ADF 변환기를 클릭 시점에 불러온다.
 *
 * 이 모듈은 `marked` 파서를 끌어오며 번들에서 47KB를 차지한다. 정적으로 import하면 대상 사이트의
 * 모든 페이지에서 파싱·평가되는데, 실제로 필요한 조건은 기능이 켜져 있고(기본값 OFF) 사용자가
 * 편집 화면에서 변환 버튼을 누른 경우뿐이다. 문서를 읽기만 하는 사용자는 한 번도 쓰지 않는다.
 *
 * 모듈 평가는 한 번만 일어나고 이후 호출은 같은 Promise를 재사용한다.
 */
let codeBlockConverterPromise: Promise<(markdown: string) => CodeBlockAdfPayload> | null = null;

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

export interface PhaseFailure {
  index: number;
  message: string;
}

export interface ExtraPhaseResult {
  convertedCount: number;
  failures: PhaseFailure[];
}

/** 사이트가 채워 넣는 부분. 이것 말고는 두 사이트가 같다. */
export interface EditorMarkdownToAdfSite {
  featureId: FeatureId;
  /** 주입 루트를 표시할 값 */
  rootAttributeValue: string;
  /** 사용자에게 보여줄 사이트 이름. 되돌리기 안내 문구에 쓴다 */
  siteName: string;
  /**
   * 이 화면이 대상인지 판정한다.
   *
   * `container`는 편집기를 담은 안정적인 조상이다. 단계마다 본문을 다시 잡을 때 이 안에서
   * 찾는다. **Jira는 한 화면에 편집기가 여럿(설명·댓글)이라 문서 전체에서 찾으면 안 된다.**
   *
   * `key`가 바뀌면 버튼을 다시 만든다.
   */
  resolveTarget(context: PageContext): { toolbar: HTMLElement; container: HTMLElement; key: string } | null;
  /**
   * 툴바 안에서 버튼이 놓일 자리.
   *
   * `end`는 툴바 오른쪽 끝으로 민다. Jira 설명 편집기의 툴바는 폭이 862px인데 마지막 항목이
   * 600px 언저리에서 끝나 오른쪽이 260px 넘게 비어 있다. 아이콘 줄에 바짝 붙이면 편집기 자체
   * 버튼과 섞여 보인다.
   *
   * 기본값 `start`는 마지막 항목 바로 뒤다. Confluence가 이 배치를 쓴다.
   */
  toolbarAlign?: 'start' | 'end';
  /** 벗기기에서 제외할 코드블럭. Confluence의 이미 변환된 Mermaid 원본이 여기 해당한다 */
  isProtectedCodeBlock?(editor: HTMLElement, codeBlock: HTMLElement): boolean;
  /** 1단계 전에 확인할 것. 던지면 아무것도 바꾸지 않고 중단한다 */
  precheck?(editor: HTMLElement): void;
  /**
   * 추가 단계가 실제로 무언가를 변환했을 때 덧붙일 안내.
   *
   * Confluence Mermaid 컴포넌트는 **변환 직후에만** 엉뚱한 코드블럭을 가리켜 오류 화면을 낸다.
   * 문서를 그대로 두고 새로고침하면 정상으로 그려지는 것을 실측으로 확인했다. 안내가 없으면
   * 사용자가 변환이 실패했다고 오해한다.
   *
   * docs/troubleshootings/reusable/2026-09-18-confluence-mermaid-macro-renders-before-document-settles.md
   */
  extraPhaseNotice?: string;
  /** 두 단계 뒤에 붙는 사이트 전용 단계 */
  extraPhase?: {
    /** 결과 요약과 진행 라벨에 쓰는 이름 */
    name: string;
    run(
      editor: HTMLElement,
      onProgress: (done: number, total: number) => void,
    ): Promise<ExtraPhaseResult>;
  };
}

export interface CodeBlockSource {
  codeBlock: HTMLElement;
  index: number;
  source: string;
}

export interface CodeBlockSourceReadResult {
  failures: PhaseFailure[];
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
  const failures: PhaseFailure[] = [];

  for (const { codeBlock, index } of entries) {
    try {
      sources.push({ codeBlock, index, source: await readSource(editor, codeBlock) });
    } catch (error) {
      failures.push({
        index,
        message: error instanceof Error ? error.message : 'codeBlock 원문을 읽지 못했습니다.',
      });
    }
  }

  return { failures, sources };
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

export function waitForEditorChange(
  editor: HTMLElement,
  didChange: () => boolean,
  timeoutMs: number = EDITOR_CHANGE_TIMEOUT_MS,
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
 * `text/html`이 함께 있으면 편집기가 그쪽을 우선하므로 Markdown 파서를 타지 않는다.
 * 문단으로 남은 Markdown은 편집기 자체 파서에 맡기는 것이 낫다. 그쪽이 이 편집기의 실제
 * 규칙이고, 우리 변환기와 달리 취소선 구분자로 `~~`만 인정해 `1~3`ㆍ`4~5` 같은 범위 표기를
 * 깨뜨리지 않는다.
 *
 * docs/issue/2026-09-04-tilde-range-becomes-strikethrough.md
 */
export async function pastePlainTextAndWaitForChange(
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

  if (!await waitForEditorChange(editor, didChange)) throw new Error(failureMessage);
}

export async function pasteAndWaitForChange(
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

  if (!await waitForEditorChange(editor, didChange)) throw new Error(failureMessage);
}

export interface EditorSnapshot {
  html: string;
  text: string;
}

export function snapshotEditor(editor: HTMLElement): EditorSnapshot {
  return { html: editor.innerHTML, text: editor.textContent ?? '' };
}

/**
 * 실행 취소를 눌러 되돌린다.
 *
 * 복원 판정에 `innerHTML` 완전 일치**만** 쓰면 안 된다. **CodeMirror가 자동 생성하는 스타일
 * 스코프 클래스명이 다시 렌더될 때마다 바뀐다.** 실측에서 실행 취소로 내용이 완전히 복원됐는데도
 * (길이까지 5645자로 동일) 469번째 글자의 `ͼ1r`이 `ͼ27`로 바뀌어 영영 일치하지 않았다.
 * 코드블럭이 든 문서에서는 이 비교가 성립할 수 없다.
 *
 * 그래서 `textContent` 일치도 성공으로 본다. 생성 클래스명에 영향받지 않는다.
 *
 * docs/troubleshootings/project-specific/2026-09-17-code-block-phase-false-failure.md
 */
export async function rollbackEditorChange(
  editor: HTMLElement,
  before: EditorSnapshot,
): Promise<boolean> {
  const undoButton = editor.ownerDocument.querySelector<HTMLButtonElement>(EDITOR_UNDO_BUTTON);
  if (!undoButton || undoButton.disabled) return false;
  undoButton.click();
  return waitForEditorChange(editor, () => (
    editor.innerHTML === before.html || (editor.textContent ?? '') === before.text
  ));
}

/** `container`가 `node` 하나만 콘텐츠로 담고 있으면 `true`. */
export function wrapsOnlyNode(container: HTMLElement, node: HTMLElement): boolean {
  const innerNodes = Array.from(
    container.querySelectorAll<HTMLElement>('[data-prosemirror-node-name]'),
  );
  return innerNodes.length === 1 && innerNodes[0] === node;
}

export function findEditorTopLevelNode(editor: HTMLElement, node: HTMLElement): HTMLElement | null {
  let current = node;
  while (current.parentElement && current.parentElement !== editor) {
    current = current.parentElement;
  }
  return current.parentElement === editor ? current : null;
}

/**
 * 코드블럭이 본문 최상위에 있으면 `true`.
 *
 * 편집기는 코드블럭을 `.fabric-editor-breakout-mark` 래퍼로 감싸므로 편집기의 직계 자식이
 * 아니다. `editor.children`에서 codeBlock을 찾으면 하나도 나오지 않는다. `findEditorTopLevelNode()`가
 * 돌려주는 최상위 노드가 이 코드블럭만 담고 있는지로 판정한다.
 *
 * 목록·인용·표 안의 코드블럭은 그 컨테이너가 최상위가 되므로 `false`다.
 */
export function isTopLevelCodeBlock(editor: HTMLElement, codeBlock: HTMLElement): boolean {
  const topLevel = findEditorTopLevelNode(editor, codeBlock);
  if (!topLevel) return false;
  return topLevel === codeBlock || wrapsOnlyNode(topLevel, codeBlock);
}

/**
 * DOM에서 읽은 코드블럭 원문이 `source`와 같은 내용인지 판정한다.
 *
 * CodeMirror는 코드블럭을 30줄 안팎까지만 DOM에 렌더한다. 그래서 긴 블록에서는
 * `readEditorCodeBlockText()`가 원문의 일부만 돌려준다. 붙여넣을 `source`는 브리지로
 * ProseMirror node에서 전체를 읽으므로, 등호로 비교하면 31줄 이상인 블록은 검증을 영원히
 * 통과하지 못한다. 실측에서 35줄(748자) 블록의 DOM 읽기가 30줄(631자)에서 끊겼다.
 *
 * 렌더된 구간이 원문의 연속 부분이면 같은 블록으로 본다. 블록 내부 스크롤 위치에 따라 앞이
 * 아니라 중간이 렌더될 수 있으므로 접두사가 아니라 부분 문자열로 확인한다.
 *
 * 아무것도 렌더되지 않은 경우(`''`)는 통과시키지 않는다. 빈 문자열은 모든 원문의 부분
 * 문자열이라 검증이 무조건 참이 되기 때문이다.
 *
 * docs/issue/2026-09-04-mermaid-verification-reads-truncated-dom.md
 */
export function matchesCodeBlockSource(codeBlock: HTMLElement, source: string): boolean {
  const domSource = readEditorCodeBlockText(codeBlock);
  if (!domSource) return source === '';
  return source === domSource || source.includes(domSource);
}

function listCodeBlocks(editor: HTMLElement): HTMLElement[] {
  return Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK));
}

/**
 * 문서가 담은 ProseMirror 노드 수.
 *
 * 교체 여부를 구조로 판정할 때 쓴다. 데코레이션(`ProseMirror-widget`)은 `data-prosemirror-node-name`
 * 을 갖지 않으므로 세어지지 않는다. 그래서 편집기가 장식을 붙였다 뗐다 해도 값이 흔들리지 않는다.
 */
function countEditorNodes(editor: HTMLElement): number {
  return editor.querySelectorAll('[data-prosemirror-node-name]').length;
}

/**
 * 코드블럭 벗기기를 실행할지 판정한다.
 *
 * 벗기기는 대상 코드블럭을 Markdown으로 해석해 산문으로 풀어버린다. 실제 소스 코드에 실행하면
 * 코드가 사라지므로, Markdown 원문을 통째로 붙여넣은 문서일 때만 실행한다.
 *
 * 세 조건을 모두 요구한다.
 *
 * 1. 보호 대상이 아닌 코드블럭이 하나 이상 있다
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
export function shouldUnwrapCodeBlocks(
  editor: HTMLElement,
  isProtected: (editor: HTMLElement, codeBlock: HTMLElement) => boolean = () => false,
): boolean {
  const codeBlocks = listCodeBlocks(editor).filter((codeBlock) => !isProtected(editor, codeBlock));
  if (codeBlocks.length === 0) return false;
  if (!codeBlocks.some((codeBlock) => isTopLevelCodeBlock(editor, codeBlock))) return false;
  return codeBlocks.every(
    (codeBlock) => looksLikeMarkdownDocument(readEditorCodeBlockText(codeBlock)),
  );
}

export interface CodeBlockPhaseResult {
  convertedCount: number;
  failures: PhaseFailure[];
  warnings: string[];
  protectedCount: number;
}

async function replaceCodeBlockWithAdf(
  editor: HTMLElement,
  index: number,
  html: string,
  markdown: string,
  siteName: string,
): Promise<void> {
  /**
   * 순번으로 다시 찾는다.
   *
   * 예전에는 Atlassian이 붙이는 `data-local-id`로 찾았는데 **Jira에는 그 속성이 없을 때가
   * 있다.** 교체는 뒤에서 앞으로 진행하므로, `index`보다 앞에 있는 코드블럭은 아직 손대지
   * 않은 상태다. 순번이 어긋나지 않는다.
   */
  const codeBlock = listCodeBlocks(editor)[index];
  if (!codeBlock) throw new Error('변환할 코드블럭의 현재 위치를 찾을 수 없습니다.');
  // 원문은 **선택 전에** 읽는다. 노드를 선택하면 CodeMirror가 내용을 다시 그려서 그 직후에는
  // 빈 문자열이 읽히는 것을 실측으로 확인했다.
  const beforeSource = readEditorCodeBlockText(codeBlock);
  const beforeNodeCount = countEditorNodes(editor);

  await selectEditorNode(editor, codeBlock);
  const before = snapshotEditor(editor);

  /**
   * 원본 코드블럭이 교체됐는지 판정한다.
   *
   * `!codeBlock.isConnected`만 보면 안 된다. **ProseMirror는 DOM 노드를 재사용한다.** 변환
   * 결과물 안에 코드블럭이 들어 있으면 원본 엘리먼트가 **결과물의 새 코드블럭으로 넘어가서**
   * 교체가 끝났는데도 `isConnected`가 계속 `true`다. 실측에서 3초 내내 `true`였고, 그 엘리먼트의
   * 텍스트는 이미 새 코드블럭의 내용으로 바뀌어 있었다.
   *
   * 세 신호 중 하나라도 서면 교체된 것으로 본다.
   *
   * | 신호 | 왜 |
   * | --- | --- |
   * | 노드가 사라짐 | 재사용되지 않은 보통의 경우 |
   * | **문서의 노드 수가 달라짐** | 코드블럭 하나가 여러 노드로 풀린다. 재사용과 무관하다 |
   * | 코드블럭 원문이 달라짐 | 재사용된 엘리먼트가 다른 내용을 담게 됐다 |
   *
   * `innerHTML` 변화는 신호로 쓰지 않는다. **CodeMirror가 자동 생성하는 클래스명이 다시 렌더될
   * 때마다 바뀌어** 붙여넣기와 무관하게 문자열이 달라진다.
   *
   * docs/troubleshootings/project-specific/2026-09-17-code-block-phase-false-failure.md
   */
  const didReplace = (): boolean => (
    !codeBlock.isConnected
    || countEditorNodes(editor) !== beforeNodeCount
    || readEditorCodeBlockText(codeBlock) !== beforeSource
  );

  try {
    await pasteAndWaitForChange(
      editor,
      html,
      markdown,
      didReplace,
      '코드블럭을 원래 위치의 ADF 내용으로 교체하지 못했습니다.',
    );
  } catch (error) {
    if (editor.innerHTML !== before.html && !await rollbackEditorChange(editor, before)) {
      throw new Error(`코드블럭 -> ADF 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. ${siteName} 실행 취소를 한 번 눌러주세요.`);
    }
    throw error;
  }
}

/**
 * 1단계 — 코드블럭 원문을 Markdown으로 해석해 원위치 ADF로 교체한다.
 *
 * 실행 여부는 `shouldUnwrapCodeBlocks()`가 가른다.
 */
export async function runCodeBlockPhase(
  editor: HTMLElement,
  onProgress: (done: number, total: number) => void,
  options: {
    siteName: string;
    isProtected?: (editor: HTMLElement, codeBlock: HTMLElement) => boolean;
    protectedNotice?: string;
  },
): Promise<CodeBlockPhaseResult> {
  const isProtected = options.isProtected ?? (() => false);
  const codeBlocks = listCodeBlocks(editor).map((codeBlock, index) => ({ codeBlock, index }));
  if (codeBlocks.length === 0) throw new Error('ADF로 변환할 코드블럭이 없습니다.');

  const protectedCount = codeBlocks
    .filter(({ codeBlock }) => isProtected(editor, codeBlock)).length;
  // 보호 대상은 읽지 않는다. 변환하지 않을 블록까지 읽으면 브리지 요청만 늘어난다.
  const { failures, sources } = await readCodeBlockSources(
    editor,
    codeBlocks.filter(({ codeBlock }) => !isProtected(editor, codeBlock)),
  );
  const convertMarkdown = await loadCodeBlockConverter();
  const candidates = sources.map(({ index, source }) => ({
    index,
    payload: convertMarkdown(source),
  }));
  if (candidates.length === 0) {
    if (failures.length > 0) {
      throw new Error(`코드블럭 ${failures.length}개의 원문을 읽지 못했습니다. ${failures[0].message}`);
    }
    throw new Error(`ADF로 변환할 코드블럭이 없습니다.${options.protectedNotice ? ` ${options.protectedNotice}` : ''}`);
  }

  const warnings = candidates.flatMap(({ index, payload }) => (
    payload.warnings.map((warning) => `코드블럭 ${index + 1}: ${warning}`)
  ));

  let convertedCount = 0;
  const total = candidates.length;
  onProgress(0, total);
  for (const { index, payload } of candidates.reverse()) {
    await replaceCodeBlockWithAdf(editor, index, payload.html, payload.markdown, options.siteName);
    convertedCount += 1;
    onProgress(convertedCount, total);
  }

  return { convertedCount, failures, warnings, protectedCount };
}

/**
 * 편집 본문에서 변환되지 않고 문단으로 남은 Markdown을 찾는다.
 *
 * 모든 단계가 할 일이 없을 때만 호출한다. 그 경우 `변환할 내용이 없습니다`만 보여주면 사용자가
 * 원인을 알 수 없기 때문이다. 코드블럭이 아니라 문단으로 붙여넣은 Markdown이 이 상태가 된다.
 */
export function findUnconvertedMarkdownInEditor(editor: HTMLElement): string {
  const paragraphTexts = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_PARAGRAPH))
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
 * 편집기가 붙여넣기 과정에서 이미 변환해 둔 노드(목록·표 등)는 문단이 아니므로 구간을
 * 끊는다. 그 노드들은 건드리지 않고 그대로 둔다.
 */
export function collectParagraphRuns(editor: HTMLElement): ParagraphRun[] {
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
 * 2단계 — 문단으로 남은 Markdown을 편집기에 다시 맡긴다.
 *
 * 구간의 문단 텍스트를 그대로 이어 붙여 **평문으로 다시 붙여넣는다.** 그러면 편집기 자체
 * Markdown 파서가 제목·표·코드블럭·목록·인용을 만들어 준다. Confluence와 Jira 양쪽에서
 * 실측으로 확인했다.
 *
 * 우리 변환기를 쓰지 않는 이유는 두 파서의 규칙이 다르기 때문이다. `marked`는 취소선 구분자로
 * 물결표 1개도 인정해 `1~3장 ... 4~5장` 같은 범위 표기를 취소선으로 만들고 글자를 지운다.
 * 편집기는 `~~`만 인정한다. 사용자가 직접 붙여넣었을 때와 같은 결과를 내는 쪽이 맞다.
 *
 * 구간은 **뒤에서부터** 처리한다. 앞 구간을 먼저 바꾸면 뒤 구간의 ProseMirror 위치가 어긋난다.
 *
 * docs/issue/2026-09-04-tilde-range-becomes-strikethrough.md
 */
export async function runParagraphMarkdownPhase(
  editor: HTMLElement,
  onProgress: (done: number, total: number) => void,
  siteName: string,
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
    const before = snapshotEditor(editor);

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
      if (editor.innerHTML === before.html) return false;
      if (!signature) return true;
      return !Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_PARAGRAPH))
        .some((paragraph) => (paragraph.textContent ?? '').trim() === signature);
    };

    try {
      await pastePlainTextAndWaitForChange(
        editor,
        run.markdown,
        didReplace,
        '문단으로 남은 Markdown을 원래 위치에서 교체하지 못했습니다.',
      );
    } catch (error) {
      if (!await rollbackEditorChange(editor, before)) {
        throw new Error(`Markdown 변환 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. ${siteName} 실행 취소를 한 번 눌러주세요.`);
      }
      throw error;
    }

    convertedRuns += 1;
    onProgress(convertedRuns, targets.length);
  }

  return { convertedRuns };
}

/** 각 단계의 결과를 버튼 라벨 한 줄로 요약한다. */
export function describeConversionResult(
  unwrapped: number,
  paragraphRuns: number,
  extra = 0,
  extraName = 'Mermaid',
): string {
  if (unwrapped === 0 && paragraphRuns === 0 && extra === 0) return '변환할 내용이 없습니다';
  const parts: string[] = [];
  if (unwrapped > 0) parts.push(`코드블럭 ${unwrapped}`);
  if (paragraphRuns > 0) parts.push(`문단 ${paragraphRuns}`);
  if (extra > 0) parts.push(`${extraName} ${extra}`);
  return `${parts.join(' · ')} 변환`;
}

export function createEditorMarkdownToAdfRuntime(site: EditorMarkdownToAdfSite): FeatureRuntime {
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
    container: HTMLElement,
    key: string,
  ): HTMLSpanElement | null {
    const nextHost = context.document.createElement('span');
    nextHost.setAttribute(FEATURE_ROOT_ATTRIBUTE, site.rootAttributeValue);
    nextHost.dataset.targetKey = key;
    nextHost.style.all = 'initial';
    nextHost.style.display = 'inline-flex';
    nextHost.style.alignItems = 'center';
    // 툴바가 flex 라 `auto` 마진이 남은 공간을 전부 먹어 버튼을 오른쪽 끝으로 민다.
    nextHost.style.marginInlineStart = site.toolbarAlign === 'end' ? 'auto' : '4px';
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
     * 한 번의 클릭에서 단계를 순서대로 수행한다.
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
      let extraConverted = 0;
      const notices: string[] = [];
      const extraName = site.extraPhase?.name ?? 'Mermaid';

      try {
        /** 단계마다 본문을 다시 잡는다. **컨테이너 안에서만** 찾아야 다른 편집기를 잡지 않는다. */
        const getEditor = (): HTMLElement => {
          const found = container.querySelector<HTMLElement>(EDITOR_PROSEMIRROR);
          if (!found) throw new Error(`${site.siteName} 편집 본문을 찾을 수 없습니다.`);
          return found;
        };

        let editor = getEditor();

        // 1단계가 문서를 바꾼 뒤에 걸리면 되돌리기 곤란하므로 미리 확인한다.
        site.precheck?.(editor);

        if (shouldUnwrapCodeBlocks(editor, site.isProtectedCodeBlock)) {
          const result = await runCodeBlockPhase(
            editor,
            (done, total) => {
              unwrapped = done;
              markdownLabel.textContent = total > 1 ? `코드블럭 ${done}/${total}` : '코드블럭 변환 중';
            },
            {
              siteName: site.siteName,
              isProtected: site.isProtectedCodeBlock,
              protectedNotice: site.extraPhase ? 'Mermaid 컴포넌트 원본은 보호됩니다.' : undefined,
            },
          );
          unwrapped = result.convertedCount;
          notices.push(...result.warnings);
          if (result.protectedCount > 0) {
            notices.push(`Mermaid 컴포넌트 원본 ${result.protectedCount}개는 제외했습니다.`);
          }
          if (result.failures.length > 0) {
            notices.push(`원문을 읽지 못해 제외한 코드블럭 ${result.failures.length}개: ${result.failures.map(({ index }) => index + 1).join(', ')}번`);
          }
          // 1단계가 코드블럭 순번과 노드 참조를 모두 바꾸므로 본문을 다시 잡는다.
          editor = getEditor();
        }

        const paragraphPhase = await runParagraphMarkdownPhase(editor, (done, total) => {
          paragraphRuns = done;
          markdownLabel.textContent = `문단 Markdown ${done}/${total}`;
        }, site.siteName);
        paragraphRuns = paragraphPhase.convertedRuns;
        if (paragraphRuns > 0) editor = getEditor();

        if (site.extraPhase) {
          markdownLabel.textContent = `${extraName} 확인 중`;
          const extra = await site.extraPhase.run(editor, (done, total) => {
            extraConverted = done;
            markdownLabel.textContent = `${extraName} ${done}/${total}`;
          });
          extraConverted = extra.convertedCount;
          if (extraConverted > 0 && site.extraPhaseNotice) {
            notices.push(site.extraPhaseNotice);
          }
          if (extra.failures.length > 0) {
            notices.push(`원문을 읽지 못해 제외한 ${extraName} 후보 ${extra.failures.length}개: ${extra.failures.map(({ index }) => index + 1).join(', ')}번`);
          }
        }

        if (unwrapped === 0 && paragraphRuns === 0 && extraConverted === 0) {
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

        markdownLabel.textContent = describeConversionResult(
          unwrapped,
          paragraphRuns,
          extraConverted,
          extraName,
        );
        if (notices.length > 0) {
          markdownButton.title = notices.join('\n');
          console.warn(`[Inno Extension] ${site.siteName} Markdown 변환 안내`, notices);
        }
      } catch (error) {
        console.error(`[Inno Extension] ${site.siteName} Markdown 변환 실패`, error);
        const message = error instanceof Error ? error.message : 'Markdown을 변환하지 못했습니다.';
        const cause = summarizeConversionFailure(message);
        markdownLabel.textContent = unwrapped + paragraphRuns + extraConverted > 0
          ? `${describeConversionResult(unwrapped, paragraphRuns, extraConverted, extraName)} · 일부 실패`
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
    id: site.featureId,

    reconcile(context: PageContext): void {
      const target = site.resolveTarget(context);
      if (!target) {
        dispose();
        return;
      }

      if (host?.isConnected
        && host.dataset.targetKey === target.key
        && host.parentElement === target.toolbar) {
        return;
      }

      dispose();
      host = createButtonHost(context, target.toolbar, target.container, target.key);
    },

    dispose,
  };
}
