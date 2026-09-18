/**
 * 활성 스프린트 정보를 한 줄로 다듬는다. DOM 과 무관한 순수 함수라 따로 둔다.
 *
 * docs/plans/jira-board-sprint-info/spec.md
 */

import type { ActiveSprintInfo } from '../../sprintState/contract';

/**
 * Jira 가 주는 ISO 문자열의 오프셋에는 **콜론이 없다**(`+0900`).
 *
 * ES 명세의 `Date.parse` 는 `+09:00` 을 요구한다. V8 은 관대해서 그대로도 파싱되지만 명세에
 * 기대지 않고 콜론을 넣어 정규화한다.
 */
export function parseJiraIsoDate(value: string): Date | null {
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function fullDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface SprintSummary {
  /** 칩에 보일 짧은 문구. `labels[0]` 과 같다 */
  label: string;
  /**
   * 자세한 것부터 짧은 것 순서의 후보들.
   *
   * 보드 상단은 자리가 좁고 Jira 가 자기 필터도 `더 보기` 로 접는다. 넘치면 **잘라내는 대신
   * 덜 중요한 것부터 뺀다.** 마지막은 빈 문자열(아이콘만)이다.
   *
   * 무엇을 먼저 버리는가 — 목표, 그다음 기간. `남은 일수` 가 한눈에 가장 쓸모 있다.
   */
  labels: string[];
  /** hover 로 보일 전체 문구 */
  title: string;
  /** 목표가 설정돼 있는지. 없으면 기간만 보여준다 */
  hasGoal: boolean;
}

/**
 * 기간을 `9/9 ~ 9/30 · 8일 남음` 으로, 목표가 있으면 뒤에 붙여 준다.
 *
 * 날짜를 읽지 못하면 `null` 을 돌려준다. 절반만 맞는 정보를 보여주느니 아무것도 보여주지 않는다.
 */
export function summarizeSprint(sprint: ActiveSprintInfo): SprintSummary | null {
  const start = parseJiraIsoDate(sprint.isoStartDate);
  const end = parseJiraIsoDate(sprint.isoEndDate);
  if (!start || !end) return null;

  const period = `${shortDate(start)} ~ ${shortDate(end)}`;
  const remaining = typeof sprint.daysRemaining === 'number' && sprint.daysRemaining >= 0
    ? `${sprint.daysRemaining}일 남음`
    : null;

  const goal = sprint.goal.trim().replace(/\s+/g, ' ');
  const labelParts = [period];
  if (remaining) labelParts.push(remaining);
  if (goal) labelParts.push(goal);

  const titleLines = [
    sprint.name || '활성 스프린트',
    `${fullDate(start)} ~ ${fullDate(end)}${remaining ? ` (${remaining})` : ''}`,
  ];
  // 목표가 없으면 그 줄을 아예 빼지 않고 없다고 적는다. 빈 줄은 설정 안 된 것인지 못 읽은
  // 것인지 구분되지 않는다.
  titleLines.push(goal ? `목표: ${goal}` : '목표: 설정되지 않음');

  const labels = [
    labelParts.join(' · '),
    [period, remaining].filter(Boolean).join(' · '),
    remaining ?? period,
    '',
  ].filter((value, index, all) => index === 0 || value !== all[index - 1]);

  return {
    label: labels[0],
    labels,
    title: titleLines.join('\n'),
    hasGoal: Boolean(goal),
  };
}
