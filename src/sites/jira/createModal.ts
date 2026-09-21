/**
 * Jira 업무 생성 모달을 다루는 공용 코드.
 *
 * `createQuickDates` 와 `createTemplateInsert` 가 함께 쓴다.
 *
 * ## 이 모달의 까다로운 점
 *
 * 필드가 처음부터 다 있지 않다. **두 단계를 펼쳐야 생긴다.**
 *
 * ```
 * 만들기 → [더 보기] → [추가 필드(N개)] → 그때야 6개가 마운트된다
 * ```
 *
 * 접힌 상태에서도 `duedate` 컨테이너는 DOM 에 있다. 다만 **속이 빈 껍데기**라
 * (`innerHTML` 29자) 있는지 여부로 판단하면 틀린다. 내용이 들었는지를 본다.
 *
 * docs/plans/jira-create-helpers/context.md
 */

import {
  CREATE_MODAL,
  CREATE_MODAL_ADDITIONAL_FIELDS,
  CREATE_MODAL_EXPAND_BUTTON,
  CREATE_MODAL_FIELD_PREFIX,
} from './selectors';

/** 펼침 애니메이션과 React 렌더를 기다리는 간격. 실측에서 이 정도면 충분했다 */
const POLL_INTERVAL_MS = 120;
const POLL_TIMEOUT_MS = 4000;

export function findCreateModal(document: Document): HTMLElement | null {
  const modal = document.querySelector<HTMLElement>(CREATE_MODAL);
  if (!modal) return null;
  // 같은 컨테이너를 다른 모달도 쓴다. 업무 생성 필드가 있어야 우리 대상이다.
  return modal.querySelector(`[data-testid^="${CREATE_MODAL_FIELD_PREFIX}"]`) ? modal : null;
}

/** 조건이 참이 될 때까지 짧게 기다린다. 못 기다리면 `null` */
async function waitFor<T>(read: () => T | null, timeoutMs = POLL_TIMEOUT_MS): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * 필드 컨테이너를 **라벨 텍스트로** 찾는다.
 *
 * `customfield_10015` 같은 ID 는 Jira 인스턴스마다 다르다. 라벨은 화면에 보이는 것이라
 * 사용자가 말하는 이름과도 일치한다.
 *
 * 속이 빈 껍데기는 건너뛴다. 아직 마운트되지 않은 것이다.
 */
export function findFieldByLabel(modal: HTMLElement, label: string): HTMLElement | null {
  for (const field of modal.querySelectorAll<HTMLElement>(`[data-testid^="${CREATE_MODAL_FIELD_PREFIX}"]`)) {
    if (field.querySelector('label')?.textContent?.trim() === label) return field;
  }
  return null;
}

/**
 * 숨은 필드가 나오도록 두 단계를 펼친다.
 *
 * **멱등하다.** 이미 펼쳐져 있으면 아무것도 누르지 않는다. 두 번 눌러 도로 접는 일이
 * 없어야 한다.
 *
 * @returns 펼치기가 끝났으면 `true`
 */
export async function expandAllFields(modal: HTMLElement, probeLabel: string): Promise<boolean> {
  // 이미 보이면 펼칠 것이 없다.
  if (findFieldByLabel(modal, probeLabel)) return true;

  const expand = modal.querySelector<HTMLElement>(CREATE_MODAL_EXPAND_BUTTON);
  // `더 보기` 는 펼쳐진 뒤에도 남아 있고 그때는 접는 버튼이 된다. 그래서 버튼 유무가
  // 아니라 **추가 필드 아코디언이 나왔는지**로 판단한다.
  if (expand && !findAdditionalFieldsToggle(modal)) {
    expand.click();
    await waitFor(() => findAdditionalFieldsToggle(modal));
  }

  const toggle = findAdditionalFieldsToggle(modal);
  if (toggle) {
    toggle.click();
    await waitFor(() => findFieldByLabel(modal, probeLabel));
  }

  return findFieldByLabel(modal, probeLabel) !== null;
}

/**
 * `추가 필드(N개)` 아코디언 머리말.
 *
 * 개수가 붙어 있어 텍스트가 고정이 아니다. testid 로 찾고, 그것이 바뀌면 텍스트로 떨어진다.
 */
function findAdditionalFieldsToggle(modal: HTMLElement): HTMLElement | null {
  const byTestId = modal.querySelector<HTMLElement>(CREATE_MODAL_ADDITIONAL_FIELDS);
  if (byTestId) return byTestId;
  return [...modal.querySelectorAll<HTMLElement>('button')]
    .find((button) => button.textContent?.includes('추가 필드')) ?? null;
}

export { waitFor };
