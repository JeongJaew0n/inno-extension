/**
 * Jira 업무 **설명**과 **댓글** 편집기의 `Markdown 변환` 버튼.
 *
 * 공통 동작은 `platform/editor/markdown-to-adf-runtime.ts`에 있다. Confluence와 같은 Atlassian
 * ADF 편집기라 코드블럭 벗기기와 문단 Markdown 변환이 그대로 동작한다.
 *
 * **편집기마다 버튼이 하나씩 붙는다.** 설명과 새 댓글, 기존 댓글 편집이 한 화면에 동시에 열릴 수
 * 있다. 툴바와 본문은 **그 편집기의 컨테이너 안에서만** 찾는다 — 문서 전체에서 찾으면 다른
 * 편집기의 툴바나 본문을 잡는다.
 *
 * **Mermaid 단계는 붙이지 않는다.** Jira에는 Mermaid 앱이 설치돼 있지 않다. 편집기 삽입 메뉴에서
 * `mermaid`·`diagram` 어느 것도 검색되지 않는 것을 실측으로 확인했다. Mermaid 코드블럭은
 * 코드블럭으로 남는다.
 *
 * docs/plans/jira-editor-markdown-to-adf/spec.md
 * docs/plans/jira-comment-markdown-to-adf/spec.md
 */

import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import {
  createEditorMarkdownToAdfRuntime,
  type EditorTarget,
} from '../../../../platform/editor/markdown-to-adf-runtime';
import {
  EDITOR_PRIMARY_TOOLBAR,
  EDITOR_PROSEMIRROR,
} from '../../../../platform/editor/selectors';
import { parseJiraBoardUrl, parseJiraIssueUrl } from '../../routes';
import {
  COMMENT_COMPOSER,
  COMMENT_LIST,
  DESCRIPTION_EDITOR_CONTAINER,
  EDITOR_MARKDOWN_TO_ADF_ROOT,
  ISSUE_EDITOR,
} from '../../selectors';

/** 지금 보고 있는 업무 키. 업무가 바뀌면 버튼을 다시 만들어야 한다. */
function currentIssueKey(url: URL): string {
  return parseJiraIssueUrl(url.href)?.issueKey
    ?? parseJiraBoardUrl(url.href)?.selectedIssueKey
    ?? 'description';
}

/** 설명 편집기. 설명 편집기가 열려 있을 때만 대상이 된다. 읽기 모드에는 편집기가 없다. */
function resolveDescriptionTarget(document: Document, issueKey: string): EditorTarget | null {
  const container = document.querySelector<HTMLElement>(DESCRIPTION_EDITOR_CONTAINER);
  if (!container) return null;

  // **컨테이너 안에서** 찾는다. 문서 전체에서 찾으면 댓글 편집기의 툴바를 잡는다.
  const toolbar = container.querySelector<HTMLElement>(EDITOR_PRIMARY_TOOLBAR);
  const editor = container.querySelector<HTMLElement>(EDITOR_PROSEMIRROR);
  if (!toolbar || !editor) return null;

  return { toolbar, container, key: issueKey };
}

/**
 * 열린 댓글 편집기들. 새 댓글 칸과 기존 댓글 목록 안의 편집기를 모두 고른다.
 *
 * 컨테이너는 편집기에서 가장 가까운 `ISSUE_EDITOR` 다. 그 안에 편집기 하나와 그 툴바가 함께 있다.
 * 짝이 확실하지 않으면(컨테이너·툴바가 없거나 편집기가 여럿이면) 붙이지 않는다 — 엉뚱한 편집기를
 * 바꾸느니 버튼이 없는 편이 낫다.
 *
 * docs/plans/jira-comment-markdown-to-adf/context.md
 */
function resolveCommentTargets(document: Document, issueKey: string): EditorTarget[] {
  const targets: EditorTarget[] = [];

  for (const editor of document.querySelectorAll<HTMLElement>(EDITOR_PROSEMIRROR)) {
    if (!editor.closest(`${COMMENT_COMPOSER}, ${COMMENT_LIST}`)) continue;
    // 설명은 `resolveDescriptionTarget` 이 맡는다.
    if (editor.closest(DESCRIPTION_EDITOR_CONTAINER)) continue;

    const container = editor.closest<HTMLElement>(ISSUE_EDITOR);
    if (!container || container.querySelectorAll(EDITOR_PROSEMIRROR).length !== 1) continue;

    const toolbar = container.querySelector<HTMLElement>(EDITOR_PRIMARY_TOOLBAR);
    if (!toolbar) continue;

    targets.push({ toolbar, container, key: `${issueKey}:comment` });
  }

  return targets;
}

export function createEditorMarkdownToAdfRuntimeForJira(): FeatureRuntime {
  return createEditorMarkdownToAdfRuntime({
    featureId: 'editorMarkdownToAdf',
    rootAttributeValue: EDITOR_MARKDOWN_TO_ADF_ROOT,
    siteName: 'Jira',
    // 툴바 오른쪽이 넉넉히 비어 있다(설명 260px 남짓, 댓글 190px 남짓). 아이콘 줄에 붙이지 않고
    // 그 자리로 민다.
    toolbarAlign: 'end',

    resolveTargets(context: PageContext) {
      const issueKey = currentIssueKey(context.url);
      const description = resolveDescriptionTarget(context.document, issueKey);
      return [
        ...(description ? [description] : []),
        ...resolveCommentTargets(context.document, issueKey),
      ];
    },
  });
}
