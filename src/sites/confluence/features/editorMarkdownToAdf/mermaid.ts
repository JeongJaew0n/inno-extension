import { escapeEditorHtml } from '../../../../platform/editor/adf-to-editor-html';

export const CONFLUENCE_MERMAID_EXTENSION_KEY =
  '23392b90-4271-4239-98ca-a3e96c663cbb/63d4d207-ac2f-4273-865c-0240d37f044a/static/mermaid-diagram';

export const CONFLUENCE_MERMAID_EXTENSION_TYPE = 'com.atlassian.ecosystem';
export const CONFLUENCE_MERMAID_TITLE = 'Mermaid diagram';
export const CONFLUENCE_MERMAID_SOURCE_TITLE = 'Mermaid 원본';

const MERMAID_DECLARATION = /^(?:(?:graph|flowchart)\s+(?:tb|td|bt|rl|lr)\b|sequenceDiagram\b|classDiagram(?:-v2)?\b|stateDiagram(?:-v2)?\b|erDiagram\b|journey\b|gantt\b|pie\b|quadrantChart\b|requirementDiagram\b|gitGraph\b|C4(?:Context|Container|Component|Dynamic|Deployment)\b|mindmap\b|timeline\b|zenuml\b|sankey-beta\b|xychart-beta\b|block-beta\b|packet-beta\b|architecture-beta\b|kanban\b)/i;

/**
 * 위 목록에 없던 선언. Mermaid 11.16.1(사내 Confluence Mermaid 앱 실측 버전, 2026-11-10)의 `mermaid.parse()` 가
 * 받는 것만 넣었다. **대소문자를 구분한다** — Mermaid 가 구분한다(`Block`, `FLOWCHART LR` 은 오류).
 *
 * - 방향 없는 `flowchart` · `graph` 는 기본 방향(TB)으로 그려진다. 그 단어만 있는 줄일 때만 받는다.
 *   `graph data without direction` 같은 산문 줄은 Mermaid 도 거부한다.
 * - `radar` · `venn` 은 `-beta` 를 떼면 Mermaid 가 거부한다.
 */
const MERMAID_DECLARATION_EXACT = /^(?:(?:graph|flowchart)$|flowchart-elk\b|(?:block|packet|xychart|sankey|treemap|ishikawa)(?:-beta)?(?:\s|$)|(?:radar|venn)-beta(?:\s|$))/;

/**
 * 맨 앞의 YAML frontmatter(`---` 로 감싼 title · config). Mermaid 도 판정 전에 이것을 지운다
 * (`detectType` 의 `frontMatterRegex`). 앞의 빈 줄은 11.x 는 받고 12.x 는 거부하지만, 앱이 11.x
 * 라 받는 쪽을 택한다.
 */
const MERMAID_FRONTMATTER = /^\s*-{3}[ \t]*\n[\s\S]*?\n-{3}[ \t]*(?:\n|$)/;

export function isMermaidCodeBlockSource(source: string): boolean {
  const declaration = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(MERMAID_FRONTMATTER, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('%%'));

  return declaration
    ? MERMAID_DECLARATION.test(declaration) || MERMAID_DECLARATION_EXACT.test(declaration)
    : false;
}

export function buildConfluenceMermaidExtensionHtml(
  codeBlockIndex: number,
  localId: string,
): string {
  if (!Number.isInteger(codeBlockIndex) || codeBlockIndex < 0) {
    throw new Error('Mermaid가 참조할 코드블럭 순번이 올바르지 않습니다.');
  }

  const parameters = {
    layout: 'extension',
    guestParams: { index: codeBlockIndex },
    forgeEnvironment: 'PRODUCTION',
    localId,
    extensionId: `ari:cloud:ecosystem::extension/${CONFLUENCE_MERMAID_EXTENSION_KEY}`,
    extensionTitle: CONFLUENCE_MERMAID_TITLE,
  };

  return [
    '<div',
    ' data-node-type="extension"',
    ` data-extension-type="${CONFLUENCE_MERMAID_EXTENSION_TYPE}"`,
    ` data-extension-key="${CONFLUENCE_MERMAID_EXTENSION_KEY}"`,
    ` data-text="${CONFLUENCE_MERMAID_TITLE}"`,
    ` data-parameters="${escapeEditorHtml(JSON.stringify(parameters))}"`,
    ' data-layout="default"',
    ` data-local-id="${escapeEditorHtml(localId)}"`,
    '></div>',
  ].join('');
}

export function buildCollapsedMermaidSourceHtml(source: string): string {
  return [
    '<div data-node-type="expand"',
    ` data-title="${CONFLUENCE_MERMAID_SOURCE_TITLE}"`,
    ' data-expanded="false">',
    `<pre><code>${escapeEditorHtml(source.replace(/\r\n?/g, '\n'))}</code></pre>`,
    '</div>',
  ].join('');
}

export function buildConfluenceMermaidReplacementHtml(
  codeBlockIndex: number,
  localId: string,
  source: string,
): string {
  return [
    buildConfluenceMermaidExtensionHtml(codeBlockIndex, localId),
    buildCollapsedMermaidSourceHtml(source),
  ].join('');
}

const normalizeSource = (text: string): string => text.replace(/\r\n?/g, '\n').trim();

/**
 * 서버 초안이 따라잡았는지 — 각 후보의 순번 자리에 그 Mermaid 원문이 있는가.
 *
 * 매크로는 넣는 순간 이 순번으로 서버 초안을 읽는다. 하나라도 어긋나면 그 다이어그램은 다른 블록을
 * 읽거나 `not found` 가 된다.
 *
 * docs/plans/confluence-mermaid-wait-for-draft/spec.md
 */
export function draftHasMermaidSourcesAt(
  draftCodeBlocks: readonly string[],
  candidates: ReadonlyArray<{ index: number; source: string }>,
): boolean {
  return candidates.every(({ index, source }) => (
    typeof draftCodeBlocks[index] === 'string'
    && normalizeSource(draftCodeBlocks[index]) === normalizeSource(source)
  ));
}
