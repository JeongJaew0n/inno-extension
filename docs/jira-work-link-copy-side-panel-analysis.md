# Jira 업무 링크 복사 우측 사이드 패널 분석

- 분석일: 2026-08-14
- 대상 URL: `https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147?selectedIssue=NPT-144`
- 분석 범위: Jira 보드의 선택 업무 상세가 modal 또는 우측 preview panel로 열리는 경우의 DOM과 현재 `issueLinkCopy` runtime 비교
- 상태: 분석 완료, 2026-08-14 구현 반영

## 질문

현재 업무 링크 복사 버튼이 modal에서는 표시되지만 우측 사이드 패널에서는 표시되지 않는 이유는 무엇이며, 두 화면을 함께 지원하려면 어떤 계약을 확장해야 하는가?

## 결론

문제는 URL parser, 업무 번호 selector, 제목 selector 또는 runtime observer가 아니라 **보드 상세 컨테이너를 dialog로만 제한한 target resolver**에 있다.

우측 사이드 패널도 modal과 동일한 현재 업무 번호 link와 제목 `data-testid`를 제공한다. 차이는 최상위 컨테이너가 `role="dialog"`가 아니라 다음 preview panel이라는 점이다.

```css
section[data-testid="preview-panels.preview-panel"][aria-label="Panel"]
```

현재 resolver는 보드 URL에 `selectedIssue`가 있으면 먼저 dialog를 찾고, dialog가 없으면 즉시 `null`을 반환한다. runtime은 이 결과를 지원하지 않는 화면으로 판단해 기존 버튼을 제거한다.

## Ranked synthesis

| 순위 | 설명 | 신뢰도 | 근거 |
| --- | --- | --- | --- |
| 1 | 보드 상세 scope가 dialog로 고정되어 사이드 패널을 target으로 만들지 못한다. | High | 실측 panel에는 dialog가 0개이고, 코드가 dialog 부재 시 `null`을 반환한다. |
| 2 | 업무 번호나 제목 selector가 사이드 패널과 맞지 않는다. | Low | 두 selector 모두 사이드 패널에서 modal과 같은 `data-testid`로 확인됐다. |
| 3 | SPA 전환을 runtime이 감지하지 못한다. | Low | modal → panel 전환 뒤 버튼이 제거된 것으로 보아 reconcile은 실행됐다. 공통 runtime도 subtree `MutationObserver`를 사용한다. |
| 4 | NPT 2147 또는 URL 형식이 지원되지 않는다. | Low | parser는 프로젝트·보드 ID를 제한하지 않고 기본 board path와 `selectedIssue=NPT-144`를 정상 범위로 취급한다. |

## Chrome 실측 결과

### 우측 사이드 패널

업무 상세는 accessibility tree에서 `region "Panel"`로 노출됐고 실제 최상위 DOM은 다음과 같았다.

```html
<section
  aria-label="Panel"
  data-layout-slot="true"
  data-testid="preview-panels.preview-panel"
>
```

확인된 상태:

| 항목 | 결과 |
| --- | --- |
| `[role="dialog"]` | 0개 |
| Jira issue modal selector | 0개 |
| preview panel selector | 1개 |
| 현재 업무 link | `/browse/NPT-144` |
| 현재 업무 link testid | `issue.views.issue-base.foundation.breadcrumbs.current-issue.item` |
| 제목 | `[Veritas-BE] 소산 백업 1차 기술 검토 Q&A 목록` |
| 제목 testid | `issue.views.issue-base.foundation.summary.heading` |
| Inno Extension 버튼 root | 0개 |

preview panel에는 header 전용 selector도 존재한다.

```text
platform-issue-preview-panel.preview-panel-header
platform-issue-preview-panel.preview-panel-new-tab-link
platform-issue-preview-panel.preview-panel-expand-btn
platform-issue-preview-panel.preview-panel-header.close-button
```

업무 번호와 제목은 panel 내부 Jira issue layout에 있으며, 현재 기능이 이미 사용하는 selector를 그대로 만족한다.

### Modal

동일 업무를 modal로 열었을 때 최상위 DOM은 다음 계약을 만족했다.

```html
<section
  role="dialog"
  aria-modal="true"
  data-testid="issue.views.issue-details.issue-modal.modal-dialog"
>
```

확인된 상태:

| 항목 | 결과 |
| --- | --- |
| `[role="dialog"]` | 1개 |
| Jira issue modal selector | 1개 |
| 현재 업무 link | `/browse/NPT-144` |
| 현재 업무 link testid | panel과 동일 |
| 제목 testid | panel과 동일 |
| Inno Extension 버튼 root | 1개 |
| root issue key | `NPT-144` |
| root mount kind | `board-dialog-link` |
| root 위치 | dialog 내부 |

