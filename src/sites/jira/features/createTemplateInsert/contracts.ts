/**
 * 업무 생성 템플릿의 순수 로직.
 *
 * DOM 과 무관한 판정만 모아 테스트한다. 편집기 조작은 `runtime.ts` 가 한다.
 *
 * docs/plans/jira-create-helpers/spec.md
 */

export interface TemplateEntry {
  title: string;
  body: string;
}

/**
 * 확장이 기본 제공하는 템플릿.
 *
 * 팀 표준(`jira-ticket` 스킬)의 유형별 골격이다. 근거는 PAAS `10. 개발 프로세스` 의
 * "Description 에 Goal 과 Output 을 작성" 조항이고, 모든 유형이 그 둘로 시작한다.
 *
 * **설정에 저장하지 않는다.** 코드에 두면 다음 릴리즈에서 골격을 고쳤을 때 기존 사용자도
 * 그대로 받는다. 통째로 저장하면 한 번 저장한 사용자는 영원히 옛 골격을 쓴다.
 *
 * 사용자는 **숨길 수는 있지만 삭제할 수는 없다.**
 */
export const BUILT_IN_TEMPLATES: readonly TemplateEntry[] = [
  {
    title: '작업',
    body: [
      '## Goal',
      '무엇을 왜 하는지 1~3문장.',
      '',
      '## Output',
      '소스코드 | 문서 | 형상 | 조사 결과 (경로를 함께 적으면 찾기 쉽다)',
      '',
      '## Scope',
      '- 포함하는 것',
      '- 포함하지 않는 것',
      '',
      '## Done',
      '- 무엇이 되면 끝인지',
    ].join('\n'),
  },
  {
    title: '버그',
    body: [
      '## Goal',
      '무엇이 어떻게 잘못되어 무엇을 고치는지 1~3문장.',
      '',
      '## Output',
      '소스코드 | 형상 | 조사 결과',
      '',
      '## 현상',
      '관측된 것만. 원인 추론이 아니라 사실.',
      '',
      '## 조치',
      '무엇을 어떻게 바꾸는지. 이미 고쳤으면 무엇을 고쳤는지.',
    ].join('\n'),
  },
  {
    title: '에픽',
    body: [
      '## Goal',
      '이 묶음이 무엇을 이루려는지.',
      '',
      '## Output',
      '산출물 유형',
      '',
      '## Scope',
      '- 하위 작업으로 갈음한다',
    ].join('\n'),
  },
  {
    title: '하위 작업',
    body: [
      '## Goal',
      '상위 작업에서 쪼갠 이 조각이 무엇인지. 배경은 상위에 있으므로 반복하지 않는다.',
      '',
      '## Output',
      '산출물 유형',
      '',
      '## Scope',
      '- 이 조각이 다루는 범위',
    ].join('\n'),
  },
  {
    title: '문서',
    body: ['## Goal', '어떤 문서를 왜 쓰는지.', '', '## Output', '문서 (링크 또는 경로)'].join('\n'),
  },
] as const;

export interface Template extends TemplateEntry {
  /** 목록에 보일지. 끄면 `$` 목록에서 빠진다 */
  visible: boolean;
  /** 확장이 기본 제공하는지. `true` 면 삭제할 수 없다 */
  builtIn: boolean;
}

export interface TemplateOptions extends Record<string, unknown> {
  /** 숨긴 내장 템플릿의 제목 목록 */
  hiddenBuiltInTitles: string[];
  /** 사용자가 추가한 템플릿 */
  customTemplates: Array<{ title: string; body: string; visible: boolean }>;
}

