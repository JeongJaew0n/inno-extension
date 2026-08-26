import { writePlainText } from '../../../../platform/clipboard/writePlainText';

export interface PullRequestClipboardContent {
  markdown: string;
  pullRequestUrl: string;
}

function normalizeTitle(title: string | null | undefined): string | null {
  const normalized = title?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

/**
 * Markdown 링크 텍스트에서 구조를 깨는 문자를 이스케이프한다.
 *
 * 제목의 `[`, `]`는 링크 텍스트 범위를 잘라내고 `\`는 이스케이프 자체를 무너뜨린다.
 * GitHub PR 제목에는 `[CloudStation]` 같은 대괄호 접두사가 흔하다.
 */
function escapeMarkdownLinkText(title: string): string {
  return title.replace(/([\\[\]])/g, '\\$1');
}

/**
 * URL에서 Markdown 링크 대상 범위를 깨는 문자를 감싼다.
 *
 * 괄호가 포함된 URL은 `<>`로 감싸야 링크가 끊기지 않는다.
 */
function encodeMarkdownLinkUrl(url: string): string {
  return /[()\s]/.test(url) ? `<${url}>` : url;
}

export function buildPullRequestClipboardContent(
  pullRequestUrl: string,
  title: string | null,
): PullRequestClipboardContent | null {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return null;

  return {
    markdown: `[${escapeMarkdownLinkText(normalizedTitle)}](${encodeMarkdownLinkUrl(pullRequestUrl)})`,
    pullRequestUrl,
  };
}

export async function writePullRequestClipboardContent(
  content: PullRequestClipboardContent,
): Promise<void> {
  await writePlainText(content.markdown);
}
