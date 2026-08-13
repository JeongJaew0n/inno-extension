export function readConfluenceCodeBlockText(codeBlock: HTMLElement): string {
  const lines = Array.from(codeBlock.querySelectorAll<HTMLElement>('.cm-content .cm-line'));
  if (lines.length > 0) return lines.map((line) => line.textContent ?? '').join('\n');

  const content = codeBlock.querySelector<HTMLElement>('.cm-content');
  return content?.innerText.replace(/\r\n?/g, '\n') ?? '';
}
