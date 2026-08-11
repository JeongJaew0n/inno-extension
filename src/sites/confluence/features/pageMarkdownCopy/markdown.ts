import { MARKDOWN_IGNORED_ELEMENTS } from '../../selectors';

interface RenderContext {
  preserveWhitespace: boolean;
}

const DEFAULT_CONTEXT: RenderContext = { preserveWhitespace: false };

export function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]])/g, '\\$1');
}

function normalizeText(value: string, preserveWhitespace: boolean): string {
  if (preserveWhitespace) return value;
  return escapeMarkdownText(value.replace(/\s+/g, ' '));
}

function renderChildren(element: Element, context: RenderContext = DEFAULT_CONTEXT): string {
  return Array.from(element.childNodes)
    .map((node) => renderNode(node, context))
    .join('');
}

function wrapInline(marker: string, content: string): string {
  const normalized = content.trim();
  return normalized ? `${marker}${normalized}${marker}` : '';
}

function longestBacktickRun(value: string): number {
  return Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
}

function renderInlineCode(value: string): string {
  const fence = '`'.repeat(Math.max(1, longestBacktickRun(value) + 1));
  const padding = value.startsWith('`') || value.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${value}${padding}${fence}`;
}

function readCodeLanguage(element: Element): string {
  const languageElement = element.matches('[data-code-lang], [data-language]')
    ? element
    : element.querySelector('[data-code-lang], [data-language]');
  const dataLanguage = languageElement?.getAttribute('data-code-lang')
    ?? languageElement?.getAttribute('data-language');
  if (dataLanguage) return dataLanguage.replace(/[^a-zA-Z0-9_+-]/g, '');

  const codeElement = element.matches('code') ? element : element.querySelector('code');
  const classLanguage = codeElement?.className.match(/(?:^|\s)language-([^\s]+)/)?.[1];
  return classLanguage?.replace(/[^a-zA-Z0-9_+-]/g, '') ?? '';
}

function readCodeText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll(MARKDOWN_IGNORED_ELEMENTS).forEach((ignored) => ignored.remove());
  const code = clone.matches('pre, code') ? clone : clone.querySelector('pre, code');
  return (code?.textContent ?? clone.textContent ?? '').replace(/\r\n?/g, '\n').trimEnd();
}

function renderCodeBlock(element: Element): string {
  const code = readCodeText(element);
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(code) + 1));
  const language = readCodeLanguage(element);
  return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
}

function isNestedList(element: Element): boolean {
  return element.tagName === 'UL' || element.tagName === 'OL';
}

function normalizeListItem(value: string): string {
  return value
    .trim()
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n');
}

function renderList(list: Element, depth: number): string {
  const ordered = list.tagName === 'OL';
  const listItems = Array.from(list.children).filter((child) => child.tagName === 'LI');
  const lines: string[] = [];

  listItems.forEach((item, index) => {
    const contentNodes = Array.from(item.childNodes).filter(
      (node) => !(node.nodeType === 1 && isNestedList(node as Element)),
    );
    const content = normalizeListItem(
      contentNodes.map((node) => renderNode(node, DEFAULT_CONTEXT)).join(''),
    );
    const indent = '  '.repeat(depth);
    const marker = ordered ? `${index + 1}.` : '-';
    const contentLines = (content || '').split('\n');
    lines.push(`${indent}${marker} ${contentLines[0] ?? ''}`.trimEnd());
    for (const continuation of contentLines.slice(1)) {
      lines.push(`${indent}  ${continuation}`.trimEnd());
    }

    for (const child of Array.from(item.children).filter(isNestedList)) {
      lines.push(renderList(child, depth + 1));
    }
  });

  return lines.join('\n');
}

function normalizeTableCell(value: string): string {
  return value
    .trim()
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

function directTableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.querySelectorAll('tr')).filter(
    (row) => row.closest('table') === table,
  );
}

function normalizedTableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isRedundantHeaderOnlyTable(
  currentRows: readonly (readonly string[])[],
  nextRows: readonly (readonly string[])[],
): boolean {
  if (currentRows.length !== 1 || nextRows.length <= 1) return false;
  if (currentRows[0].length === 0 || currentRows[0].length !== nextRows[0].length) return false;

  return currentRows[0].every(
    (cell, index) => normalizedTableText(cell) === normalizedTableText(nextRows[0][index]),
  );
}

function tableTextRows(table: HTMLTableElement): string[][] {
  return directTableRows(table).map((row) => Array.from(row.children)
    .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
    .map((cell) => cell.textContent ?? ''));
}

function hasMeaningfulContentBetween(
  currentTable: HTMLTableElement,
  nextTable: HTMLTableElement,
): boolean {
  const document = currentTable.ownerDocument;
  const range = document.createRange();
  range.setStartAfter(currentTable);
  range.setEndBefore(nextTable);
  const between = range.cloneContents();
  between.querySelectorAll(MARKDOWN_IGNORED_ELEMENTS).forEach((element) => element.remove());
  return (between.textContent?.trim() ?? '') !== ''
    || between.querySelector('img, video, audio, pre, code, ul, ol, blockquote, hr') !== null;
}

function removeRedundantHeaderOnlyTables(body: HTMLElement): void {
  const tables = Array.from(body.querySelectorAll<HTMLTableElement>('table'));
  for (let index = 0; index < tables.length - 1; index += 1) {
    const currentTable = tables[index];
    const nextTable = tables[index + 1];
    const currentRows = directTableRows(currentTable);
    const headerCells = currentRows[0]
      ? Array.from(currentRows[0].children).filter(
        (cell) => cell.tagName === 'TH' || cell.tagName === 'TD',
      )
      : [];
    const isHeaderRow = headerCells.length > 0
      && headerCells.every((cell) => cell.tagName === 'TH');

    if (isHeaderRow
      && !hasMeaningfulContentBetween(currentTable, nextTable)
      && isRedundantHeaderOnlyTable(tableTextRows(currentTable), tableTextRows(nextTable))) {
      currentTable.remove();
    }
  }
}

function renderTable(table: HTMLTableElement): string {
  const rows = directTableRows(table);
  if (rows.length === 0) return '';

  const renderedRows = rows.map((row) => Array.from(row.children)
    .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
    .map((cell) => normalizeTableCell(renderChildren(cell))));
  const columnCount = Math.max(...renderedRows.map((row) => row.length));
  if (columnCount === 0) return '';

  const pad = (row: string[]): string[] => [
    ...row,
    ...Array.from({ length: columnCount - row.length }, () => ''),
  ];
  const markdownRows = [
    pad(renderedRows[0]),
    Array.from({ length: columnCount }, () => '---'),
    ...renderedRows.slice(1).map(pad),
  ];

  return `\n\n${markdownRows.map((row) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
}

function renderLink(element: HTMLAnchorElement): string {
  const label = renderChildren(element).trim();
  const href = element.href || element.getAttribute('href') || '';
  if (!href) return label;
  return label && label !== href ? `[${label}](${href})` : `<${href}>`;
}

function renderImage(element: HTMLImageElement): string {
  const src = element.src || element.getAttribute('src') || '';
  if (!src) return '';
  return `![${escapeMarkdownText(element.alt)}](${src})`;
}

function renderNode(node: Node, context: RenderContext): string {
  if (node.nodeType === 3) return normalizeText(node.textContent ?? '', context.preserveWhitespace);
  if (node.nodeType !== 1) return '';

  const element = node as Element;
  const tagName = element.tagName;
  if (element.matches(MARKDOWN_IGNORED_ELEMENTS)) return '';
  if (element.matches('[data-testid="renderer-code-block"]')) return renderCodeBlock(element);

  if (/^H[1-6]$/.test(tagName)) {
    const level = Number(tagName.slice(1));
    return `\n\n${'#'.repeat(level)} ${renderChildren(element).trim()}\n\n`;
  }

  switch (tagName) {
    case 'P':
      return `\n\n${renderChildren(element).trim()}\n\n`;
    case 'BR':
      return '\n';
    case 'HR':
      return '\n\n---\n\n';
    case 'STRONG':
    case 'B':
      return wrapInline('**', renderChildren(element));
    case 'EM':
    case 'I':
      return wrapInline('*', renderChildren(element));
    case 'S':
    case 'DEL':
      return wrapInline('~~', renderChildren(element));
    case 'CODE':
      return element.closest('pre') ? (element.textContent ?? '') : renderInlineCode(element.textContent ?? '');
    case 'PRE':
      return renderCodeBlock(element);
    case 'UL':
    case 'OL':
      return `\n\n${renderList(element, 0)}\n\n`;
    case 'LI':
      return renderChildren(element);
    case 'BLOCKQUOTE': {
      const content = renderChildren(element).trim();
      return `\n\n${content.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')}\n\n`;
    }
    case 'TABLE':
      return renderTable(element as HTMLTableElement);
    case 'A':
      return renderLink(element as HTMLAnchorElement);
    case 'IMG':
      return renderImage(element as HTMLImageElement);
    default:
      return renderChildren(element, context);
  }
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function convertConfluenceBodyToMarkdown(body: HTMLElement): string {
  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(MARKDOWN_IGNORED_ELEMENTS).forEach((element) => element.remove());
  removeRedundantHeaderOnlyTables(clone);
  return normalizeMarkdown(renderChildren(clone));
}
