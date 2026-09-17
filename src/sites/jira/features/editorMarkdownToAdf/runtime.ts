/**
 * Jira 업무 **설명** 편집기의 `Markdown 변환` 버튼.
 *
 * 공통 동작은 `platform/editor/markdown-to-adf-runtime.ts`에 있다. Confluence와 같은 Atlassian
 * ADF 편집기라 코드블럭 벗기기와 문단 Markdown 변환이 그대로 동작한다.
 *
 * **Mermaid 단계는 붙이지 않는다.** Jira에는 Mermaid 앱이 설치돼 있지 않다. 편집기 삽입 메뉴에서
 * `mermaid`·`diagram` 어느 것도 검색되지 않는 것을 실측으로 확인했다. Mermaid 코드블럭은
 * 코드블럭으로 남는다.
 *
 * docs/plans/jira-editor-markdown-to-adf/spec.md
 */

import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { createEditorMarkdownToAdfRuntime } from '../../../../platform/editor/markdown-to-adf-runtime';
import {
  EDITOR_PRIMARY_TOOLBAR,
  EDITOR_PROSEMIRROR,
} from '../../../../platform/editor/selectors';
import { parseJiraBoardUrl, parseJiraIssueUrl } from '../../routes';
import { DESCRIPTION_EDITOR_CONTAINER, EDITOR_MARKDOWN_TO_ADF_ROOT } from '../../selectors';

/** 지금 보고 있는 업무 키. 업무가 바뀌면 버튼을 다시 만들어야 한다. */
function currentIssueKey(url: URL): string {
  return parseJiraIssueUrl(url.href)?.issueKey
    ?? parseJiraBoardUrl(url.href)?.selectedIssueKey
    ?? 'description';
}

export function createEditorMarkdownToAdfRuntimeForJira(): FeatureRuntime {
  return createEditorMarkdownToAdfRuntime({
    featureId: 'editorMarkdownToAdf',
    rootAttributeValue: EDITOR_MARKDOWN_TO_ADF_ROOT,
    siteName: 'Jira',
    // 툴바 오른쪽이 260px 넘게 비어 있다. 아이콘 줄에 붙이지 않고 그 자리로 민다.
    toolbarAlign: 'end',

    resolveTarget(context: PageContext) {
      // 설명 편집기가 열려 있을 때만 대상이 된다. 읽기 모드에는 편집기가 없다.
      const container = context.document.querySelector<HTMLElement>(DESCRIPTION_EDITOR_CONTAINER);
      if (!container) return null;

      // **컨테이너 안에서** 찾는다. 문서 전체에서 찾으면 댓글 편집기의 툴바를 잡는다.
      const toolbar = container.querySelector<HTMLElement>(EDITOR_PRIMARY_TOOLBAR);
      const editor = container.querySelector<HTMLElement>(EDITOR_PROSEMIRROR);
      if (!toolbar || !editor) return null;

      return { toolbar, container, key: currentIssueKey(context.url) };
    },
  });
}
