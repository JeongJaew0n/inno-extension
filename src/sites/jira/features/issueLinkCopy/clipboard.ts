import { JIRA_ORIGIN, normalizeIssueKey } from '../../routes';

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

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(content.plainText);
      return;
    } catch {
      // Clipboard API가 거부되면 사용자 클릭 이벤트 안에서 DOM 복사를 마지막으로 시도한다.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = content.plainText;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('클립보드 API를 사용할 수 없습니다.');
}
