import { JIRA_ORIGIN, normalizeIssueKey } from '../../routes';
import { writePlainText } from '../../../../platform/clipboard/writePlainText';

export interface IssueClipboardContent {
  plainText: string;
  htmlText: string;
  issueUrl: string;
}

function normalizeIssueTitle(issueTitle: string | undefined): string | null {
  if (typeof issueTitle !== 'string') return null;
  const normalized = issueTitle.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildIssueClipboardContent(
  issueKey: string,
  issueTitle?: string,
): IssueClipboardContent | null {
  const normalizedIssueKey = normalizeIssueKey(issueKey);
  if (!normalizedIssueKey) return null;

  const issueUrl = `${JIRA_ORIGIN}/browse/${normalizedIssueKey}`;
  const normalizedIssueTitle = normalizeIssueTitle(issueTitle);
  const titleSuffix = normalizedIssueTitle ? ` ${normalizedIssueTitle}` : '';
  const htmlTitleSuffix = normalizedIssueTitle ? ` ${escapeHtml(normalizedIssueTitle)}` : '';
  return {
    plainText: `${normalizedIssueKey}${titleSuffix}`,
    htmlText: `<a href="${issueUrl}">${normalizedIssueKey}</a>${htmlTitleSuffix}`,
    issueUrl,
  };
}

export async function writeIssueClipboardContent(content: IssueClipboardContent): Promise<void> {
  if (navigator.clipboard
    && typeof navigator.clipboard.write === 'function'
    && typeof ClipboardItem === 'function') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([content.htmlText], { type: 'text/html' }),
          'text/plain': new Blob([content.plainText], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // 브라우저가 리치 클립보드를 거부하면 이슈 키 일반 텍스트로 대체한다.
    }
  }

  await writePlainText(content.plainText);
}
