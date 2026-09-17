/**
 * Atlassian ADF 편집기의 공용 선택자.
 *
 * Confluence와 Jira가 같은 편집기 패키지를 쓴다. 실측으로 확인했다 — Jira 업무 모달의 설명
 * 편집기도 `.ProseMirror#ak-editor-textarea`이고 노드에 같은 `data-prosemirror-*` 속성이 붙는다.
 *
 * docs/plans/jira-editor-markdown-to-adf/context.md
 */

export const EDITOR_PROSEMIRROR = '.ProseMirror[contenteditable="true"][role="textbox"]';
export const EDITOR_PRIMARY_TOOLBAR = '[data-testid="editor-primary-toolbar"]';
export const EDITOR_CODE_BLOCK = '[data-prosemirror-node-name="codeBlock"]';
export const EDITOR_PARAGRAPH = '[data-prosemirror-node-name="paragraph"]';
export const EDITOR_UNDO_BUTTON = '[data-testid="ak-editor-toolbar-button-undo"]';

/**
 * Markdown 으로 옮기지 않을 요소.
 *
 * 렌더러가 본문과 함께 그리는 조작용 UI(복사 버튼, 앵커, 줄 번호)다. 문서 내용이 아니다.
 */
export const MARKDOWN_IGNORED_ELEMENTS = [
  'button',
  'script',
  'style',
  'svg',
  'input',
  'select',
  'textarea',
  '[data-testid="anchor-button"]',
  '[data-testid*="copy-button"]',
  '[data-testid*="line-number"]',
  '.react-syntax-highlighter-line-number',
].join(',');
