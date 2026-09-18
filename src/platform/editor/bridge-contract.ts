/**
 * MAIN world 브리지의 계약.
 *
 * content script(ISOLATED world)는 페이지가 만든 객체를 볼 수 없다. ProseMirror의
 * `EditorView`가 그렇다. 그래서 MAIN world에 스크립트를 심고 `CustomEvent`로 주고받는다.
 *
 * **대상 노드는 우리가 붙이는 표식으로 지정한다.** 예전에는 Atlassian이 붙이는
 * `data-local-id`를 썼는데, Jira에서 갓 불러온 문서의 노드에는 그 속성이 없다(붙여넣기로 새로
 * 만들어진 노드에는 있다). 있을 때도 없을 때도 있는 값을 주소로 쓸 수 없다.
 *
 * 두 world는 **같은 DOM**을 본다. ISOLATED에서 속성을 붙이면 MAIN에서 그대로 보인다.
 *
 * docs/plans/jira-editor-markdown-to-adf/context.md
 */

export const BRIDGE_REQUEST_EVENT = 'inno-extension:prosemirror-bridge:request';
export const BRIDGE_RESPONSE_EVENT = 'inno-extension:prosemirror-bridge:response';

/** 브리지가 찾을 대상에 임시로 붙이는 속성. 요청이 끝나면 지운다. */
export const BRIDGE_TARGET_ATTRIBUTE = 'data-inno-bridge-target';

export type BridgeAction = 'read-node' | 'read-doc' | 'select-node' | 'select-range';

export interface BridgeRequest {
  action: BridgeAction;
  requestId: string;
  /** 대상 노드의 표식 값 */
  target: string;
  /** `select-range`에서 구간의 끝 노드 표식. 없으면 `target`과 같다 */
  endTarget: string;
  /** codeBlock으로 좁힐 때 쓰는 노드 이름. `select-node`에서만 의미가 있다 */
  nodeName?: string;
}

export interface BridgeResponse {
  requestId?: unknown;
  success?: unknown;
  message?: unknown;
  text?: unknown;
}
