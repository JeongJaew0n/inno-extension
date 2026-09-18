/**
 * Confluence 편집기의 `Markdown 변환` 버튼.
 *
 * 공통 동작은 `platform/editor/markdown-to-adf-runtime.ts`에 있다. 여기서는 Confluence만의 것을
 * 채운다 — 편집 화면 판정, 편집기 위치, 그리고 **Mermaid 단계**다.
 */

import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { createEditorMarkdownToAdfRuntime } from '../../../../platform/editor/markdown-to-adf-runtime';
import { EDITOR_PRIMARY_TOOLBAR } from '../../../../platform/editor/selectors';
import { parseConfluenceEditPageUrl } from '../../routes';
import { EDITOR_MARKDOWN_TO_ADF_ROOT, EDITOR_WRAPPER } from '../../selectors';
import {
  countUnpairedMermaidExtensions,
  hasValidMermaidPair,
  runMermaidPhase,
} from './mermaid-phase';

export function createEditorMarkdownToAdfRuntimeForConfluence(): FeatureRuntime {
  return createEditorMarkdownToAdfRuntime({
    featureId: 'pageMarkdownAppend',
    rootAttributeValue: EDITOR_MARKDOWN_TO_ADF_ROOT,
    siteName: 'Confluence',

    resolveTarget(context: PageContext) {
      const route = parseConfluenceEditPageUrl(context.url);
      if (!route) return null;

      const toolbar = context.document.querySelector<HTMLElement>(EDITOR_PRIMARY_TOOLBAR);
      const container = context.document.querySelector<HTMLElement>(EDITOR_WRAPPER);
      if (!toolbar || !container) return null;

      return { toolbar, container, key: route.pageId };
    },

    isProtectedCodeBlock: hasValidMermaidPair,

    precheck(editor) {
      const unpaired = countUnpairedMermaidExtensions(editor);
      if (unpaired > 0) {
        throw new Error(`문서 다른 위치에 Mermaid 컴포넌트 ${unpaired}개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.`);
      }
    },

    extraPhaseNotice: 'Mermaid 다이어그램이 오류로 보이면 편집기를 새로고침하세요. 문서는 그대로 두고 새로고침하면 정상으로 그려집니다.',
    extraPhase: { name: 'Mermaid', run: runMermaidPhase },
  });
}
