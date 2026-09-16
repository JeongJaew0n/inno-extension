/**
 * 백로그 슬래시 템플릿의 순수 로직.
 *
 * DOM과 무관한 판정만 모아 테스트할 수 있게 한다. 실제 입력창 조작은 `runtime.ts`가 한다.
 *
 * docs/plans/jira-backlog-slash-template/spec.md
 */

/** Jira 업무 제목 입력창의 최대 길이. 실측값이다. */
export const SUMMARY_MAX_LENGTH = 255;

/**
 * 확장이 기본 제공하는 prefix 태그.
 *
 * **설정에 저장하지 않는다.** 코드에 두면 다음 릴리즈에서 목록을 늘렸을 때 기존 사용자도
 * 그대로 받는다. 설정에 통째로 저장하면 한 번 저장한 사용자는 영원히 옛 목록을 쓴다.
 *
 * 사용자는 **숨길 수는 있지만 삭제할 수는 없다.** 숨김 여부만 설정에 남긴다.
 */
export const BUILT_IN_PREFIX_TAGS = [
  '[공통]',
  '[DevOpsit]',
  '[DevOpsit][BE]',
  '[INFRA]',
  '[IAM]',
  '[CI/CD]',
  '[GitOps]',
  '[개발환경]',
  '[점검/배포]',
] as const;

export interface PrefixTag {
  label: string;
  /** 목록에 보일지. 끄면 `/` 목록에서 빠진다 */
  visible: boolean;
  /** 확장이 기본 제공하는 태그인지. `true`면 삭제할 수 없다 */
  builtIn: boolean;
}

export interface PrefixTagOptions extends Record<string, unknown> {
  /** 숨긴 내장 태그의 라벨 목록 */
  hiddenBuiltInTags: string[];
  /** 사용자가 추가한 태그 */
  customTags: Array<{ label: string; visible: boolean }>;
}

export function createDefaultPrefixTagOptions(): PrefixTagOptions {
  return { hiddenBuiltInTags: [], customTags: [] };
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

/** 설정에서 읽은 값을 안전한 형태로 맞춘다. 형식이 깨져 있으면 기본값으로 떨어진다. */
export function normalizePrefixTagOptions(value: unknown): PrefixTagOptions {
  const source = (value ?? {}) as Partial<PrefixTagOptions>;

  const builtInSet = new Set<string>(BUILT_IN_PREFIX_TAGS);
  const hidden = Array.isArray(source.hiddenBuiltInTags)
    ? [...new Set(
      source.hiddenBuiltInTags
        .map(cleanLabel)
        .filter((label): label is string => label !== null && builtInSet.has(label)),
    )]
    : [];

  const seen = new Set<string>(builtInSet);
  const customTags: PrefixTagOptions['customTags'] = [];
  if (Array.isArray(source.customTags)) {
    for (const entry of source.customTags) {
      const label = cleanLabel((entry as { label?: unknown })?.label);
      // 내장 태그와 같은 라벨은 커스텀으로 두지 않는다. 목록에 두 번 나온다.
      if (!label || seen.has(label)) continue;
      seen.add(label);
      customTags.push({ label, visible: (entry as { visible?: unknown })?.visible !== false });
    }
  }

  return { hiddenBuiltInTags: hidden, customTags };
}

/**
 * 설정을 Popup에 보여줄 전체 태그 목록으로 편다.
 *
 * 내장 태그가 먼저 오고 커스텀이 뒤에 온다. 순서를 고정해야 사용자가 찾기 쉽다.
 */
export function resolvePrefixTags(options: PrefixTagOptions): PrefixTag[] {
  const hidden = new Set(options.hiddenBuiltInTags);
  return [
    ...BUILT_IN_PREFIX_TAGS.map((label) => ({
      label,
      visible: !hidden.has(label),
      builtIn: true,
    })),
    ...options.customTags.map((tag) => ({ ...tag, builtIn: false })),
  ];
}

/** `/` 목록에 실제로 보여줄 라벨만 고른다. */
export function visibleTagLabels(options: PrefixTagOptions): string[] {
  return resolvePrefixTags(options).filter((tag) => tag.visible).map((tag) => tag.label);
}

/**
 * 입력값에서 슬래시 토큰을 읽는다.
 *
 * **입력 첫 글자가 `/`일 때만** 토큰으로 본다. 문장 중간의 `/`는 경로나 날짜에 흔해서
 * (`src/sites/jira`, `9/16`) 중간 트리거를 허용하면 정상 입력을 방해한다.
 *
 * 토큰은 첫 공백 전까지다. 공백이 나오면 사용자가 슬래시 입력을 끝내고 본문을 쓰기 시작한
 * 것으로 본다.
 *
 * @returns 토큰(앞의 `/` 제외). 슬래시 입력이 아니면 `null`
 */
export function readSlashToken(value: string): string | null {
  if (!value.startsWith('/')) return null;

  const rest = value.slice(1);
  return /\s/.test(rest) ? null : rest;
}

/**
 * 비교할 때 무시할 문자를 걷어낸다.
 *
 * 대괄호를 빼야 `/Dev`가 `[DevOpsit]`에 걸린다. `/`도 뺀다. `[CI/CD]`처럼 태그 안에 `/`가
 * 들어가는 경우가 실제로 있어서, 토큰의 `/`와 태그의 `/`가 서로 방해하면 안 된다.
 */
function normalizeForMatch(value: string): string {
  return value.replace(/[[\]/]/g, '').toLowerCase();
}

/**
 * 토큰으로 태그를 거른다.
 *
 * 빈 토큰(`/`만 입력)이면 전부 보여준다. 대소문자·대괄호·슬래시를 무시하고 **포함**으로
 * 비교한다.
 */
export function filterTags(tags: readonly string[], token: string): string[] {
  const valid = tags.map((tag) => tag.trim()).filter(Boolean);
  if (!token) return valid;

  const needle = normalizeForMatch(token);
  if (!needle) return valid;
  return valid.filter((tag) => normalizeForMatch(tag).includes(needle));
}

export interface SlashInsertion {
  value: string;
  caret: number;
}

/**
 * 선택한 태그를 넣은 결과를 만든다.
 *
 * 슬래시 토큰을 태그로 **치환**하고 뒤에 공백 하나를 붙여 바로 이어 쓸 수 있게 한다.
 * 커서는 그 공백 뒤에 둔다.
 *
 * 결과가 입력창의 최대 길이를 넘으면 `null`을 돌려준다. 잘린 제목을 만드는 것보다 넣지 않는
 * 편이 낫다.
 */
export function buildInsertion(
  value: string,
  tag: string,
  maxLength: number = SUMMARY_MAX_LENGTH,
): SlashInsertion | null {
  if (readSlashToken(value) === null) return null;

  const next = `${tag} `;
  if (next.length > maxLength) return null;

  return { value: next, caret: next.length };
}

/** 목록에서 커서를 옮긴다. 끝에서 넘어가면 반대편으로 돈다. */
export function moveActiveIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}

