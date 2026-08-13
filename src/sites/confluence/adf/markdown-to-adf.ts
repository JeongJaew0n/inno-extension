import { marked, type Token, type Tokens } from 'marked';
import type { AdfMark, AdfNode, MarkdownToAdfResult } from './types';

type ExpandOpenTag = { title: string };

export function markdownToConfluenceAdf(markdown: string): MarkdownToAdfResult {
  return new Converter().convert(markdown);
}

class Converter {
  readonly warnings: string[] = [];
  private taskIdCounter = 1;
  private mermaidCount = 0;

  convert(markdown: string): MarkdownToAdfResult {
    const tokens = marked.lexer(markdown);
    return {
      doc: {
        type: 'doc',
        version: 1,
        content: this.renderBlocks(tokens),
      },
      warnings: this.warnings,
      mermaidCount: this.mermaidCount,
    };
  }

  private renderBlocks(tokens: Token[]): AdfNode[] {
    const result: AdfNode[] = [];
    let index = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      const open = token.type === 'html' ? matchExpandOpenTag(htmlTokenText(token as Tokens.HTML)) : null;
      if (open) {
        const closeIndex = tokens.findIndex(
          (candidate, candidateIndex) =>
            candidateIndex > index
            && candidate.type === 'html'
            && isExpandCloseTag(htmlTokenText(candidate as Tokens.HTML)),
        );
        if (closeIndex !== -1) {
          result.push({
            type: 'expand',
            attrs: { title: open.title },
            content: this.renderBlocks(tokens.slice(index + 1, closeIndex)),
          });
          index = closeIndex + 1;
          continue;
        }
      }

      result.push(...this.renderBlock(token));
      index += 1;
    }

