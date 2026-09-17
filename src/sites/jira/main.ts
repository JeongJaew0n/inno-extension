/**
 * Jira MAIN world 진입점.
 *
 * ProseMirror 브리지를 심는 것 하나만 한다. Confluence와 같은 구현을 쓴다.
 */
import { installProseMirrorBridge } from '../../platform/editor/main-world-bridge';

installProseMirrorBridge();
