/**
 * ISOLATED world 쪽 브리지 호출부.
 *
 * 대상 노드에 임시 표식을 붙여 MAIN world에 알린다. 이유는 `bridge-contract.ts`에 있다.
 */

import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  BRIDGE_TARGET_ATTRIBUTE,
  type BridgeAction,
  type BridgeResponse,
} from './bridge-contract';

const BRIDGE_TIMEOUT_MS = 1000;

let markCounter = 0;

function nextMark(): string {
  markCounter += 1;
  return `${Date.now().toString(36)}-${markCounter}`;
}

async function requestBridge(
  editor: HTMLElement,
  action: BridgeAction,
  node: HTMLElement,
  endNode?: HTMLElement,
  nodeName?: string,
): Promise<BridgeResponse> {
  const document = editor.ownerDocument;
  const requestId = crypto.randomUUID();
  const targetMark = nextMark();
  const endMark = endNode && endNode !== node ? nextMark() : targetMark;

  node.setAttribute(BRIDGE_TARGET_ATTRIBUTE, targetMark);
  if (endNode && endMark !== targetMark) endNode.setAttribute(BRIDGE_TARGET_ATTRIBUTE, endMark);

  try {
    return await new Promise<BridgeResponse>((resolve, reject) => {
      const finish = (error?: Error): void => {
        document.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
        window.clearTimeout(timer);
        if (error) reject(error);
      };
      const onResponse = (event: Event): void => {
        if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
        let detail: BridgeResponse;
        try {
          detail = JSON.parse(event.detail) as BridgeResponse;
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
              : '편집기 상태 처리에 실패했습니다.',
          ));
        }
      };
      const timer = window.setTimeout(
        () => finish(new Error('편집기 상태 브리지가 응답하지 않았습니다.')),
        BRIDGE_TIMEOUT_MS,
      );

      document.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      document.dispatchEvent(new CustomEvent(BRIDGE_REQUEST_EVENT, {
        detail: JSON.stringify({ action, requestId, target: targetMark, endTarget: endMark, nodeName }),
      }));
    });
  } finally {
    // 표식을 남기면 다음 요청이 옛 노드를 찾는다. 성공·실패 어느 쪽이든 지운다.
    node.removeAttribute(BRIDGE_TARGET_ATTRIBUTE);
    endNode?.removeAttribute(BRIDGE_TARGET_ATTRIBUTE);
  }
}

/** codeBlock 노드를 통째로 선택한다. 대상이 코드블럭 내부 요소여도 codeBlock까지 거슬러 올라간다. */
export async function selectEditorNode(editor: HTMLElement, node: HTMLElement): Promise<void> {
  await requestBridge(editor, 'select-node', node, undefined, 'codeBlock');
}

/** 연속한 문단 구간을 한 번에 선택한다. 첫 문단과 마지막 문단을 잡으면 그 사이가 모두 들어간다. */
export async function selectEditorRange(
  editor: HTMLElement,
  first: HTMLElement,
  last: HTMLElement,
): Promise<void> {
  await requestBridge(editor, 'select-range', first, last);
}

/**
 * ProseMirror 노드에서 원문 전체를 읽는다.
 *
 * DOM으로 읽으면 CodeMirror가 30줄 안팎까지만 렌더해 뒷부분이 잘린다.
 *
 * docs/issue/2026-09-04-mermaid-verification-reads-truncated-dom.md
 */
export async function readProseMirrorCodeBlockText(
  editor: HTMLElement,
  codeBlock: HTMLElement,
): Promise<string> {
  const response = await requestBridge(editor, 'read-node', codeBlock, undefined, 'codeBlock');
  if (typeof response.text !== 'string') {
    throw new Error('codeBlock 전체 원문을 읽지 못했습니다.');
  }
  return response.text.replace(/\r\n?/g, '\n');
}
