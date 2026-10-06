import { markdownToAdf, type AdfDocument } from '../adf';
import { adfDocumentToEditorHtml } from './adf-to-editor-html';

export interface CodeBlockAdfPayload {
  /** 붙여넣기로 넣을 때 쓴다 */
  html: string;
  /** 트랜잭션으로 넣을 때 쓴다. `html` 과 같은 내용이다 */
  adf: AdfDocument;
  markdown: string;
  warnings: string[];
}

export function codeBlockMarkdownToAdfPayload(markdown: string): CodeBlockAdfPayload {
  const conversion = markdownToAdf(markdown);
  if (conversion.doc.content.length === 0) {
    throw new Error('변환 가능한 Markdown 내용이 없는 코드블럭이 있습니다.');
  }

  const html = adfDocumentToEditorHtml(conversion.doc);
  if (!html) throw new Error('ADF로 작성할 수 없는 코드블럭이 있습니다.');

  return {
    html,
    adf: conversion.doc,
    markdown,
    warnings: conversion.warnings,
  };
}
