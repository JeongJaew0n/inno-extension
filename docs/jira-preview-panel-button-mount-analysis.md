# Jira preview panel 업무 링크 복사 버튼 오배치 분석

- 작성일: 2026-08-24
- 분석 대상: Inno Extension `v0.3.0` + backlog route 지원 변경이 적용된 로컬 빌드
- 신고 현상: Jira 보드와 백로그에서 사이드 패널로 열린 업무에 `업무 링크 복사` 버튼이 보이지 않는다
- 분석 방법: Claude in Chrome으로 로그인된 실제 세션에서 DOM 조회, 위치·크기 측정, 강제 재마운트 실험
- 신고 URL
  - `https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146?selectedIssue=NPT-143`
  - `https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146/backlog`

## 1. 결론

버튼은 주입되고 있다. 미노출이 아니라 **오배치**다.

기대 위치는 업무 번호 breadcrumb(`NPT-143`) 옆이지만, 실제로는 preview panel **헤더**의 `Open in new tab` 링크 옆에 붙는다. 그 결과 두 가지가 동시에 일어난다.

1. 버튼이 Jira 자체 헤더 아이콘(눈 모양 watcher, 공유, 더보기, 확장, 닫기) 사이에 섞여 사용자가 기능 버튼으로 인지하지 못한다.
2. 221px짜리 버튼 묶음이 399px 헤더의 가용 폭을 잡아먹어 Jira의 헤더 breadcrumb이 `J.` 또는 `J..`로 잘린다.

원인은 단일 결함이 아니라 다음 두 가지의 조합이다.

| # | 원인 | 성격 |
| --- | --- | --- |
| A | 최초 reconcile 시점에 업무 번호 breadcrumb이 아직 없어 `findIssueLink()`의 fallback이 헤더의 `/browse/` 앵커를 선택한다 | 렌더 순서 race |
| B | `reconcile()`의 멱등성 판정이 `issueKey`와 `mountKind`만 비교하므로, 이후 올바른 breadcrumb이 나타나도 재마운트하지 않는다 | 멱등성 키 해상도 부족 |

A만으로는 일시적 오배치에 그친다. B가 그 오배치를 **영구히 고정**시킨다.

## 2. 실측 환경

| 항목 | 값 |
| --- | --- |
| 확장 빌드 | backlog route 변경 반영됨 (백로그에서 root 1개 주입 확인) |
| 창 크기 | 1512 폭과 1100 폭 두 조건 |
| preview panel 폭 | 두 조건 모두 400px 고정 |
| Jira modal (`ISSUE_DIALOG`) | 모든 화면에서 0개 |

preview panel 폭이 창 너비와 무관하게 400px로 고정된다는 점이 중요하다. 창을 좁혀도 버튼이 잘려 사라지지는 않는다. 즉 이번 현상은 반응형 클리핑이 아니다.

## 3. 화면별 실측 결과

### 3.1 보드 기본 화면 (`?selectedIssue=NPT-143`)

| 항목 | 값 |
| --- | --- |
| 주입된 root 수 | 1 |
| `mountKind` | `board-panel-link` |
| `issueKey` | `NPT-143` |
| 직전 형제 요소 | `platform-issue-preview-panel.preview-panel-new-tab-link` |
| host 위치 | `x=1221, y=64, w=221` |
| 업무 번호 breadcrumb 위치 | `y=128` |
| panel 폭 | 400 |
| header `clientWidth / scrollWidth` | `399 / 405` (6px 초과) |
| header 텍스트 | `Jira 업무 항목Open in new tab, (opens new window)ExpandClose` |

host의 `y=64`와 breadcrumb의 `y=128`이 서로 다른 행이다. 버튼이 업무 번호 옆이 아니라 그 위 헤더 행에 있다는 직접 증거다.

부모 체인은 다음과 같았다.

```text
div
div
div[platform-issue-preview-panel.preview-panel-header]
div
div
section[preview-panels.preview-panel]
div[page-layout.root]
```

`preview-panel-header` 안에 들어가 있음이 확인된다.

### 3.2 백로그 (`/backlog?selectedIssue=NPT-143`)

| 항목 | 값 |
| --- | --- |
| 주입된 root 수 | 1 |
| `mountKind` | `board-panel-link` |
| 직전 형제 요소 | `platform-issue-preview-panel.preview-panel-new-tab-link` |
| host 위치 | `x=1227, y=64, w=221` |
| header `clientWidth / scrollWidth` | `399 / 399` (초과 없음) |
| header 텍스트 | `Jira 업무 항목Open in new tab, (opens new window)Close` |

백로그에서도 root가 주입된다. backlog route 지원 변경이 실제로 동작함을 확인한 것이다. 동시에 오배치 현상은 보드 기본 화면과 완전히 동일하게 재현된다.

