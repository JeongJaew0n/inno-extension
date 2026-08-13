import { markdownToConfluenceAdf } from '../../adf';
import { adfDocumentToEditorHtml } from './adf-to-editor-html';

export interface CodeBlockAdfPayload {
  html: string;
  markdown: string;
  warnings: string[];
}

export function codeBlockMarkdownToAdfPayload(markdown: string): CodeBlockAdfPayload {
  const conversion = markdownToConfluenceAdf(markdown);
  if (conversion.doc.content.length === 0) {
    throw new Error('변환 가능한 Markdown 내용이 없는 코드블럭이 있습니다.');
  }

  const html = adfDocumentToEditorHtml(conversion.doc);
  if (!html) throw new Error('ADF로 작성할 수 없는 코드블럭이 있습니다.');

  return {
    html,
    markdown,
    warnings: conversion.warnings,
  };
}
