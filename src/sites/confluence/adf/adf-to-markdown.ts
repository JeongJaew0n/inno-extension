import type { AdfMark, AdfNode, AdfToMarkdownResult, AdfDocument } from './types';

export function confluenceAdfToMarkdown(doc: AdfDocument | { content?: AdfNode[] } | null | undefined): AdfToMarkdownResult {
  const warnings: string[] = [];
  const content = Array.isArray(doc?.content) ? doc.content : [];
  const markdown = `${blocksToMarkdown(content, warnings)}\n`.replace(/\n{3,}/g, '\n\n');
  return { markdown, warnings };
}

function blocksToMarkdown(nodes: AdfNode[], warnings: string[]): string {
  return nodes
    .map((node) => blockToMarkdown(node, warnings))
    .filter((value): value is string => value !== null && value.length > 0)
    .join('\n\n');
}

function blockToMarkdown(node: AdfNode, warnings: string[]): string | null {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
      const text = inlineToMarkdown(node.content, warnings).trim();
      return text ? `${'#'.repeat(level)} ${text}` : null;
    }
    case 'paragraph': {
      const text = inlineToMarkdown(node.content, warnings).trim();
      return text || null;
    }
    case 'rule':
      return '---';
    case 'blockquote': {
      const inner = blocksToMarkdown(node.content ?? [], warnings);
      return inner
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    }
    case 'bulletList':
      return listToMarkdown(node.content ?? [], false, 0, warnings);
    case 'orderedList':
      return listToMarkdown(node.content ?? [], true, 0, warnings);
    case 'taskList':
      return taskListToMarkdown(node.content ?? [], warnings);
    case 'table':
      return tableToMarkdown(node.content ?? [], warnings);
    case 'codeBlock': {
      const language = String(node.attrs?.language ?? '');
      const text = (node.content ?? []).map((child) => child.text ?? '').join('');
      return `\`\`\`${language === 'none' ? '' : language}\n${text}\n\`\`\``;
    }
    case 'expand': {
      const title = String(node.attrs?.title ?? '상세');
      const codeBlock = (node.content ?? []).find(
        (child) => child.type === 'codeBlock' && child.attrs?.language === 'mermaid',
      );
      if (title === 'Mermaid 코드 보기' && codeBlock) {
        const text = (codeBlock.content ?? []).map((child) => child.text ?? '').join('');
        return `\`\`\`mermaid\n${text}\n\`\`\``;
      }

      const inner = blocksToMarkdown(node.content ?? [], warnings);
      return `<details>\n<summary>${title}</summary>\n\n${inner}\n\n</details>`;
    }
    case 'mediaSingle': {
      const media = (node.content ?? []).find((child) => child.type === 'media');
      if (media?.attrs?.type === 'external' && typeof media.attrs.url === 'string') {
        const alt = typeof media.attrs.alt === 'string' ? media.attrs.alt : '';
        return `![${escapeMarkdownText(alt)}](${media.attrs.url})`;
      }
      warnings.push('업로드된 ADF media는 파일을 포함할 수 없어 Markdown에서 생략했습니다.');
      return null;
    }
    case 'mediaGroup':
    case 'media':
      warnings.push('ADF media 노드는 Markdown으로 안전하게 변환할 수 없어 생략했습니다.');
      return null;
    case 'extension':
      warnings.push('ADF extension 노드는 Markdown으로 안전하게 변환할 수 없어 생략했습니다.');
      return null;
    default:
      warnings.push(`지원하지 않는 ADF node(${node.type})는 내부 텍스트만 보존했습니다.`);
      return node.content ? blocksToMarkdown(node.content, warnings) || null : null;
  }
}