보드 기본 화면과의 차이는 헤더에 `Expand` 버튼이 하나 더 있는지 여부뿐이다. 그 하나 때문에 보드 기본 화면만 6px 초과가 발생한다. 헤더가 이미 여유 폭을 전부 소진한 상태라는 뜻이다.

### 3.3 직접 업무 조회 화면 (대조군, `/browse/NPT-143`)

| 항목 | 값 |
| --- | --- |
| 주입된 root 수 | 1 |
| `mountKind` | `direct-link` |
| 직전 형제 요소 | `issue.views.issue-base.foundation.breadcrumbs.current-issue.item` |
| host 위치 | `y=94` |
| panel 개수 | 0 |
| modal 개수 | 0 |

직접 조회 화면은 **정상적으로 breadcrumb 옆에 붙는다**. 이 화면에는 경쟁하는 헤더 `/browse/` 앵커가 없기 때문이다. 오배치가 preview panel 고유 문제임을 보여주는 대조군이다.

### 3.4 modal 경로 소멸

세 화면 모두 다음 값이 0이었다.

- `[role="dialog"][data-testid="issue.views.issue-details.issue-modal.modal-dialog"]` → 0
- `[role="dialog"]` 전체 → 0

현재 Jira는 보드에서 업무를 선택할 때 modal이 아니라 preview panel을 사용한다. 코드의 `board-dialog-link` 경로와 `[role="dialog"]` fallback은 이번 실측 범위에서 한 번도 사용되지 않았다.

## 4. 강제 재마운트 실험 (결정적 증거)

보드 기본 화면에서 기존 host를 제거하고 공통 런타임이 다시 마운트하도록 두었다.

| 시점 | 직전 형제 요소 | `y` | `mountKind` |
| --- | --- | --- | --- |
| 최초 마운트 | `platform-issue-preview-panel.preview-panel-new-tab-link` | 64 | `board-panel-link` |
| host 제거 후 재마운트 | `issue.views.issue-base.foundation.breadcrumbs.current-issue.item` | 128 | `board-panel-link` |

같은 페이지, 같은 DOM인데 재마운트하면 **올바른 위치를 고른다**. 즉 DOM은 이미 정답을 제공할 수 있는 상태이고, 기존 host가 갱신되지 않아 잘못된 위치에 머물러 있을 뿐이다.

재마운트 직후 스크린샷에서는 헤더 breadcrumb이 `J.`에서 `Jira 업무 항목`으로 복원됐다. 헤더 압박도 버튼 위치의 결과임이 확인된다.

보조 관찰로, 50ms 간격 80프레임(약 4초) 폴링 동안 상태 전이가 **0회**였다.

```json
[
  { "t": 0, "crumbPresent": true, "crumbKey": "NPT-166",
    "hostKey": "NPT-166", "mountedAfter": "HDR:new-tab-link" }
]
```

`crumbPresent: true`인데도 `mountedAfter`가 헤더 링크에 고정돼 있다. 올바른 target이 존재하는 상태에서 스스로 교정하지 않는다는 뜻이다.

## 5. 코드 근거

### 5.1 앵커 선택

`src/sites/jira/features/issueLinkCopy/runtime.ts`의 `findIssueLink()`는 다음 순서로 동작한다.

1. `scope.querySelector(CURRENT_ISSUE_LINK)`가 있고 업무 번호가 일치하면 그것을 사용한다.
2. 아니면 `scope.querySelectorAll('a[href]')`를 DOM 순서로 훑어 업무 번호가 일치하는 첫 앵커를 사용한다.

실측에서 panel 안의 `a[href]`는 10개였고, 그중 헤더에 있는 `/browse/NPT-143` 앵커는 `preview-panel-new-tab-link` 하나였다. 이 앵커가 breadcrumb보다 DOM 순서상 앞이다.

포함 관계 확인 결과는 다음과 같았다.

| 확인 | 값 |
| --- | --- |
| panel이 breadcrumb을 포함 | `true` |
| header가 breadcrumb을 포함 | `false` |
| panel에서 `CURRENT_ISSUE_LINK` 조회 성공 | `true` |

따라서 breadcrumb이 렌더된 뒤라면 1번 분기가 이겨야 한다. 실제 마운트가 2번 결과인 것은, 최초 reconcile이 **breadcrumb 렌더 이전**에 실행됐음을 의미한다.

### 5.2 재마운트 차단

같은 파일 `reconcile()`의 조건은 다음과 같았다. 아래는 수정 전 코드다.

```ts
if (host?.isConnected
  && host.dataset.issueKey === target.issueKey
  && host.dataset.mountKind === target.mountKind) return;
```

