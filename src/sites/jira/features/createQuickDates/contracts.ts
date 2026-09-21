/**
 * 날짜 단축의 순수 로직.
 *
 * DOM 과 무관한 계산만 모아 테스트한다. 달력 조작은 `runtime.ts` 가 한다.
 *
 * docs/plans/jira-create-helpers/spec.md
 */

/** `기한`을 `시작 날짜`에서 며칠 뒤로 둘지. 사용자가 정한 값이다 */
export const DEFAULT_DUE_OFFSET_DAYS = 3;

export interface CalendarDate {
  year: number;
  /** 1-12. `Date` 의 0-11 이 아니다 — 화면에 보이는 숫자와 맞춘다 */
  month: number;
  day: number;
}

export function toCalendarDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/**
 * 며칠 뒤를 구한다.
 *
 * **달과 연을 넘는 계산은 `Date` 에 맡긴다.** 직접 더하면 말일·윤년에서 틀린다.
 * `Date` 는 범위를 벗어난 일자를 스스로 넘긴다 — `9월 32일`은 `10월 2일`이 된다.
 */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(date.year, date.month - 1, date.day + days);
  return toCalendarDate(shifted);
}

/**
 * 달력 셀의 `aria-label` 과 맞춰볼 정규식을 만든다.
 *
 * 실제 라벨은 이렇게 생겼다.
 *
 * ```
 * 24, 목요일 9월 2026
 * ^일 ^요일   ^월  ^연
 * ```
 *
 * **요일은 맞추지 않는다.** 요일 이름은 Jira 언어 설정에 따라 바뀌고, 일·월·연 셋이면
 * 한 달 안에서 셀이 하나로 정해진다.
 *
 * 앞뒤 달의 날짜도 같은 격자에 섞여 나온다(8월 30·31일이 9월 격자에 보인다). 그래서 월과
 * 연까지 확인해야 엉뚱한 셀을 누르지 않는다.
 */
export function calendarCellPattern(date: CalendarDate): RegExp {
  return new RegExp(`^${date.day},\\s.*${date.month}월\\s${date.year}$`);
}

/** 두 날짜가 같은 달인지. 달력을 옮겨야 하는지 판단한다 */
export function isSameMonth(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * `a` 에서 `b` 까지 달을 몇 번 옮겨야 하는지.
 *
 * 양수면 다음 달 쪽, 음수면 이전 달 쪽이다.
 */
export function monthDistance(from: CalendarDate, to: CalendarDate): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/**
 * 화면에 보이는 달을 읽는다.
 *
 * 달력 머리말에는 달 이동 버튼이 있고 그 라벨에 달이 들어 있다 — `Next month, 10월 2026`.
 * 머리말 자체에는 안정적인 표식이 없어서 이 버튼을 읽는다.
 */
export function parseVisibleMonth(nextMonthLabel: string): CalendarDate | null {
  const match = nextMonthLabel.match(/(\d{1,2})월\s(\d{4})/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  // `Next month` 라벨은 **다음 달**을 가리킨다. 보이는 달은 그 한 달 전이다.
  return addMonths({ year, month, day: 1 }, -1);
}

export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const shifted = new Date(date.year, date.month - 1 + months, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1, day: date.day };
}

export interface QuickDatePlan {
  start: CalendarDate;
  due: CalendarDate;
}

/** 오늘을 기준으로 넣을 두 날짜를 정한다 */
export function planFromToday(today: Date, dueOffsetDays = DEFAULT_DUE_OFFSET_DAYS): QuickDatePlan {
  const start = toCalendarDate(today);
  return { start, due: addDays(start, dueOffsetDays) };
}
