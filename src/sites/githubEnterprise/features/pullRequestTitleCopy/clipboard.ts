import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import {
  buildMarkdownLink,
  normalizeTitleText,
} from '../../../../platform/clipboard/markdownLink';

export interface PullRequestClipboardContent {
  markdown: string;
  pullRequestUrl: string;
}

export function buildPullRequestClipboardContent(
  pullRequestUrl: string,
  title: string | null,
): PullRequestClipboardContent | null {
  const normalizedTitle = normalizeTitleText(title);
  if (!normalizedTitle) return null;

  return {
    markdown: buildMarkdownLink(normalizedTitle, pullRequestUrl),
    pullRequestUrl,
  };
}

export async function writePullRequestClipboardContent(
  content: PullRequestClipboardContent,
): Promise<void> {
  await writePlainText(content.markdown);
}

/**
 * 제목만 복사할 때 쓰는 평문을 만든다.
 *
 * Markdown 링크가 아니므로 대괄호를 이스케이프하지 않는다. `[CloudStation] 관리 기능`처럼
 * 화면에 보이는 그대로를 복사한다. 저장소 접두사(`#II-SL-...BE/411:`)도 제목의 일부이므로
 * 떼어내지 않는다.
 */
export function buildPullRequestTitleText(title: string | null): string | null {
  return normalizeTitleText(title);
}
