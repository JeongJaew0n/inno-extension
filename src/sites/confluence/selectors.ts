export const PAGE_MARKDOWN_COPY_ROOT = 'confluence-page-markdown-copy';
export const PAGE_BODY = '[data-testid="page-content-only"] .ak-renderer-document';
export const PAGE_HEADER = '[data-testid="page-content-header"]';
export const PAGE_TITLE_WRAPPER = '[data-testid="title-wrapper"]';
export const EDITOR_PRIMARY_TOOLBAR = '[data-testid="editor-primary-toolbar"]';
export const EDITOR_BODY = '[data-testid="editor-wrapper"] .ProseMirror[contenteditable="true"][role="textbox"]';
export const EDITOR_MARKDOWN_TO_ADF_ROOT = 'confluence-editor-markdown-to-adf';

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
].join(',');