헤더 앵커에 붙었을 때와 breadcrumb에 붙었을 때 `issueKey`와 `mountKind`가 모두 동일하다. 두 경우 다 `board-panel-link`다. 그래서 이 조건은 오배치를 감지하지 못하고 항상 early return한다.

### 5.3 이번 runtime 변경과의 관계

같은 날 적용한 `maxWait`와 route 변경 시 즉시 reconcile은 이 문제를 **해결하지 못한다**. reconcile 자체는 정상적으로 반복 실행되고 있고, 막히는 지점은 reconcile 횟수가 아니라 5.2의 멱등성 판정이다. 실제로 4초 폴링 동안 reconcile 기회는 충분히 있었지만 위치는 바뀌지 않았다.

## 6. 헤더 압박 측정

| 화면 | 창 폭 | panel 폭 | header client | header scroll | 초과 | breadcrumb 표시 |
| --- | --- | --- | --- | --- | --- | --- |
| 보드 기본 | 1512 | 400 | 399 | 405 | 6px | `J.` |
| 보드 기본 | 1100 | 400 | 399 | 405 | 6px | `J.` |
| 백로그 | 1512 | 400 | 399 | 399 | 0px | `J..` |

버튼 묶음은 221px이다. 헤더 가용 폭 399px의 55%를 차지한다. 두 화면 모두 Jira의 breadcrumb이 두세 글자로 잘렸고, 헤더에 요소가 하나 더 있는 보드 기본 화면은 총 콘텐츠가 컨테이너를 6px 넘어간다.

host 자체는 두 조건 모두 화면 안에 있었다(`getClientRects().length === 1`, 우측 끝이 헤더 우측 끝보다 64~70px 안쪽). 즉 **이번 실측에서 버튼이 완전히 잘려 사라지는 상태는 재현되지 않았다**.

## 7. 원인 판정

| 항목 | 판정 |
| --- | --- |
| 버튼이 아예 주입되지 않는다 | **아니다.** 세 화면 모두 root 1개 주입 확인 |
| backlog route가 막혀 있다 | **아니다.** 변경 반영 후 백로그도 주입됨 |
| selector가 깨졌다 | **아니다.** `panel`, `currentIssueLink`, `summaryHeading` 모두 1개씩 매칭 |
| 버튼이 기대 위치에 붙지 않는다 | **그렇다.** 헤더의 new-tab 링크 옆에 고정 |
| 오배치가 스스로 교정되지 않는다 | **그렇다.** 멱등성 키가 위치를 구분하지 못함 |
| 창 폭 때문에 잘려서 안 보인다 | **재현되지 않음.** panel 폭 400px 고정 |

신고된 "버튼이 뜨질 않는다"는, 사용자가 업무 번호 옆을 봤을 때 아무것도 없고 버튼은 Jira 헤더 아이콘 사이에 섞여 있었던 상황으로 설명된다.

## 8. 해결 방향 후보

분석 시점에 검토한 후보다. 실제 채택 결과는 8.1에 있다.

| 후보 | 내용 | 평가 |
| --- | --- | --- |
| A | `mountKind`를 앵커 종류까지 구분하도록 세분화(`board-panel-crumb` / `board-panel-header`)해 멱등성 판정이 오배치를 감지하게 한다 | 변경 작음. 자동 교정됨. 유력 |
| B | `findIssueLink()`의 fallback에서 헤더 컨테이너나 `preview-panel-new-tab-link`를 제외한다 | 근본적. 다만 헤더만 있는 화면에서는 마운트 지점을 잃음 |
| C | `target`에 선택된 앵커 참조를 담아 현재 host의 앵커와 다르면 재마운트한다 | 가장 정확. `IssueViewTarget` 계약 변경 필요 |
| D | breadcrumb이 없으면 마운트를 보류한다 | 단순하지만 breadcrumb이 끝까지 없는 화면에서 기능이 사라짐 |

A와 C는 조합 가능하다. A는 최소 변경으로 증상을 없애고, C는 원인을 정면으로 해결한다.

`mountKind`는 이미 spec과 자동화 테스트가 참조하는 관측 계약이다. A처럼 값을 바꾸면 그 계약이 함께 깨지므로, 값 변경 대신 별도 속성을 추가하는 쪽이 안전하다.

버튼 폭 221px이 399px 헤더를 압박하는 문제는 위치를 breadcrumb으로 되돌리면 함께 사라진다. 별도 대응은 필요하지 않다.

## 8.1 적용 내용 (2026-08-24)

후보 C를 정정 로직으로 채택했다. 후보 A는 `mountKind` 값을 바꾸는 대신 진단용 속성 추가로 대체했다.

