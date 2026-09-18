# 보드 활성 스프린트 정보 — 배경과 실측

## 요청

활성 스프린트 보드에 스프린트 **설명(목표)** 이나 **기간**이 보이면 좋겠다. `빠른 필터` 오른쪽.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-18 |
| 대상 | `NPT` 보드 2145 활성 스프린트 |
| 방법 | 읽기 전용 DOM·전역 조회. 보드 상태를 바꾸지 않았다 |

## 1. 화면에는 없다

보드 상단 바에 스프린트 이름도 기간도 목표도 **표시되지 않는다.** 이름은 `document.title`
(`1 스프린트 - Jazz - 스크럼 보드 - Jira`)에만 있다.

`스프린트 세부 정보` 아이콘 버튼
(`software-board.header.sprint-controls.sprint-details.trigger-button.icon-button`)을 누르면
팝업이 뜨고 거기에 이름·남은 일수·시작/종료 날짜가 있다. **누르기 전에는 DOM에 없다.**

## 2. 페이지 전역에 이미 실려 있다 — `window.SPA_STATE`

**네트워크 요청 없이** 읽을 수 있는 자리를 찾았다.

```
window.SPA_STATE.UIF_BOARD['uif-board::rapidboard-board::2145'].data.result.sprints[0]
```

실측한 객체의 키와 값이다.

| 키 | 값 |
| --- | --- |
| `id` | `2177` |
| `name` | `Jazz-v1.0-Sprint1` |
| `state` | `ACTIVE` |
| **`goal`** | **`""` — 이 스프린트에는 목표가 설정돼 있지 않다** |
| `isoStartDate` | `2026-09-09T16:31:24+0900` |
| `isoEndDate` | `2026-09-30T13:00:00+0900` |
| `daysRemaining` | `8` |
| 그 외 | `sequence` `sprintVersion` `startDate` `endDate` `completeDate` `canUpdateSprint` `remoteLinks` `linkedPagesCount` |

캐시 항목에 `expiresAt` · `accessedAt` 이 있다. SPA가 만료 후 다시 채우는 구조로 보인다.

> **`goal` 이 비어 있다.** 요청의 '설명'은 지금 화면에 띄울 값이 없다. 기간은 있다.

### ISO 문자열의 오프셋 형식

`+0900` 처럼 **콜론이 없다.** ES 명세의 `Date.parse`는 `+09:00`을 요구한다. V8은 관대해서
그대로도 파싱되지만 명세에 기대지 않고 콜론을 넣어 정규화한다.

## 3. ISOLATED world 에서는 못 읽는다

`window.SPA_STATE` 는 페이지가 만든 객체라 content script 에서 보이지 않는다. Jira 에는 이미
MAIN world 진입점(`src/sites/jira/main.ts`, ProseMirror 브리지)이 있으므로 그 옆에 작은 읽기
브리지를 더한다.

## 4. 버튼 자리

```
[data-testid="software-board.header.controls-bar"]        display: flex
└ ...
  └ [data-testid="software-filters.ui.list-filter-container"]   display: flex
    └ <ul> 버전 · Epic · 유형 · 레이블 · 빠른 필터        right = 1119
                                                          ↑ 여기 뒤에 붙이면 빠른 필터 오른쪽이다
```

필터 목록 오른쪽으로 **369px** 가 비어 있었다(바 오른쪽 끝 1488). 목표 문구가 길 수 있으므로
최대 폭을 두고 말줄임한다.

## 5. 확인하지 못한 것

- **SPA 이동 시 신선도.** 보드를 새로 고치지 않고 스프린트를 완료·시작했을 때 `SPA_STATE` 가
  갱신되는지. `expiresAt` 가 있으니 갱신될 것으로 보이나 확인하지 않았다.
- **활성 스프린트가 여럿인 보드.** 이 보드는 1개뿐이다.
- 백로그 화면(`/backlog`)에도 같은 상태가 실리는지.
