import { escapeEditorHtml } from './adf-to-editor-html';

export const CONFLUENCE_MERMAID_EXTENSION_KEY =
  '23392b90-4271-4239-98ca-a3e96c663cbb/63d4d207-ac2f-4273-865c-0240d37f044a/static/mermaid-diagram';

export const CONFLUENCE_MERMAID_EXTENSION_TYPE = 'com.atlassian.ecosystem';
export const CONFLUENCE_MERMAID_TITLE = 'Mermaid diagram';
export const CONFLUENCE_MERMAID_SOURCE_TITLE = 'Mermaid 원본';

const MERMAID_DECLARATION = /^(?:(?:graph|flowchart)\s+(?:tb|td|bt|rl|lr)\b|sequenceDiagram\b|classDiagram(?:-v2)?\b|stateDiagram(?:-v2)?\b|erDiagram\b|journey\b|gantt\b|pie\b|quadrantChart\b|requirementDiagram\b|gitGraph\b|C4(?:Context|Container|Component|Dynamic|Deployment)\b|mindmap\b|timeline\b|zenuml\b|sankey-beta\b|xychart-beta\b|block-beta\b|packet-beta\b|architecture-beta\b|kanban\b)/i;

export function isMermaidCodeBlockSource(source: string): boolean {
  const declaration = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('%%'));

  return declaration ? MERMAID_DECLARATION.test(declaration) : false;
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
    '<details>',
    `<summary>${CONFLUENCE_MERMAID_SOURCE_TITLE}</summary>`,
    `<pre><code>${escapeEditorHtml(source.replace(/\r\n?/g, '\n'))}</code></pre>`,
    '</details>',
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