| 변경 | 내용 |
| --- | --- |
| `IssueLinkKind` 도입 | `findIssueLink()`가 breadcrumb(`current-issue-link`)과 일반 앵커(`issue-anchor`) 중 무엇을 골랐는지 함께 보고한다 |
| `IssueViewTarget.isMountedAt()` | 이번에 결정된 기준 요소에 host가 실제로 붙어 있는지 판정한다 |
| `isIssueHostCurrent()` | 멱등성 판정을 순수 함수로 분리했다. 업무 번호, `mountKind`에 **기준 요소 동일성**을 추가로 비교한다 |
| `data-mount-anchor` | host에 앵커 종류를 남겨 DOM만 봐도 어디에 붙었는지 확인할 수 있다 |
| `BoardIssueScope.issueLinkKind` | 보드 scope 탐색 결과에 앵커 종류를 포함한다 |

기준 요소 동일성까지 비교하므로, 헤더 앵커에 붙은 host는 breadcrumb이 렌더된 다음 reconcile에서 자동으로 올바른 위치로 옮겨진다. React가 앵커 노드를 교체한 경우도 같은 경로로 교정된다.

후보 B(헤더 앵커를 fallback에서 제외)는 채택하지 않았다. breadcrumb이 끝까지 나타나지 않는 화면에서 마운트 지점을 완전히 잃기 때문이다. C가 적용된 뒤에는 헤더 마운트가 일시적 상태로만 남는다.

후보 D(breadcrumb 없으면 보류)도 같은 이유로 채택하지 않았다.

### 회귀 테스트

`tests/unit.test.ts`에 5건을 추가했다. 핵심은 다음 케이스다.

```text
host      : board-panel-link, NPT-143, 기준 요소 = 헤더 anchor
새 target : board-panel-link, NPT-143, 기준 요소 = breadcrumb anchor
기대       : isIssueHostCurrent() === false (재마운트)
```

수정 전 판정 로직은 이 입력에서 `true`를 반환해 오배치를 고정시켰다. 자동화 테스트 45건 통과.

### 남은 한계

버튼이 헤더에 먼저 붙고 breadcrumb 렌더 후 옮겨가는 짧은 이동은 여전히 발생한다. 이를 없애려면 후보 B나 D가 필요하고, 그 대가로 마운트 지점을 잃는 화면이 생긴다.

## 9. 검증 공백

- 최초 마운트 순간의 렌더 순서를 직접 포착하지 못했다. 폴링을 걸었을 때 이미 마운트가 끝난 상태였다. 원인 A는 강제 재마운트 결과와 코드 경로로부터의 역추론이며 타임라인 직접 관측은 아니다.
- 보드에서 다른 카드를 클릭해 업무를 전환할 때(이 경우 `issueKey`가 달라져 재마운트가 일어난다) 어느 앵커를 고르는지는 확인하지 못했다. 클릭이 `selectedIssue`를 바꾸지 못해 실험이 성립하지 않았다.
- 버튼이 완전히 잘려 사라지는 조건을 재현하지 못했다. preview panel 폭을 직접 좁히는 실험은 사용자 설정을 변경하므로 수행하지 않았다.
- `board-dialog-link` 경로와 `[role="dialog"]` fallback은 modal이 나타나지 않아 검증하지 못했다.

## 10. 관련 코드와 문서

- `src/sites/jira/features/issueLinkCopy/runtime.ts` — `findIssueLink()`, `findBoardIssueScope()`, `resolveIssueViewTarget()`, `reconcile()`
- `src/sites/jira/selectors.ts` — `ISSUE_PREVIEW_PANEL`, `CURRENT_ISSUE_LINK`, `ISSUE_DIALOG`
- `src/sites/jira/routes.ts` — `isJiraBoardRoute()`
- `src/platform/runtime/createSiteRuntime.ts` — reconcile 스케줄링
- `spec/features/jira-work-link-copy.md` — 버튼 위치 계약
- `docs/extension-ui-visibility-recovery-analysis.md` — 선행 미노출 분석
- `docs/jira-work-link-copy-side-panel-analysis.md` — preview panel 지원 도입 분석

## 11. 실측에 사용한 selector

```text
section[data-testid="preview-panels.preview-panel"]
[data-testid="platform-issue-preview-panel.preview-panel-header"]
[data-testid="platform-issue-preview-panel.preview-panel-new-tab-link"]
[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"][href^="/browse/"]
[data-testid="issue.views.issue-base.foundation.summary.heading"]
[role="dialog"][data-testid="issue.views.issue-details.issue-modal.modal-dialog"]
[data-inno-extension-feature]
```

`platform-issue-preview-panel.preview-panel-header`와 `platform-issue-preview-panel.preview-panel-new-tab-link`는 현재 코드가 사용하지 않는 selector다. 오배치 대응에 필요하면 `src/sites/jira/selectors.ts`에 추가해야 한다.
