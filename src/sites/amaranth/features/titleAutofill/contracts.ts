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

/**
 * 근태신청서 양식 이름. 실측(2026-10-01) 순서 그대로다.
 *
 * 화면에서는 카드 목록을 직접 읽는다. 이 목록은 **화면을 볼 수 없는 Popup** 이 쓴다.
 * `근태일정` 은 신청서가 아니라(달력) 뺐다.
 *
 * docs/plans/amaranth-title-autofill-per-form/context.md
 */
export const KNOWN_FORM_NAMES = [
  '연차휴가신청서',
  '외근신청서',
  '출장신청서',
  '교육신청서',
  '휴일/주말근무신청서',
  '경조휴가신청서',
  '기타휴가신청서',
  '출산및육아휴직신청서',
  '휴직신청서',
] as const;

/** 카드 목록에 있지만 신청서가 아닌 것 */
const NOT_A_FORM = new Set(['근태일정']);

export function normalizeFormName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** 화면 카드 목록에서 읽은 이름을 신청서 양식만 남긴다 */
export function filterFormNames(names: readonly unknown[]): string[] {
  return [...new Set(names.map(normalizeFormName))]
    .filter((name) => name && !NOT_A_FORM.has(name));
}

export interface TitleAutofillOptions extends Record<string, unknown> {
  /** 기본 문구. 양식별 문구가 없을 때 쓴다. 양식별 기능 이전의 단일 문구가 그대로 여기 남는다 */
  titleText: string;
  /** 양식 이름 → 문구. 빈 문구는 두지 않는다 */
  titleTextsByForm: Record<string, string>;
}

export function normalizeTitleAutofillOptions(value: unknown): TitleAutofillOptions {
  const source = (value ?? {}) as { titleText?: unknown; titleTextsByForm?: unknown };
  const byForm: Record<string, string> = {};
  if (source.titleTextsByForm && typeof source.titleTextsByForm === 'object' && !Array.isArray(source.titleTextsByForm)) {
    for (const [rawName, rawText] of Object.entries(source.titleTextsByForm as Record<string, unknown>)) {
      const name = normalizeFormName(rawName);
      const text = normalizeTitleAutofillText(rawText);
      if (name && text) byForm[name] = text;
    }
  }
  return { titleText: normalizeTitleAutofillText(source.titleText), titleTextsByForm: byForm };
}

/** 지금 양식에 채울 문구. 양식별 문구가 없으면 기본 문구 */
export function resolveTitleText(options: TitleAutofillOptions, formName: string | null): string {
  const name = normalizeFormName(formName);
  return (name && options.titleTextsByForm[name]) || options.titleText;
}

/**
 * 모달·Popup 이 모은 입력을 저장할 옵션으로 만든다.
 *
 * `entries` 에 들어온 양식만 덮어쓴다. 화면에 안 보인 양식의 저장값은 그대로 둔다 —
 * 모달이 목록을 다 못 읽었을 때 남의 문구를 지우지 않기 위해서다.
 */
export function applyTitleTextEdits(
  options: TitleAutofillOptions,
  defaultText: string,
  entries: ReadonlyArray<readonly [string, string]>,
): TitleAutofillOptions {
  const byForm = { ...options.titleTextsByForm };
  for (const [rawName, rawText] of entries) {
    const name = normalizeFormName(rawName);
    if (!name) continue;
    const text = normalizeTitleAutofillText(rawText);
    if (text) byForm[name] = text;
    else delete byForm[name];
  }
  return { titleText: normalizeTitleAutofillText(defaultText), titleTextsByForm: byForm };
}

/** Popup 이 보여 줄 양식 목록 — 알려진 양식 다음에 저장된 다른 이름 */
export function formNamesForSettings(options: TitleAutofillOptions): string[] {
  const known: string[] = [...KNOWN_FORM_NAMES];
  const extra = Object.keys(options.titleTextsByForm).filter((name) => !known.includes(name));
  return [...known, ...extra];
}
