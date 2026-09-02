/**
 * 제목 텍스트를 정규화한다.
 *
 * 앞뒤 공백을 제거하고 연속 공백을 하나로 합친다. 비어 있으면 `null`이다.
 */
export function normalizeTitleText(title: string | null | undefined): string | null {
  const normalized = title?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

/**
 * Markdown 링크 텍스트에서 구조를 깨는 문자를 이스케이프한다.
 *
 * 제목의 `[`, `]`는 링크 텍스트 범위를 잘라내고 `\`는 이스케이프 자체를 무너뜨린다.
 * GitHub PR과 GitLab MR 제목에는 `[CloudStation]` 같은 대괄호 접두사가 흔하다.
 */
export function escapeMarkdownLinkText(title: string): string {
  return title.replace(/([\\[\]])/g, '\\$1');
}

/**
 * URL에서 Markdown 링크 대상 범위를 깨는 문자를 감싼다.
 *
 * 괄호나 공백이 포함된 URL은 `<>`로 감싸야 링크가 끊기지 않는다.
 */
export function encodeMarkdownLinkUrl(url: string): string {
  return /[()\s]/.test(url) ? `<${url}>` : url;
}

/** 정규화·이스케이프를 거친 Markdown 링크를 만든다. */
export function buildMarkdownLink(title: string, url: string): string {
  return `[${escapeMarkdownLinkText(title)}](${encodeMarkdownLinkUrl(url)})`;
}