/** 내장 태그의 숨김 여부를 바꾼 설정을 만든다. */
export function setBuiltInVisibility(
  options: PrefixTagOptions,
  label: string,
  visible: boolean,
): PrefixTagOptions {
  const hidden = new Set(options.hiddenBuiltInTags);
  if (visible) hidden.delete(label);
  else hidden.add(label);
  return { ...options, hiddenBuiltInTags: [...hidden] };
}

/** 커스텀 태그의 표시 여부를 바꾼다. */
export function setCustomVisibility(
  options: PrefixTagOptions,
  label: string,
  visible: boolean,
): PrefixTagOptions {
  return {
    ...options,
    customTags: options.customTags.map((tag) => (tag.label === label ? { ...tag, visible } : tag)),
  };
}

/** 커스텀 태그를 추가한다. 라벨이 비었거나 이미 있으면 그대로 돌려준다. */
export function addCustomTag(options: PrefixTagOptions, rawLabel: string): PrefixTagOptions {
  const label = cleanLabel(rawLabel);
  if (!label) return options;
  if (resolvePrefixTags(options).some((tag) => tag.label === label)) return options;
  return { ...options, customTags: [...options.customTags, { label, visible: true }] };
}

/**
 * 커스텀 태그의 라벨을 바꾼다.
 *
 * 내장 태그와 같은 라벨로는 바꿀 수 없다. 목록에 같은 것이 두 번 나온다.
 */
export function renameCustomTag(
  options: PrefixTagOptions,
  from: string,
  rawTo: string,
): PrefixTagOptions {
  const to = cleanLabel(rawTo);
  if (!to || to === from) return options;
  if (resolvePrefixTags(options).some((tag) => tag.label === to)) return options;
  return {
    ...options,
    customTags: options.customTags.map((tag) => (tag.label === from ? { ...tag, label: to } : tag)),
  };
}

/**
 * 커스텀 태그를 지운다.
 *
 * **내장 태그는 지울 수 없다.** 라벨이 내장 목록에 있으면 아무것도 하지 않는다.
 */
export function removeCustomTag(options: PrefixTagOptions, label: string): PrefixTagOptions {
  if ((BUILT_IN_PREFIX_TAGS as readonly string[]).includes(label)) return options;
  return { ...options, customTags: options.customTags.filter((tag) => tag.label !== label) };
}
