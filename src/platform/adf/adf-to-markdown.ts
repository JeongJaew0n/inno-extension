/**
 * ADF 문서를 Markdown 으로 옮긴다.
 *
 * 편집 중에는 읽기용 렌더러(`.ak-renderer-document`)가 없다. 편집기 DOM 을 긁으면 코드블럭이
 * CodeMirror 라 깨지고, **30줄 안팎까지만 렌더돼 긴 블록은 내용이 사라진다.** 그래서 ProseMirror
 * 에서 문서를 그대로 꺼내 여기서 옮긴다. 추측도 잘림도 없다.
 *
 * Markdown 에 대응물이 없는 노드는 **텍스트로 떨어뜨린다.** 주석이나 표식으로 남기지 않는다 —
 * 복사의 목적이 다른 곳에 옮겨 쓰기인데 표식은 거기서 쓰레기가 된다.
 *
 * docs/plans/adf-to-markdown/spec.md
 */

import {
  escapeMarkdownText,
  normalizeListItem,
  normalizeMarkdown,
  normalizeTableCell,
  renderFencedCode,
  renderInlineCode,
  renderMarkdownTable,
} from '../markdown/format';
import type { AdfDocument, AdfMark, AdfNode } from './types';

const INLINE_MARK_WRAPPERS: Record<string, string> = {
  strong: '**',
  em: '*',
  strike: '~~',
};

function markOf(node: AdfNode, type: string): AdfMark | undefined {
  return node.marks?.find((mark) => mark.type === type);
}

function attr(node: AdfNode, key: string): unknown {
  return (node.attrs as Record<string, unknown> | undefined)?.[key];
}

function stringAttr(node: AdfNode, key: string): string {
  const value = attr(node, key);
  return typeof value === 'string' ? value : '';
}

/** 노드 안의 글자만 건진다. 모르는 노드를 버릴 때 쓴다. */
function plainText(nodes: readonly AdfNode[] | undefined): string {
  return (nodes ?? []).map((node) => (
    node.type === 'text' ? node.text ?? '' : plainText(node.content)
  )).join('');
}

function renderText(node: AdfNode): string {
  const raw = node.text ?? '';
  if (!raw) return '';

  // 코드 마크가 있으면 다른 마크를 적용하지 않는다. 코드 안의 `*` 는 강조가 아니다.
  if (markOf(node, 'code')) return renderInlineCode(raw);

  let out = escapeMarkdownText(raw);
  for (const [type, wrapper] of Object.entries(INLINE_MARK_WRAPPERS)) {
    if (!markOf(node, type)) continue;
    // 양끝 공백은 감싸기 밖으로 뺀다. `** 굵게 **` 는 Markdown 이 강조로 읽지 않는다.
    const leading = out.match(/^\s*/)?.[0] ?? '';
    const trailing = out.match(/\s*$/)?.[0] ?? '';
    const core = out.slice(leading.length, out.length - trailing.length);
    if (core) out = `${leading}${wrapper}${core}${wrapper}${trailing}`;
  }

  const link = markOf(node, 'link');
  const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : '';
  if (href) return out.trim() && out.trim() !== href ? `[${out.trim()}](${href})` : `<${href}>`;
  return out;
}

function renderInline(nodes: readonly AdfNode[] | undefined): string {
  return (nodes ?? []).map((node) => {
    switch (node.type) {
      case 'text': return renderText(node);
      case 'hardBreak': return '\n';
      // 아래는 Markdown 에 대응물이 없다. 보이는 글자만 남긴다.
      case 'emoji': return stringAttr(node, 'text') || stringAttr(node, 'shortName');
      case 'mention': return stringAttr(node, 'text');
      case 'status': return stringAttr(node, 'text');
      case 'date': return formatAdfDate(stringAttr(node, 'timestamp'));
      case 'inlineCard':
      case 'blockCard': {
        const url = stringAttr(node, 'url');
        return url ? `<${url}>` : '';
      }
      case 'inlineExtension': return '';
      default: return escapeMarkdownText(plainText(node.content));
    }
  }).join('');
}

