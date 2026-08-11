import { escapeEditorHtml } from './adf-to-editor-html';

export function codeBlockTextToEditorHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const content = escapeEditorHtml(paragraph).replace(/\n/g, '<br>');
      return `<p>${content || '<br>'}</p>`;
    })
    .join('');
}

export function readConfluenceCodeBlockText(codeBlock: HTMLElement): string {
  const lines = Array.from(codeBlock.querySelectorAll<HTMLElement>('.cm-content .cm-line'));
  if (lines.length > 0) return lines.map((line) => line.textContent ?? '').join('\n');

  const content = codeBlock.querySelector<HTMLElement>('.cm-content');
  return content?.innerText.replace(/\r\n?/g, '\n') ?? '';
}
