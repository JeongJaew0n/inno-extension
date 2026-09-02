import { writePlainText } from '../../../../platform/clipboard/writePlainText';
import {
  buildMarkdownLink,
  normalizeTitleText,
} from '../../../../platform/clipboard/markdownLink';

/** Markdown 링크 형식으로 복사할 문자열을 만든다. */
export function buildMergeRequestMarkdown(
  mergeRequestUrl: string,
  title: string | null,
): string | null {
  const normalizedTitle = normalizeTitleText(title);
  if (!normalizedTitle) return null;
  return buildMarkdownLink(normalizedTitle, mergeRequestUrl);
}

/**
 * 제목만 복사할 때 쓰는 평문을 만든다.
 *
 * Markdown 링크가 아니므로 대괄호를 이스케이프하지 않는다. 화면에 보이는 그대로를 복사한다.
 * 제목 안의 이슈 자동 링크(`NPT-164`)도 텍스트로 포함된다.
 */
export function buildMergeRequestTitleText(title: string | null): string | null {
  return normalizeTitleText(title);
}

export async function writeCopyText(text: string): Promise<void> {
  await writePlainText(text);
}