function listToMarkdown(
  items: AdfNode[],
  ordered: boolean,
  depth: number,
  warnings: string[],
): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  let index = 1;

  for (const item of items) {
    if (item.type !== 'listItem') continue;

    const marker = ordered ? `${index}.` : '-';
    index += 1;
    const blocks = item.content ?? [];
    const nestedLists = blocks.filter((block) => block.type === 'bulletList' || block.type === 'orderedList');
    const directBlocks = blocks.filter((block) => block.type !== 'bulletList' && block.type !== 'orderedList');
    const text = blocksToMarkdown(directBlocks, warnings).trim().replace(/\n{2,}/g, '\n');
    lines.push(`${indent}${marker} ${text}`.trimEnd());

    for (const nested of nestedLists) {
      lines.push(listToMarkdown(nested.content ?? [], nested.type === 'orderedList', depth + 1, warnings));
    }
  }

  return lines.join('\n');
}

function taskListToMarkdown(items: AdfNode[], warnings: string[]): string {
  return items
    .filter((item) => item.type === 'taskItem')
    .map((item) => `- [${item.attrs?.state === 'DONE' ? 'x' : ' '}] ${inlineToMarkdown(item.content, warnings).trim()}`)
    .join('\n');
}

function tableToMarkdown(rows: AdfNode[], warnings: string[]): string {
  const tableRows = rows.filter((row) => row.type === 'tableRow');
  if (tableRows.length === 0) return '';

  const cellsOf = (row: AdfNode) =>
    (row.content ?? []).filter((cell) => cell.type === 'tableHeader' || cell.type === 'tableCell');
  const cellText = (cell: AdfNode) =>
    inlineToMarkdown(cell.content, warnings).trim().replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ');

  const headerCells = cellsOf(tableRows[0]);
  if (headerCells.length === 0) return '';

  const header = `| ${headerCells.map(cellText).join(' | ')} |`;
  const divider = `| ${headerCells.map(() => '---').join(' | ')} |`;
  const body = tableRows.slice(1).map((row) => `| ${cellsOf(row).map(cellText).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function inlineToMarkdown(nodes: AdfNode[] | undefined, warnings: string[]): string {
  if (!nodes) return '';
  return nodes.map((node) => inlineNodeToMarkdown(node, warnings)).join('');
}

function inlineNodeToMarkdown(node: AdfNode, warnings: string[]): string {
  if (node.type === 'hardBreak') return '\n';
  if (node.type !== 'text') {
    if (node.type === 'paragraph') {
      return node.content ? inlineToMarkdown(node.content, warnings) : '';
    }
    if (node.type === 'media') {
      warnings.push('문단 안 media 노드는 Markdown으로 안전하게 변환할 수 없어 생략했습니다.');
      return '';
    }
    warnings.push(`지원하지 않는 ADF inline node(${node.type})는 내부 텍스트만 보존했습니다.`);
    return node.content ? inlineToMarkdown(node.content, warnings) : '';
  }

  const codeMark = node.marks?.find((mark) => mark.type === 'code');
  if (codeMark) return renderCodeSpan(node.text ?? '');

  let text = escapeMarkdownText(node.text ?? '');
  for (const mark of node.marks ?? []) {
    text = applyMarkdownMark(text, mark, warnings);
  }
  return text;
}

function applyMarkdownMark(text: string, mark: AdfMark, warnings: string[]): string {
  switch (mark.type) {
    case 'strong':
      return text ? `**${text}**` : text;
    case 'em':
      return text ? `*${text}*` : text;
    case 'strike':
      return text ? `~~${text}~~` : text;
    case 'link': {
      const href = String(mark.attrs?.href ?? '');
      return href ? `[${text || href}](${href})` : text;
    }
    default:
      warnings.push(`지원하지 않는 ADF mark(${mark.type})는 일반 텍스트로 내보냈습니다.`);
      return text;
  }
}

function renderCodeSpan(value: string): string {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = '`'.repeat(Math.max(1, longest + 1));
  const padding = value.startsWith('`') || value.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${value}${padding}${fence}`;
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]])/g, '\\$1');
}
