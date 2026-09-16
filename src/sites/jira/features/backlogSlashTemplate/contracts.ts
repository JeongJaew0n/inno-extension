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
  const spaceIndex = rest.search(/\s/);
  return spaceIndex === -1 ? rest : null;
}

/** 비교할 때 무시할 문자를 걷어낸다. 대괄호를 빼야 `/Dev`가 `[DevOpsit]`에 걸린다. */
function normalizeForMatch(value: string): string {
  return value.replace(/[[\]]/g, '').toLowerCase();
}

/**
 * 토큰으로 템플릿을 거른다.
 *
 * 빈 토큰(`/`만 입력)이면 전부 보여준다. 대소문자와 대괄호를 무시하고 **포함**으로 비교한다.
 */
export function filterTemplates(
  templates: readonly string[],
  token: string,
): string[] {
  const valid = templates.map((template) => template.trim()).filter(Boolean);
  if (!token) return valid;

  const needle = normalizeForMatch(token);
  return valid.filter((template) => normalizeForMatch(template).includes(needle));
}

export interface SlashInsertion {
  value: string;
  caret: number;
}

/**
 * 선택한 템플릿을 넣은 결과를 만든다.
 *
 * 슬래시 토큰을 템플릿으로 **치환**하고 뒤에 공백 하나를 붙여 바로 이어 쓸 수 있게 한다.
 * 커서는 그 공백 뒤에 둔다.
 *
 * 결과가 입력창의 최대 길이를 넘으면 `null`을 돌려준다. 잘린 제목을 만드는 것보다 넣지 않는
 * 편이 낫다.
 */
export function buildInsertion(
  value: string,
  template: string,
  maxLength: number = SUMMARY_MAX_LENGTH,
): SlashInsertion | null {
  const token = readSlashToken(value);
  if (token === null) return null;

  const next = `${template} `;
  if (next.length > maxLength) return null;

  return { value: next, caret: next.length };
}

/** 목록에서 커서를 옮긴다. 끝에서 넘어가면 반대편으로 돈다. */
export function moveActiveIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}

/**
 * 저장된 템플릿 문자열을 목록으로 바꾼다.
 *
 * Popup에서 한 줄에 하나씩 편집하므로 줄 단위로 나누고 빈 줄과 앞뒤 공백을 정리한다.
 * 중복은 먼저 나온 것을 남긴다.
 */
export function parseTemplateText(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** 목록을 Popup 편집용 문자열로 되돌린다. */
export function formatTemplateText(templates: readonly string[]): string {
  return templates.join('\n');
}

/** 설정에서 읽은 값이 문자열 배열인지 확인한다. 아니면 기본값을 쓴다. */
export function normalizeTemplates(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const templates = value.filter((item): item is string => typeof item === 'string');
  const cleaned = parseTemplateText(templates.join('\n'));
  return cleaned.length > 0 ? cleaned : [...fallback];
}
