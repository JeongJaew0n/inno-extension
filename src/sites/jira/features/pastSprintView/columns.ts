/**
 * 업무를 보드 컬럼처럼 묶는다. DOM·네트워크와 무관한 순수 함수라 따로 둔다.
 *
 * 보드의 실제 컬럼 설정을 따라가지 않는다. 그건 별도 API 가 필요하고, 지난 스프린트를 훑어보는
 * 데는 **상태 이름으로 묶는 것으로 충분하다.** 컬럼 설정 연동은 다음 단계다.
 *
 * docs/plans/jira-past-sprint-view/spec.md
 */

import type { JiraBoardIssue } from '../../api/sprints';

export interface SprintColumn {
  name: string;
  issues: JiraBoardIssue[];
}

/**
 * 상태 분류의 진행 순서.
 *
 * Jira 가 상태마다 주는 `statusCategory.key` 다. 이걸로 큰 순서를 잡고, 같은 분류 안에서는
 * **업무에 처음 나타난 순서**를 지킨다. 그래야 보드와 비슷하게 왼쪽에서 오른쪽으로 읽힌다.
 */
const CATEGORY_ORDER: Record<string, number> = {
  new: 0,
  undefined: 1,
  indeterminate: 2,
  done: 3,
};

function categoryRank(category: string): number {
  return CATEGORY_ORDER[category] ?? 1;
}

export function groupIssuesByStatus(issues: readonly JiraBoardIssue[]): SprintColumn[] {
  const columns = new Map<string, { column: SprintColumn; rank: number; seen: number }>();

  issues.forEach((issue, index) => {
    // 상태 이름이 비면 묶을 기준이 없다. 따로 모아 사용자가 알아볼 수 있게 한다.
    const name = issue.statusName || '(상태 없음)';
    const existing = columns.get(name);
    if (existing) {
      existing.column.issues.push(issue);
      return;
    }
    columns.set(name, {
      column: { name, issues: [issue] },
      rank: categoryRank(issue.statusCategory),
      seen: index,
    });
  });

  return [...columns.values()]
    .sort((a, b) => (a.rank - b.rank) || (a.seen - b.seen))
    .map((entry) => entry.column);
}

/** 종료된 스프린트만, 최근에 끝난 것부터. 선택 목록에 쓴다. */
export function closedSprintsNewestFirst<T extends { state: string; endDate: string | null; id: number }>(
  sprints: readonly T[],
): T[] {
  return sprints
    .filter((sprint) => sprint.state === 'closed')
    .sort((a, b) => {
      const left = a.endDate ? Date.parse(a.endDate) : 0;
      const right = b.endDate ? Date.parse(b.endDate) : 0;
      if (left !== right) return right - left;
      return b.id - a.id;
    });
}