export function createDefaultTemplateOptions(): TemplateOptions {
  return { hiddenBuiltInTitles: [], customTemplates: [] };
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

/** 설정에서 읽은 값을 안전한 형태로 맞춘다. 형식이 깨져 있으면 기본값으로 떨어진다. */
export function normalizeTemplateOptions(value: unknown): TemplateOptions {
  const source = (value ?? {}) as Partial<TemplateOptions>;
  const builtInTitles = new Set(BUILT_IN_TEMPLATES.map((template) => template.title));

  const hidden = Array.isArray(source.hiddenBuiltInTitles)
    ? [...new Set(
      source.hiddenBuiltInTitles
        .map(cleanTitle)
        .filter((title): title is string => title !== null && builtInTitles.has(title)),
    )]
    : [];

  const seen = new Set<string>(builtInTitles);
  const customTemplates: TemplateOptions['customTemplates'] = [];
  if (Array.isArray(source.customTemplates)) {
    for (const entry of source.customTemplates) {
      const title = cleanTitle((entry as { title?: unknown })?.title);
      // 내장과 같은 제목은 커스텀으로 두지 않는다. 목록에 두 번 나온다.
      if (!title || seen.has(title)) continue;
      const body = (entry as { body?: unknown })?.body;
      seen.add(title);
      customTemplates.push({
        title,
        body: typeof body === 'string' ? body : '',
        visible: (entry as { visible?: unknown })?.visible !== false,
      });
    }
  }

  return { hiddenBuiltInTitles: hidden, customTemplates };
}

/** 설정을 Popup 에 보여줄 전체 목록으로 편다. 내장이 먼저 온다 */
export function resolveTemplates(options: TemplateOptions): Template[] {
  const hidden = new Set(options.hiddenBuiltInTitles);
  return [
    ...BUILT_IN_TEMPLATES.map((template) => ({
      ...template,
      visible: !hidden.has(template.title),
      builtIn: true,
    })),
    ...options.customTemplates.map((template) => ({ ...template, builtIn: false })),
  ];
}

/** `$` 목록에 실제로 보여줄 것만 고른다 */
export function visibleTemplates(options: TemplateOptions): Template[] {
  return resolveTemplates(options).filter((template) => template.visible);
}

/**
 * 입력값에서 `$` 토큰을 읽는다.
 *
 * **첫 글자가 `$` 일 때만** 토큰으로 본다. 문장 중간의 `$` 는 금액 표기(`$100`)에 흔해서
 * 중간 트리거를 허용하면 정상 입력을 방해한다.
 *
 * 토큰은 첫 공백 전까지다. 공백이 나오면 사용자가 본문을 쓰기 시작한 것으로 본다.
 *
 * @returns 토큰(앞의 `$` 제외). `$` 입력이 아니면 `null`
 */
export function readTemplateToken(value: string): string | null {
  if (!value.startsWith('$')) return null;
  const rest = value.slice(1);
  return /\s/.test(rest) ? null : rest;
}

/** 토큰으로 템플릿을 거른다. 빈 토큰이면 전부 보여준다. 대소문자를 무시한다 */
export function filterTemplates(templates: readonly Template[], token: string): Template[] {
  if (!token) return [...templates];
  const needle = token.toLowerCase();
  return templates.filter((template) => template.title.toLowerCase().includes(needle));
}

/** 목록에서 커서를 옮긴다. 끝에서 넘어가면 반대편으로 돈다 */
export function moveActiveIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}

/** 내장 템플릿의 숨김 여부를 바꾼 설정을 만든다 */
export function setBuiltInVisibility(
  options: TemplateOptions,
  title: string,
  visible: boolean,
): TemplateOptions {
  const hidden = new Set(options.hiddenBuiltInTitles);
  if (visible) hidden.delete(title);
  else hidden.add(title);
  return { ...options, hiddenBuiltInTitles: [...hidden] };
}

/** 사용자 템플릿의 표시 여부를 바꾼다 */
export function setCustomVisibility(
  options: TemplateOptions,
  title: string,
  visible: boolean,
): TemplateOptions {
  return {
    ...options,
    customTemplates: options.customTemplates.map(
      (template) => (template.title === title ? { ...template, visible } : template),
    ),
  };
}

/** 사용자 템플릿을 추가한다. 제목이 비었거나 이미 있으면 그대로 돌려준다 */
export function addCustomTemplate(
  options: TemplateOptions,
  rawTitle: string,
  body: string,
): TemplateOptions {
  const title = cleanTitle(rawTitle);
  if (!title) return options;
  if (resolveTemplates(options).some((template) => template.title === title)) return options;
  return {
    ...options,
    customTemplates: [...options.customTemplates, { title, body, visible: true }],
  };
}

/** 사용자 템플릿의 본문을 고친다. 내장은 고칠 수 없다 */
export function updateCustomTemplate(
  options: TemplateOptions,
  title: string,
  body: string,
): TemplateOptions {
  return {
    ...options,
    customTemplates: options.customTemplates.map(
      (template) => (template.title === title ? { ...template, body } : template),
    ),
  };
}

/**
 * 템플릿을 지운다.
 *
 * **내장은 지울 수 없다.** 제목이 내장 목록에 있으면 아무것도 하지 않는다.
 */
export function removeCustomTemplate(options: TemplateOptions, title: string): TemplateOptions {
  if (BUILT_IN_TEMPLATES.some((template) => template.title === title)) return options;
  return {
    ...options,
    customTemplates: options.customTemplates.filter((template) => template.title !== title),
  };
}
