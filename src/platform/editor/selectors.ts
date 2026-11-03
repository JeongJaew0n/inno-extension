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
  // 스마트 링크 앞의 사이트 아이콘(favicon). 남기면 링크 글자 안에 `![](…/favicon.ico)` 가 섞인다
  // (실측 2026-10-16, NPT-669 댓글)
  '[data-testid="inline-card-icon-and-title-image"]',
  // 스마트 링크를 감싼 `smart-link-draggable-inline` 안에 화면에 안 보이는 `미리 보기` 글자가 있다
  // (`aria-hidden`, `visibility: hidden`). 남기면 `[제목](주소)미리 보기` 가 된다(실측 2026-11-03, NPT-669 설명)
  '[data-testid="smart-link-draggable-inline"] [aria-hidden="true"]',
].join(',');

/**
 * 렌더러의 사용자 멘션(`@이름`). 프로필 카드를 여는 `<button>` 안에 그려진다(실측 2026-10-16,
 * NPT-669 댓글). 버튼은 위에서 지우므로 그 전에 글자로 바꿔야 한다.
 */
export const RENDERER_MENTION = '[data-mention-id]';
