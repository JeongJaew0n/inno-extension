/**
 * 설명 편집 막기의 순수 로직.
 *
 * docs/plans/jira-description-edit-lock/spec.md
 */

export interface EditLockOptions extends Record<string, unknown> {
  /** `true` 면 본문 클릭으로 편집되지 않는다 */
  locked: boolean;
}

/** 설정에서 읽은 값을 맞춘다. 불리언이 아니면 기본값(막지 않음)으로 떨어진다. */
export function normalizeEditLockOptions(value: unknown): EditLockOptions {
  const locked = (value as { locked?: unknown } | null | undefined)?.locked;
  return { locked: locked === true };
}

export interface ClickFacts {
  /** 막기가 켜져 있는가 */
  locked: boolean;
  /** `편집` 버튼이 보낸 클릭인가. 이건 통과시켜야 편집에 들어간다 */
  bypass: boolean;
  /** 클릭이 설명 필드 안에서 일어났는가 */
  insideDescription: boolean;
  /** 우리가 주입한 UI 안의 클릭인가 */
  insideOurUi: boolean;
  /**
   * 본문 **렌더러 안의** 링크·버튼·체크박스 같은 조작 요소를 눌렀는가.
   *
   * 렌더러 안으로 한정한다. 설명 전체를 감싸는 Jira 의 클릭 영역이 `role="button"` 일 수
   * 있어서, 그걸 조작 요소로 치면 어떤 클릭도 막지 못한다.
   */
  onInteractiveContent: boolean;
}

/** 이 클릭을 Jira 에 닿기 전에 끊을지 */
export function shouldBlockDescriptionClick(facts: ClickFacts): boolean {
  if (!facts.locked || facts.bypass) return false;
  if (!facts.insideDescription || facts.insideOurUi) return false;
  // 링크 이동·펼치기·체크박스는 편집이 아니다. 그대로 둔다.
  return !facts.onInteractiveContent;
}
