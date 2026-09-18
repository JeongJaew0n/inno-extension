# 지난 스프린트 보기 — 배경과 실측

## 요청

활성 스프린트 보드에서 **종료된 스프린트의 업무**도 보고 싶다. 시나리오는 셋이다.

1. 보드 화면에 스프린트 선택 셀렉트가 나온다
2. 종료된 스프린트를 고르면 API 로 그 스프린트 업무를 불러온다
3. 지금 보드의 업무를 지우고 그 업무들로 채운다

**API 를 써도 된다**는 전제를 받았다.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-18 |
| 대상 | `NPT` 보드 2145 활성 스프린트 |
| 방법 | 읽기 전용 GET · DOM 조작 실험. **보드 데이터는 바꾸지 않았다** |

## 1. API 는 된다

같은 오리진이라 브라우저 세션 쿠키가 그대로 실린다. 추가 권한도 토큰도 필요 없다.

### 스프린트 목록

`GET /rest/agile/1.0/board/{boardId}/sprint`

```
status 200 · total 3 · isLast true
state   : closed, active
필드    : id self state name startDate endDate completeDate createdDate originBoardId goal
```

종료 스프린트만 거르려면 `state=closed` 를 붙인다. 이 보드는 종료 2 · 활성 1 이었다.

### 스프린트 업무

`GET /rest/agile/1.0/sprint/{sprintId}/issue`

```
status 200 · total 112 · 한 번에 100건 (페이지네이션 필요)
issue.fields 키 134개 (그중 customfield_* 가 89개)
```

보드 카드에 필요한 필드가 모두 있다.

| 필드 | 있음 |
| --- | --- |
| `summary` `status` `assignee` `issuetype` `priority` `parent` `labels` | O |

상태 이름은 `완료` `BACKLOG` `IN-PROGRESS` `해야 할 일` 네 가지였다.

## 2. 보드 DOM 조작은 **되기는 한다**

React 가 되살릴 줄 알았는데 아니었다.

| 실험 | 결과 |
| --- | --- |
| 카드 1장 제거 | **되살아나지 않는다** |
| 우리 노드 주입 | **살아남는다** |
| 45초 이상 방치 | 그대로 |
| **업무 모달 열고 닫기** | **그대로** |

새로고침하면 원래대로 돌아온다(카드 17장, 주입 노드 0).

### 그런데 이게 좋은 소식이 아니다

React 는 **자기 가상 DOM 이 맞다고 믿는 것만 고친다.** 우리가 실제 DOM 을 바꾸면 그 순간부터
가상 DOM 과 실제 DOM 이 어긋난 채로 남는다. 되살아나지 않는 이유가 바로 그것이다.

어긋난 상태에서 그 자리가 다시 렌더되면 **무슨 일이 일어날지 정해져 있지 않다.** 엉뚱한 자리에
패치가 들어가거나 React 가 예외를 던진다. 드래그 앤 드롭·필터·스프린트 완료처럼 보드를 실제로
쓰는 동작이 전부 그 위험에 놓인다.

## 3. 보드가 쓰는 DOM 앵커

| 대상 | `data-testid` |
| --- | --- |
| 카드 | `software-board.board-container.board.card-container.card-with-icc` |
| 카드 그룹 | `software-board.board-container.board.card-group.card-group` |
| 컬럼 | `platform-board-kit.ui.column.draggable-column.styled-wrapper` |
| 스윔레인 | `platform-board-kit.ui.swimlane.swimlane-columns` |
| 필터 줄 | `software-filters.ui.list-filter-container` |

## 4. 확인하지 못한 것

- **다른 사람이 업무를 바꿨을 때** 보드가 실시간으로 갱신되는지, 그때 우리가 바꾼 DOM 이 어떻게
  되는지. 45초 방치로는 갱신이 오지 않았다
- 드래그 앤 드롭·필터 변경 중 어긋난 DOM 에서 무슨 일이 생기는지
- 스윔레인·그룹 기준이 `담당자` 가 아닐 때의 구조
- `customfield_*` 중 보드 카드에 실제로 쓰이는 것(스토리 포인트 등)이 무엇인지
