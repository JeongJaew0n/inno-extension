/**
 * Markdown 출력 규칙.
 *
 * 렌더러 경로(읽기 모드)와 ADF 경로(편집 모드)가 **같은 문서에서 같은 Markdown** 을 내야 한다.
 * 두 경로가 이 규칙을 함께 쓴다.
 *
 * docs/plans/adf-to-markdown/spec.md
 */

export function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]])/g, '\\$1');
}

export function longestBacktickRun(value: string): number {
  return Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
}

/** 인라인 코드. 안에 백틱이 있으면 울타리를 늘리고 양끝이 백틱이면 공백을 넣는다. */
export function renderInlineCode(value: string): string {
  const fence = '`'.repeat(Math.max(1, longestBacktickRun(value) + 1));
  const padding = value.startsWith('`') || value.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${value}${padding}${fence}`;
}

/** 코드블럭. 안의 백틱보다 긴 울타리를 쓴다. */
export function renderFencedCode(code: string, language: string): string {
  const normalized = code.replace(/\r\n?/g, '\n').trimEnd();
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(normalized) + 1));
  const safeLanguage = language.replace(/[^a-zA-Z0-9_+-]/g, '');
  return `\n\n${fence}${safeLanguage}\n${normalized}\n${fence}\n\n`;
}

/** 표 한 칸. 줄바꿈은 `<br>` 로, 세로줄은 이스케이프한다. */
export function normalizeTableCell(value: string): string {
  return value
    .trim()
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

/**
 * 목록 항목의 내용이 시작하는 들여쓰기. 이어지는 줄과 하위 목록을 여기에 맞춰야 그 항목에 속한다.
 *
 * CommonMark 는 **목록 마커 폭만큼** 들여써야 자식으로 본다. `- ` 는 2칸이지만 `1. ` 은 3칸,
 * `10. ` 은 4칸이다. 2칸으로 고정했더니 번호 목록 안의 하위 목록이 바깥 목록으로 떨어져 나갔다
 * (재현 2026-10-02: `1. parent` 밑의 `  - child` 가 별도 목록이 됨).
 *
 * 체크박스(`- [x]`)는 목록 마커가 `-` 이고 `[x]` 는 내용이다. 체크박스 폭까지 더하면 내용 기준으로
 * 4칸이 넘게 밀려 들여쓴 코드블럭으로 읽힌다. 그래서 첫 토막만 센다.
 */
export function listContentIndent(indent: string, marker: string): string {
  const listMarker = marker.split(' ')[0] ?? marker;
  return `${indent}${' '.repeat(listMarker.length + 1)}`;
}

export function normalizeListItem(value: string): string {
  return value
    .trim()
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n');
}

/** 표 본문을 GFM 표로 짠다. 칸 수가 모자란 행은 빈 칸으로 채운다. */
export function renderMarkdownTable(rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return '';
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount === 0) return '';

  const pad = (row: readonly string[]): string[] => [
    ...row,
    ...Array.from({ length: columnCount - row.length }, () => ''),
  ];
  const markdownRows = [
    pad(rows[0]),
    Array.from({ length: columnCount }, () => '---'),
    ...rows.slice(1).map(pad),
  ];
  return `\n\n${markdownRows.map((row) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
}

export function normalizeMarkdown(value: string): string {
  return value
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
