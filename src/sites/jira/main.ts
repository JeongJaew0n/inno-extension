/**
 * Jira MAIN world 진입점.
 *
 * content script(ISOLATED)가 닿을 수 없는 페이지 내부 객체를 다루는 브리지 둘을 심는다.
 *
 * | 브리지 | 무엇을 위해 |
 * | --- | --- |
 * | ProseMirror | 편집기 상태 조작. Confluence와 같은 구현 |
 * | 스프린트 상태 | `window.SPA_STATE` 의 활성 스프린트 읽기 |
 *
 * **둘 다 네트워크 요청을 하지 않는다.** 페이지가 이미 들고 있는 것만 읽는다.
 */
import { installProseMirrorBridge } from '../../platform/editor/main-world-bridge';
import { installSprintStateBridge } from './sprintState/mainBridge';

installProseMirrorBridge();
installSprintStateBridge();