/** ADF 의 `date` 는 epoch 밀리초 문자열이다. */
function formatAdfDate(timestamp: string): string {
  const ms = Number(timestamp);
  if (!Number.isFinite(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function renderList(node: AdfNode, depth: number, warnings: Set<string>): string {
  const ordered = node.type === 'orderedList';
  const lines: string[] = [];

  (node.content ?? []).forEach((item, index) => {
    if (item.type !== 'listItem' && item.type !== 'taskItem') return;

    const nested = (item.content ?? []).filter(
      (child) => child.type === 'bulletList' || child.type === 'orderedList',
    );
    const own = (item.content ?? []).filter(
      (child) => child.type !== 'bulletList' && child.type !== 'orderedList',
    );

    const indent = '  '.repeat(depth);
    const marker = item.type === 'taskItem'
      ? (stringAttr(item, 'state') === 'DONE' ? '- [x]' : '- [ ]')
      : (ordered ? `${index + 1}.` : '-');
    // `listItem` 안은 블록(문단 등)이고 `taskItem` 안은 인라인이다. 같은 함수로 다루면 글자가 사라진다.
    const content = normalizeListItem(
      item.type === 'taskItem' ? renderInline(own) : renderBlocks(own, depth, warnings),
    );
    const contentLines = content.split('\n');

    lines.push(`${indent}${marker} ${contentLines[0] ?? ''}`.trimEnd());
    for (const continuation of contentLines.slice(1)) {
      lines.push(`${indent}  ${continuation}`.trimEnd());
    }
    for (const child of nested) lines.push(renderList(child, depth + 1, warnings));
  });

  return `\n\n${lines.join('\n')}\n\n`;
}

function renderTaskList(node: AdfNode, depth: number, warnings: Set<string>): string {
  return renderList({ ...node, type: 'bulletList' }, depth, warnings);
}

function renderTable(node: AdfNode, warnings: Set<string>): string {
  const rows = (node.content ?? []).filter((row) => row.type === 'tableRow');
  const rendered = rows.map((row) => (row.content ?? [])
    .filter((cell) => cell.type === 'tableHeader' || cell.type === 'tableCell')
    .map((cell) => normalizeTableCell(renderBlocks(cell.content, 0, warnings))));
  return renderMarkdownTable(rendered);
}

function renderMedia(node: AdfNode): string {
  if (stringAttr(node, 'type') === 'external') {
    const url = stringAttr(node, 'url');
    return url ? `![](${url})` : '';
  }
  // 첨부 파일은 이 문서 밖에서 가리킬 수단이 없다. 쓸 수 없는 참조를 넣지 않는다.
  return '(이미지 첨부)';
}

function renderBlock(node: AdfNode, depth: number, warnings: Set<string>): string {
  switch (node.type) {
    case 'paragraph': {
      const text = renderInline(node.content);
      return text.trim() ? `\n\n${text}\n\n` : '\n\n';
    }
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(attr(node, 'level')) || 1));
      const text = renderInline(node.content).trim();
      return text ? `\n\n${'#'.repeat(level)} ${text}\n\n` : '';
    }
    case 'codeBlock':
      return renderFencedCode(plainText(node.content), stringAttr(node, 'language'));
    case 'rule':
      return '\n\n---\n\n';
    case 'hardBreak':
      return '\n';
    case 'blockquote': {
      const inner = normalizeMarkdown(renderBlocks(node.content, depth, warnings));
      if (!inner) return '';
      return `\n\n${inner.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')}\n\n`;
    }
    case 'bulletList':
    case 'orderedList':
      return renderList(node, depth, warnings);
    case 'taskList':
      return renderTaskList(node, depth, warnings);
    case 'table':
      return renderTable(node, warnings);
    case 'mediaSingle':
    case 'mediaGroup':
      return `\n\n${(node.content ?? []).map(renderMedia).join(' ')}\n\n`;
    case 'media':
      return renderMedia(node);

    // 껍데기를 벗기고 내용만 남긴다.
    case 'expand':
    case 'nestedExpand': {
      const title = stringAttr(node, 'title').trim();
      const inner = renderBlocks(node.content, depth, warnings);
      return title ? `\n\n**${escapeMarkdownText(title)}**\n${inner}` : inner;
    }
    case 'panel':
    case 'layoutSection':
    case 'layoutColumn':
      return renderBlocks(node.content, depth, warnings);

    /**
     * 매크로는 버린다.
     *
     * Mermaid 매크로가 대표적인데, **원본 코드블럭이 바로 옆에 남아 있다.** 매크로까지 옮기면
     * 같은 내용이 두 번 나오고 붙여넣는 쪽에서는 그릴 수도 없다.
     */
    case 'extension':
    case 'bodiedExtension':
    case 'multiBodiedExtension':
      warnings.add('매크로는 옮기지 않았습니다. 원본 코드블럭만 복사됩니다.');
      return '';

    // 블록 자리에 인라인 노드가 오는 ADF 가 있다. 글자를 잃지 않게 인라인으로 처리한다.
    case 'text':
    case 'emoji':
    case 'mention':
    case 'status':
    case 'date':
    case 'inlineCard':
      return renderInline([node]);

    default: {
      const text = plainText(node.content);
      if (text.trim()) {
        warnings.add(`Markdown으로 옮길 수 없는 ${node.type} 은 글자만 남겼습니다.`);
        return `\n\n${escapeMarkdownText(text)}\n\n`;
      }
      return '';
    }
  }
}

function renderBlocks(
  nodes: readonly AdfNode[] | undefined,
  depth: number,
  warnings: Set<string>,
): string {
  return (nodes ?? []).map((node) => renderBlock(node, depth, warnings)).join('');
}

export interface AdfToMarkdownResult {
  markdown: string;
  warnings: string[];
}

export function adfToMarkdown(doc: AdfDocument): AdfToMarkdownResult {
  const warnings = new Set<string>();
  const markdown = normalizeMarkdown(renderBlocks(doc.content, 0, warnings));
  return { markdown, warnings: [...warnings] };
}