    return result;
  }

  private renderBlock(token: Token): AdfNode[] {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading;
        return [{
          type: 'heading',
          attrs: { level: Math.min(Math.max(heading.depth, 1), 6) },
          content: this.renderInline(heading.tokens),
        }];
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph;
        if (paragraph.tokens.length === 1 && paragraph.tokens[0].type === 'image') {
          return [this.renderStandaloneImage(paragraph.tokens[0] as Tokens.Image)];
        }
        return [{ type: 'paragraph', content: this.renderInline(paragraph.tokens) }];
      }
      case 'blockquote':
        return [{ type: 'blockquote', content: this.renderBlocks((token as Tokens.Blockquote).tokens) }];
      case 'code': {
        const code = token as Tokens.Code;
        const language = (code.lang ?? '').trim().toLowerCase();
        if (language === 'mermaid') return this.renderMermaidBlock(code.text);
        return [this.codeBlock(code.text, normalizeLanguage(code.lang))];
      }
      case 'list':
        return [this.renderList(token as Tokens.List)];
      case 'table':
        return [this.renderTable(token as Tokens.Table)];
      case 'hr':
        return [{ type: 'rule' }];
      case 'space':
        return [];
      case 'html':
        this.warnings.push('원본 HTML 블록은 그대로 옮길 수 없어 생략했습니다.');
        return [];
      default: {
        const raw = (token as Tokens.Generic).raw ?? '';
        return raw ? [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }] : [];
      }
    }
  }

  private codeBlock(text: string, language: string): AdfNode {
    return {
      type: 'codeBlock',
      attrs: { language },
      content: text ? [{ type: 'text', text }] : [],
    };
  }

  private renderMermaidBlock(text: string): AdfNode[] {
    this.mermaidCount += 1;
    return [{
      type: 'expand',
      attrs: { title: 'Mermaid 코드 보기' },
      content: [this.codeBlock(text, 'mermaid')],
    }];
  }

  private renderList(list: Tokens.List): AdfNode {
    const isTaskList = list.items.length > 0 && list.items.every((item) => item.task);
    if (isTaskList) {
      return {
        type: 'taskList',
        attrs: { localId: `task-list-${this.taskIdCounter}` },
        content: list.items.map((item) => ({
          type: 'taskItem',
          attrs: {
            localId: String(this.taskIdCounter++),
            state: item.checked ? 'DONE' : 'TODO',
          },
          content: this.renderInline(this.stripLeadingCheckbox(item.tokens)),
        })),
      };
    }

    return {
      type: list.ordered ? 'orderedList' : 'bulletList',
      ...(list.ordered ? { attrs: { order: Number(list.start) || 1 } } : {}),
      content: list.items.map((item) => ({
        type: 'listItem',
        content: this.renderListItemBody(item),
      })),
    };
  }

  private stripLeadingCheckbox(tokens: Token[]): Token[] {
    return tokens[0]?.type === 'checkbox' ? tokens.slice(1) : tokens;
  }

  private renderListItemBody(item: Tokens.ListItem): AdfNode[] {
    const tokens = this.stripLeadingCheckbox(item.tokens);
    const result: AdfNode[] = [];
    let pendingInline: Token[] = [];

    const flushInline = (): void => {
      if (pendingInline.length === 0) return;
      result.push({ type: 'paragraph', content: this.renderInline(pendingInline) });
      pendingInline = [];
    };

    for (const token of tokens) {
      if (token.type === 'text') {
        const textToken = token as Tokens.Text & { tokens?: Token[] };
        pendingInline.push(...(textToken.tokens ?? [token]));
        continue;
      }

      flushInline();
      result.push(...this.renderBlock(token));
    }

    flushInline();
    return result;
  }

  private renderTable(table: Tokens.Table): AdfNode {
    const cell = (type: 'tableHeader' | 'tableCell', tokens: Token[]): AdfNode => ({
      type,
      attrs: { colspan: 1, rowspan: 1 },
      content: [{ type: 'paragraph', content: this.renderInline(tokens) }],
    });

    return {
      type: 'table',
      attrs: { layout: 'default' },
      content: [
        {
          type: 'tableRow',
          content: table.header.map((column) => cell('tableHeader', column.tokens)),
        },
        ...table.rows.map((row) => ({
          type: 'tableRow',
          content: row.map((column) => cell('tableCell', column.tokens)),
        })),
      ],
    };
  }

  private renderInline(tokens: Token[] | undefined): AdfNode[] {
    if (!tokens) return [];
    return tokens.flatMap((token) => this.renderInlineToken(token));
  }

  private renderInlineToken(token: Token): AdfNode[] {
    switch (token.type) {
      case 'text': {
        const text = token as Tokens.Text & { tokens?: Token[] };
        if (text.tokens) return this.renderInline(text.tokens);
        return text.text ? [{ type: 'text', text: text.text }] : [];
      }
      case 'escape':
        return (token as Tokens.Escape).text ? [{ type: 'text', text: (token as Tokens.Escape).text }] : [];
      case 'strong':
        return this.withMark(this.renderInline((token as Tokens.Strong).tokens), { type: 'strong' });
      case 'em':
        return this.withMark(this.renderInline((token as Tokens.Em).tokens), { type: 'em' });
      case 'del':
        return this.withMark(this.renderInline((token as Tokens.Del).tokens), { type: 'strike' });
      case 'codespan':
        return [{ type: 'text', text: (token as Tokens.Codespan).text, marks: [{ type: 'code' }] }];
      case 'br':
        return [{ type: 'hardBreak' }];
      case 'link': {
        const link = token as Tokens.Link;
        return this.withMark(this.renderInline(link.tokens), { type: 'link', attrs: { href: link.href } });
      }
      case 'image': {
        const image = token as Tokens.Image;
        this.warnings.push(`문단 중간 이미지("${image.href}")는 지원하지 않아 링크 텍스트로 대체했습니다.`);
        const text = image.text || image.href;
        return text ? [{ type: 'text', text, marks: [{ type: 'link', attrs: { href: image.href } }] }] : [];
      }
      case 'html':
        if (/^<br\s*\/?>$/i.test(htmlTokenText(token as Tokens.HTML).trim())) {
          return [{ type: 'hardBreak' }];
        }
        this.warnings.push('인라인 HTML은 그대로 옮길 수 없어 생략했습니다.');
        return [];
      default: {
        const raw = (token as Tokens.Generic).raw ?? '';
        return raw ? [{ type: 'text', text: raw }] : [];
      }
    }
  }

  private withMark(nodes: AdfNode[], mark: AdfMark): AdfNode[] {
    return nodes.map((node) => (
      node.type === 'text'
        ? { ...node, marks: [...(node.marks ?? []), mark] }
        : node
    ));
  }

  private renderStandaloneImage(image: Tokens.Image): AdfNode {
    if (/^https?:\/\//i.test(image.href)) {
      return {
        type: 'mediaSingle',
        attrs: { layout: 'center' },
        content: [{
          type: 'media',
          attrs: {
            type: 'external',
            url: image.href,
            alt: image.text || image.href,
          },
        }],
      };
    }

    this.warnings.push(`이미지("${image.href}")는 media 변환 범위에서 제외되어 자리표시자 텍스트로 대체했습니다.`);
    return {
      type: 'paragraph',
      content: [{
        type: 'text',
        text: `[이미지 변환 제외: ${image.text || image.href}]`,
        marks: [{ type: 'em' }],
      }],
    };
  }
}

function normalizeLanguage(language?: string): string {
  if (!language) return 'none';
  const key = language.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return LANGUAGE_MAP[key] ?? (key || 'none');
}

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
};

function htmlTokenText(token: Tokens.HTML): string {
  return (token.text ?? token.raw ?? '').trim();
}

function matchExpandOpenTag(html: string): ExpandOpenTag | null {
  const match = html.match(/^<details>\s*<summary>([\s\S]*?)<\/summary>$/i);
  return match ? { title: match[1].trim() } : null;
}

function isExpandCloseTag(html: string): boolean {
  return /^<\/details>$/i.test(html);
}
