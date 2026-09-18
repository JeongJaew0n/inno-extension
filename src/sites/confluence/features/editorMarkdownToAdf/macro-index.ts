/**
 * Mermaid 매크로가 세는 방식대로 코드블럭 순번을 계산한다.
 *
 * 매크로는 원문을 자기 안에 담지 않고 `guestParams.index` 로 **페이지의 N번째 코드블럭**을
 * 읽는다. 그런데 **매크로가 세는 N 과 우리가 세는 N 이 다르다.**
 *
 * | 코드블럭 위치 | 매크로가 세나 | 근거 |
 * | --- | --- | --- |
 * | 최상위 | 센다 | 기본 |
 * | `expand` 안 | **센다** | 변환 결과의 원본이 항상 expand 안에 들어가는데 잘 동작해 왔다 |
 * | 목록 안 | **세지 않는다** | 아래 실측 |
 * | 그 외(표·인용 등) | **모른다** | 확인하지 못했다 |
 *
 * ## 목록 안을 세지 않는다는 실측
 *
 * 코드블럭 7개짜리 문서(1번이 목록 안)에서 우리가 `index: 3`(flowchart)을 넣었더니 매크로가
 * **우리 기준 4번**(`2. https://0c3bb825...`)을 읽어 문법 오류를 냈다. 목록 안 1개를 빼고 세면
 * 매크로 기준 3번이 정확히 그 블록이다. 같은 문서의 두 번째 매크로(`index: 6`)는 **범위를
 * 벗어나** 역시 그려지지 않았다. 두 예측이 모두 맞았다.
 *
 * docs/troubleshootings/reusable/2026-09-18-confluence-mermaid-macro-index-skips-lists.md
 */

import { EDITOR_CODE_BLOCK } from '../../../../platform/editor/selectors';

const EDITOR_LIST = '[data-prosemirror-node-name="bulletList"],'
  + '[data-prosemirror-node-name="orderedList"],'
  + '[data-prosemirror-node-name="listItem"]';
const EDITOR_EXPAND = '[data-prosemirror-node-name="expand"],'
  + '[data-prosemirror-node-name="nestedExpand"]';

export type CodeBlockPlacement = 'topLevel' | 'expand' | 'list' | 'unknown';

/**
 * 코드블럭이 어디에 놓여 있는지.
 *
 * `unknown` 은 **확인하지 못한 자리**다. 표 칸이나 인용 안이 여기 해당한다. 매크로가 그것을
 * 세는지 모르므로 추측하지 않는다.
 */
export function codeBlockPlacement(
  editor: HTMLElement,
  codeBlock: HTMLElement,
): CodeBlockPlacement {
  if (codeBlock.closest(EDITOR_LIST)) return 'list';
  if (codeBlock.closest(EDITOR_EXPAND)) return 'expand';

  // 최상위 판정 — 편집기는 코드블럭을 breakout 래퍼로 감싸므로 직계 자식이 아닐 수 있다.
  let current: HTMLElement = codeBlock;
  while (current.parentElement && current.parentElement !== editor) {
    const name = current.parentElement.getAttribute('data-prosemirror-node-name');
    // 노드 이름이 붙은 조상이 있으면 그 안에 들어 있다는 뜻이다.
    if (name) return 'unknown';
    current = current.parentElement;
  }
  return current.parentElement === editor ? 'topLevel' : 'unknown';
}

/**
 * 자리 목록에서 매크로 순번을 센다. DOM 과 무관한 순수 함수라 따로 둔다.
 *
 * 앞쪽에 **확인하지 못한 자리**의 코드블럭이 하나라도 있으면 `null` 이다. 그 경우 순번을 맞출 수
 * 없고, 틀린 순번으로 매크로를 만들면 **엉뚱한 코드블럭을 다이어그램으로 그리려다 실패한다.**
 * 만들지 않는 편이 낫다.
 *
 * 대상 자신이 목록 안이면 매크로가 애초에 그것을 가리킬 수 없으므로 역시 `null` 이다.
 */
export function macroIndexFromPlacements(
  placements: readonly CodeBlockPlacement[],
  position: number,
): number | null {
  if (position < 0 || position >= placements.length) return null;
  if (placements[position] === 'list') return null;

  let index = 0;
  for (let i = 0; i < position; i += 1) {
    if (placements[i] === 'unknown') return null;
    if (placements[i] === 'list') continue;
    index += 1;
  }
  return index;
}

/** 편집기 DOM 에서 자리를 읽어 매크로 순번을 구한다. */
export function macroCodeBlockIndex(
  editor: HTMLElement,
  codeBlock: HTMLElement,
): number | null {
  const all = Array.from(editor.querySelectorAll<HTMLElement>(EDITOR_CODE_BLOCK));
  const position = all.indexOf(codeBlock);
  return macroIndexFromPlacements(
    all.map((block) => codeBlockPlacement(editor, block)),
    position,
  );
}
