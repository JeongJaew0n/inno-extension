import {
  MY_WORK_TIME,
  MY_WORK_TIME_CHECKIN_LABEL,
  MY_WORK_TIME_ENTRY,
  MY_WORK_TIME_ENTRY_LABEL,
  MY_WORK_TIME_ENTRY_VALUE,
  MY_WORK_TIME_ROW_DATE,
  MY_WORK_TIME_TODAY_BADGE,
  MY_WORK_TIME_TODAY_BADGE_TEXT,
} from '../../selectors';

export interface CheckinTime {
  hours: number;
  minutes: number;
}

/**
 * 근무시간 위젯의 출근 표시에서 시각을 읽는다.
 *
 * 오늘 행은 `08:58`처럼 단일 시각이지만, 지난 날짜 행은 `09:56(09:56)`처럼 괄호가 붙은 변형이
 * 나타난다. 앞쪽 시각을 확정 값으로 사용한다. 아직 등록되지 않은 항목은 `미등록`으로 표시된다.
 */
export function parseAttendanceTimeText(value: string | null | undefined): CheckinTime | null {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
}

/**
 * 오늘 행의 출근 시각을 근무시간 위젯에서 읽는다.
 *
 * 위젯은 오늘과 지난 날짜를 함께 보여주므로 `오늘` 배지가 붙은 행만 사용한다. 배지를 찾지
 * 못하면 지난 날짜의 시각을 잘못 복사할 수 있으므로 첫 행으로 대체하지 않는다.
 */
export function readTodayCheckinTime(document: Document): CheckinTime | null {
  const widget = document.querySelector(MY_WORK_TIME) ?? document;

  for (const dateElement of widget.querySelectorAll(MY_WORK_TIME_ROW_DATE)) {
    const badge = dateElement.querySelector(MY_WORK_TIME_TODAY_BADGE);
    if (badge?.textContent?.trim() !== MY_WORK_TIME_TODAY_BADGE_TEXT) continue;

    const row = dateElement.parentElement;
    if (!row) continue;

    for (const entry of row.querySelectorAll(MY_WORK_TIME_ENTRY)) {
      const label = entry.querySelector(MY_WORK_TIME_ENTRY_LABEL)?.textContent?.trim();
      if (label !== MY_WORK_TIME_CHECKIN_LABEL) continue;
      return parseAttendanceTimeText(
        entry.querySelector(MY_WORK_TIME_ENTRY_VALUE)?.textContent,
      );
    }
    return null;
  }

  return null;
}
