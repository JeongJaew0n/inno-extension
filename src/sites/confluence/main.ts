/**
 * Confluence MAIN world 진입점.
 *
 * ProseMirror 브리지를 심는 것 하나만 한다. 구현은 `platform/editor/main-world-bridge.ts`에 있고
 * Jira와 공유한다.
 */
import { installProseMirrorBridge } from '../../platform/editor/main-world-bridge';

installProseMirrorBridge();
