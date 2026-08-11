export interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: AdfMark[];
  [key: string]: unknown;
}

export interface AdfDocument {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}

export interface MarkdownToAdfResult {
  doc: AdfDocument;
  warnings: string[];
  mermaidCount: number;
}

export interface AdfToMarkdownResult {
  markdown: string;
  warnings: string[];
}
