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
 * ## 2026-11 생성 모달
 *
 * 날짜 필드가 처음부터 pill 버튼으로 보인다. 펼칠 것이 없다. 대신 `<label>` 이 없고 버튼 글자가
 * 라벨이며, 값을 넣으면 그 글자가 날짜로 바뀐다(실측 2026-11-03). 그래서 라벨로 못 찾으면 필드 ID 로
 * 찾는다 — 두 번째 누를 때나 사용자가 먼저 날짜를 넣었을 때다.
 *
 * docs/plans/jira-create-helpers/context.md
 */

import {
  CREATE_MODAL,
  CREATE_MODAL_ADDITIONAL_FIELDS,
  CREATE_MODAL_DATE_TRIGGER,
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
 * 라벨은 `<label>` 이거나, 2026-11 모달이면 날짜 pill 버튼의 글자다.
 * 속이 빈 껍데기는 건너뛴다. 아직 마운트되지 않은 것이다.
 */
export function findFieldByLabel(modal: HTMLElement, label: string): HTMLElement | null {
  for (const field of modal.querySelectorAll<HTMLElement>(`[data-testid^="${CREATE_MODAL_FIELD_PREFIX}"]`)) {
    const text = field.querySelector('label')?.textContent
      ?? field.querySelector(CREATE_MODAL_DATE_TRIGGER)?.textContent;
    if (text?.trim() === label) return field;
  }
  return null;
}

/** 찾을 필드. 라벨로 먼저, 안 되면 ID 로 찾는다 */
export interface CreateFieldRef {
  label: string;
  /** 이 인스턴스에서 실측한 필드 ID. 라벨이 값으로 바뀐 뒤에 쓴다 */
  fieldId: string;
}

/**
 * **날짜** 필드를 라벨로 찾고, 못 찾으면 필드 ID 로 찾는다.
 *
 * 2026-11 모달의 날짜 pill 은 값을 넣으면 라벨 자리에 날짜가 들어간다(`시작 날짜` → `2026년 11월 03일`).
 * 라벨로만 찾으면 **두 번째 누를 때부터** 필드를 못 찾는다.
 */
export function findField(modal: HTMLElement, ref: CreateFieldRef): HTMLElement | null {
  const byLabel = findFieldByLabel(modal, ref.label);
  if (byLabel) return byLabel;
  const byId = modal.querySelector<HTMLElement>(`[data-testid="${CREATE_MODAL_FIELD_PREFIX}${ref.fieldId}"]`);
  // 접힌 모달의 자리는 속이 빈 껍데기다(innerHTML 29자 — 빈 요소 하나쯤은 들어 있을 수 있다). 자식이
  // 있는지로 보면 펼치기를 건너뛰고 실패한다. **날짜를 고를 트리거가 있어야** 마운트된 것으로 본다.
  return byId?.querySelector(`${CREATE_MODAL_DATE_TRIGGER}, [role="button"]`) ? byId : null;
}

/**
 * 숨은 필드가 나오도록 두 단계를 펼친다.
 *
 * **멱등하다.** 이미 펼쳐져 있으면 아무것도 누르지 않는다. 두 번 눌러 도로 접는 일이
 * 없어야 한다.
 *
 * @returns 펼치기가 끝났으면 `true`
 */
export async function expandAllFields(modal: HTMLElement, probe: CreateFieldRef): Promise<boolean> {
  // 이미 보이면 펼칠 것이 없다. 2026-11 모달은 날짜 필드가 처음부터 보인다.
  if (findField(modal, probe)) return true;

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
    await waitFor(() => findField(modal, probe));
  }

  return findField(modal, probe) !== null;
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
