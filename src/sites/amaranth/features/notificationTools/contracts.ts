export interface NotificationTextContent {
  source: string;
  title: string;
  body: string;
}

export interface VerificationCodeMatch {
  code: string;
  location: 'title' | 'body';
}

const VERIFICATION_CONTEXT_PATTERN = /(?:auth\s*code|authcode|authentication|verification|one[-\s]?time|otp|token\s*code|passcode|인증(?:번호|\s*코드)?|보안\s*코드|일회용)/iu;
const VERIFICATION_CODE_PATTERN = /(?:^|[^0-9])([0-9]{4,6})(?![0-9])/u;

export function extractVerificationCode(text: string): string | null {
  return text.match(VERIFICATION_CODE_PATTERN)?.[1] ?? null;
}

export function findVerificationCodeInNotification(
  notification: NotificationTextContent,
): VerificationCodeMatch | null {
  if (notification.source.replace(/\s+/gu, '') !== '[메일]') return null;

  const combinedText = `${notification.title}\n${notification.body}`;
  if (!VERIFICATION_CONTEXT_PATTERN.test(combinedText)) return null;

  const titleCode = extractVerificationCode(notification.title);
  if (titleCode) return { code: titleCode, location: 'title' };

  const bodyCode = extractVerificationCode(notification.body);
  return bodyCode ? { code: bodyCode, location: 'body' } : null;
}