화면에도 `업무 링크 복사`, `업무 링크 복사(제목포함)` 두 버튼이 현재 업무 번호 다음에 표시됐다.

### Modal에서 사이드 패널로 전환

Jira의 `사이드바로 전환` 버튼을 눌러 같은 업무를 panel로 바꿨다.

전환 전후의 관찰 결과:

| 상태 | Modal | Panel |
| --- | ---: | ---: |
| URL | `...?selectedIssue=NPT-144` | 동일 |
| dialog 개수 | 1 | 0 |
| preview panel 개수 | 0 | 1 |
| 현재 업무 link 위치 | dialog 내부 | panel 내부 |
| 제목 위치 | dialog 내부 | panel 내부 |
| 확장 버튼 root | 1 | 0 |

URL과 업무 정보는 그대로 유지되고 컨테이너만 교체된다. 전환 후 확장 버튼 root가 사라지는 것은 runtime이 DOM 변경을 감지한 뒤 새 target을 찾지 못해 `dispose()`를 실행한 결과와 일치한다.

## 코드 근거

### 1. 보드 target이 dialog를 필수로 요구한다

[`runtime.ts`](../src/sites/jira/features/issueLinkCopy/runtime.ts#L68-L85)는 기본 board route와 `selectedIssue`를 확인한 뒤 다음 순서로 동작한다.

1. 정확한 issue modal selector를 조회한다.
2. 없으면 임의의 `[role="dialog"]`를 조회한다.
3. dialog가 없으면 `null`을 반환한다.
4. 찾은 dialog 내부에서만 업무 번호와 제목을 조회한다.

따라서 `selectedIssue`가 유효하고 업무 상세가 화면에 존재해도 preview panel이면 기능 target이 될 수 없다.

### 2. 내부 업무 번호와 제목 selector는 이미 호환된다

[`selectors.ts`](../src/sites/jira/selectors.ts#L4-L9)의 두 selector는 Chrome 실측에서 modal과 panel 모두 일치했다.

```ts
CURRENT_ISSUE_LINK
CURRENT_ISSUE_TITLE
```

[`findIssueLink()`](../src/sites/jira/features/issueLinkCopy/runtime.ts#L29-L39)도 전달받은 scope 안에서 `selectedIssue`와 같은 업무 번호를 검증한다. 올바른 panel scope만 전달하면 부모 업무인 `NPT-29`가 아니라 현재 업무인 `NPT-144`를 선택할 수 있다.

### 3. route 변경은 필요하지 않다

[`routes.ts`](../src/sites/jira/routes.ts#L26-L44)는 다음 URL에서 프로젝트, board ID와 선택 업무를 이미 추출한다.

```text
/jira/software/c/projects/NPT/boards/2147?selectedIssue=NPT-144
```

[`isJiraBoardRoute()`](../src/sites/jira/routes.ts#L95-L97)는 기본 board path를 허용한다. 이번 문제는 route 범위가 아니라 같은 route 안의 표현 방식 차이다.

### 4. 기존 observer는 전환을 감지한다

[`createSiteRuntime.ts`](../src/platform/runtime/createSiteRuntime.ts#L42-L50)는 `document.body` 아래 child/subtree 변경을 관찰하고, [`scheduleUpdate()`](../src/platform/runtime/createSiteRuntime.ts#L100-L106)로 reconcile을 예약한다.

modal과 panel 전환은 DOM subtree를 교체하므로 새 observer를 추가할 근거는 없다. 실제로 전환 직후 기존 root가 제거됐다.

### 5. target이 없으면 host를 제거한다

[`issueLinkCopy` reconcile](../src/sites/jira/features/issueLinkCopy/runtime.ts#L203-L218)은 resolver가 `null`을 반환하면 `dispose()`로 host를 제거한다. 현재 사이드 패널에서 버튼이 보이지 않는 직접적인 실행 경로다.

## 수정 경계에 대한 분석

### 필요한 경계 확장

보드 선택 업무의 상세 scope를 다음 두 컨테이너 중 하나로 해석할 수 있어야 한다.

```text
1. issue modal
2. issue preview panel
```

선택한 scope 안에서 다음을 모두 확인해야 한다.

- `CURRENT_ISSUE_LINK` 또는 fallback link의 업무 번호가 URL의 `selectedIssue`와 같은가
- `CURRENT_ISSUE_TITLE`이 같은 scope 안에 있는가
- 버튼을 현재 업무 link 직후에 mount할 수 있는가

현재 link와 제목 selector, clipboard payload, 버튼 UI는 재사용할 수 있다.

### Container selector 우선순위

실측 근거가 있는 selector는 다음 두 개다.

```css
[role="dialog"][data-testid="issue.views.issue-details.issue-modal.modal-dialog"]
section[data-testid="preview-panels.preview-panel"]
```

현재의 전역 `[role="dialog"]` fallback은 Jira의 다른 dialog를 잘못 선택할 가능성이 있다. fallback을 유지하더라도 반드시 그 scope 안에서 `selectedIssue`와 일치하는 현재 업무 link를 찾은 경우만 사용해야 한다.

### Mount kind

현재 이름 `board-dialog-link`는 panel을 포함하지 못한다. 다음 두 방향은 모두 가능하다.

- modal과 panel을 `board-detail-link` 같은 공통 mount kind로 표현
- `board-dialog-link`, `board-panel-link`를 별도로 표현

기능 동작은 같지만 DOM 컨테이너가 교체됐을 때 새 host를 명시적으로 만들고 진단 정보를 정확히 남기려면 별도 mount kind가 더 관찰하기 쉽다. 공통 mount kind를 사용해도 이전 host가 DOM에서 제거돼 `isConnected === false`가 되므로 remount 자체는 가능하다.

### 제목 포함 복사의 클릭 시점 재조회

제목 포함 버튼은 클릭할 때 [`resolveIssueViewTarget()`](../src/sites/jira/features/issueLinkCopy/runtime.ts#L193-L197)을 다시 호출한다. panel을 resolver 범위에 포함해야 최초 mount뿐 아니라 제목 편집 후 최신 제목 재조회도 함께 동작한다.

## 검증해야 할 시나리오

| 시나리오 | 기대 결과 |
| --- | --- |
| 선택 업무가 modal로 열림 | 기존 두 버튼 유지 |
| 선택 업무가 우측 panel로 열림 | 현재 업무 번호 옆에 두 버튼 표시 |
| modal → panel 전환 | modal host 제거, panel에 한 번만 재생성 |
| panel → modal 확장 | panel host 제거, modal에 한 번만 재생성 |
| panel에서 다른 업무 선택 | 새 `selectedIssue`의 번호와 제목 사용 |
| panel 닫기 | 주입 버튼 제거 |
| panel에서 제목 편집 후 제목 포함 복사 | 클릭 시점 최신 제목 사용 |
| 부모 업무 breadcrumb가 함께 존재 | `selectedIssue`와 같은 현재 업무 link에만 mount |
| Jira 서비스 또는 기능 OFF | modal과 panel 모두 버튼 제거 |

단위 테스트는 현재 URL parser와 clipboard payload만 다룬다. modal/panel container 선택과 전환에 대한 DOM 회귀 검증이 추가로 필요하다.

## Unknowns / limits

- 다른 Jira 프로젝트, board 유형 또는 Atlassian 배포 버전에서도 `preview-panels.preview-panel`이 동일한지는 이번 한 화면만으로 확정할 수 없다.
- 좁은 panel 폭에서 두 텍스트 버튼이 breadcrumb를 넘치는지는 실제 viewport별 확인이 필요하다.
- inline 제목 편집 중 read-view heading이 제거되는 순간의 기대 동작은 별도 확인이 필요하다.
- backlog, timeline 등 하위 view는 현재 route 정책상 지원 범위가 아니며 이번 분석에 포함하지 않았다.

## 분석 판정

- 원인 확신도: **High**
- 변경 예상 범위: Jira selector와 `resolveIssueViewTarget()` 중심의 국소 변경
- route, clipboard 포맷, 권한, 네트워크 계약 변경 필요성: 확인되지 않음
- 새 MutationObserver 또는 Jira REST API 필요성: 확인되지 않음

## 구현 반영 결과

분석에서 제안한 국소 변경 범위대로 반영했다.

- preview panel selector 계약을 추가했다.
- board target 탐색이 정확한 issue modal, preview panel, 검증된 dialog fallback 순으로 후보를 확인한다.
- 모든 후보는 내부 업무 링크가 URL의 `selectedIssue`와 일치할 때만 선택한다.
- panel mount는 `board-panel-link`, modal mount는 `board-dialog-link`로 구분한다.
- 제목 포함 복사의 클릭 시점 target 재조회는 같은 resolver를 사용하므로 panel의 현재 제목도 읽는다.
- modal 우선, panel fallback, 부모 업무 링크 오선택 방지 회귀 테스트를 추가했다.
