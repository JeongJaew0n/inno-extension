export const TITLE_AUTOFILL_MAX_LENGTH = 190;
const ATTENDANCE_APPLICATION_HASH_PREFIX = '#/HP/HPD0110/HPD0110';

export function normalizeTitleAutofillText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().slice(0, TITLE_AUTOFILL_MAX_LENGTH)
    : '';
}

export function isTitleAutofillRoute(url: URL): boolean {
  return url.origin === 'https://gw.innogrid.com'
    && url.hash.startsWith(ATTENDANCE_APPLICATION_HASH_PREFIX);
}
