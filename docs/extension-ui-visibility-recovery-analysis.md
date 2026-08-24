# Extension UI 미노출 원인과 복구 가능성 분석

- 작성일: 2026-08-20
- 분석 대상: Inno Extension `v0.3.0`
- 분석 범위: 아마란스, Jira, Confluence에 주입되는 Extension UI가 특정 상황에서 보이지 않는 현상
- 분석 방법: 로그인된 Chrome의 기존 탭과 새로 연 동일 유형 탭 비교, DOM·콘솔 로그 확인, manifest·공통 런타임·기능별 route 계약 대조

## 1. 결론

UI 미노출 현상은 하나의 결함이 아니라 다음 범주로 나뉜다.

| 범주 | 코드 해결 가능성 | 현재 권장 판단 |
| --- | --- | --- |
| Jira `backlog` 등 의도적으로 제외된 route | 완전 해결 가능 | 제품 지원 범위로 결정하면 코드 수정 대상 |
| 확장 재로드·업데이트로 기존 content script context 무효화 | 기존 script 자체 복구는 불가능, 별도 background 재주입은 부분 가능 | 현재는 대상 탭 새로고침 유지가 합리적 |
| SPA가 manifest 미매칭 URL에서 지원 URL로 이동 | 해결 가능 | 실제 재현 시 manifest 범위 확대 또는 동적 주입 검토 |
| 필수 DOM이 늦게 나타나거나 자주 교체됨 | 해결 가능 | 공통 런타임 재탐색을 보강할 수 있음 |
| 권한 오류·접근 불가로 원래 편집기/본문이 없음 | 해결 불가 | UI를 표시하지 않는 현재 동작이 정상 |
| 서비스 또는 기능 설정이 OFF | 기술 오류가 아님 | 설정 상태 안내만 개선 가능 |

가장 명확하게 확인된 코드 수정 대상은 Jira `backlog`의 선택 업무 UI다. 반면 Extension을 다시 로드한 뒤 이미 열려 있던 탭은 Chrome 확장 생명주기상 새로고침이 기본 복구 수단이다.

## 2. Chrome 실측 결과

### 2.1 Jira 직접 업무 화면

새 탭에서 다음 URL을 열어 확인했다.

```text
https://pms-innogrid.atlassian.net/browse/NPT-154
```

확인 결과는 다음과 같다.

| 항목 | 결과 |
| --- | --- |
| 현재 업무 breadcrumb link | 1개 |
| 현재 업무 title | 1개 |
| Extension root | 1개 |
| root feature | `jira-issue-link-copy` |
| mount kind | `direct-link` |

이는 Extension 전체 또는 Jira content script가 항상 실패하는 상태는 아니라는 직접 증거다. 현재 지원 route와 필수 DOM이 준비된 새 페이지에서는 UI가 정상 주입된다.

### 2.2 Jira backlog 선택 업무

새 탭에서 다음 URL을 열어 확인했다.

```text
https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146/backlog?selectedIssue=NPT-167
```

확인 결과는 다음과 같다.

| 항목 | 결과 |
| --- | --- |
| 우측 preview panel | 존재 |
| `NPT-167` 업무 link | 존재 |
| 업무 title | 존재 |
| Extension root | 0개 |

Extension이 사용할 수 있는 DOM은 모두 준비됐지만 route 판별에서 제외되어 UI가 생성되지 않는다. 새 탭에서도 동일하므로 페이지 새로고침으로 해결되지 않는다.

코드 근거:

- `src/sites/jira/routes.ts`의 `parseJiraBoardUrl()`은 보드 ID 뒤의 경로를 `viewPath`로 저장한다.
- 같은 파일의 `isJiraBoardRoute()`는 `viewPath === ''`만 허용한다.
- 따라서 `/backlog`, `/timeline`, `/calendar` 같은 하위 view는 모두 거부된다.
- `src/sites/jira/features/issueLinkCopy/runtime.ts`는 route가 거부되면 preview panel 탐색 전에 `null`을 반환한다.
- `tests/unit.test.ts`에도 `/backlog`를 지원하지 않는 현재 계약이 명시돼 있다.
- `spec/features/jira-work-link-copy.md`도 backlog 등 하위 view를 현재 범위에서 제외한다.

판정: **완전한 코드 해결 가능**.

`findBoardIssueScope()`는 이미 modal과 preview panel을 모두 지원하므로, backlog를 허용 route에 포함하면 공통 로직을 재사용할 수 있다. 다만 모든 하위 view를 한 번에 허용할지, 실측된 backlog만 허용할지는 제품 범위 결정이 필요하다.

### 2.3 기존 Confluence 조회 탭의 context 무효화

기존에 열려 있던 Confluence 문서 탭에서 확인한 상태는 다음과 같다.

| 항목 | 결과 |
| --- | --- |
| 본문 DOM | 존재 |
| header DOM | 존재 |
| Confluence 기본 `링크 복사` 버튼 | 존재 |
| 과거 Extension root | 존재, `placement=body` |
| `Extension context invalidated` 오류 | 최근 로그 25건 |

대표 오류:

```text
Error: Extension context invalidated.
at chrome-extension://.../assets/repository-LasaJ8-W.js
at chrome-extension://.../assets/writePlainText-BSWws89T.js
```

로그에 표시된 asset 이름은 현재 `dist/assets`의 asset과 일치한다.

이 상태에서는 페이지에 과거 Extension DOM이 남아 있어도 해당 content script가 더 이상 `chrome.storage`, `chrome.runtime` 같은 Extension API를 사용할 수 없다. 페이지의 React DOM이 과거 root를 제거하면 기존 script는 이를 정상적으로 다시 만들 수 없다.

현재 공통 런타임도 매 reconcile마다 `getSettings()`를 통해 `chrome.storage.sync`를 읽으므로 context가 무효화된 뒤에는 정상 reconcile을 계속할 수 없다.

관련 코드:

- `src/platform/runtime/createSiteRuntime.ts`
- `src/platform/settings/repository.ts`
- 각 사이트의 `content.ts` 진입점

판정: **기존 content script 자체의 완전 복구는 불가능**.

### 2.4 Confluence 편집 권한 오류 화면

열려 있던 `edit-v2` URL 하나는 실제 편집기가 아니라 다음 상태였다.

```text
소유자에게 액세스 권한 요청
이 페이지를 표시할 수 없습니다.
```

실제 DOM에서도 `editor-primary-toolbar`와 `ProseMirror` 편집 본문이 모두 없었다. `editorMarkdownToAdf` 기능은 두 요소 중 하나라도 없으면 UI를 제거하도록 구현돼 있다.

판정: **Extension 코드로 해결할 대상이 아님**.

편집 권한과 실제 편집기가 없는 화면에 변환 UI만 표시해도 기능은 수행할 수 없다.

### 2.5 아마란스 기존 탭

기존 아마란스 탭에서는 다음 요소가 확인됐다.

| 항목 | 결과 |
| --- | --- |
| `.noti-details` 삽입 anchor | 1개 |
| 원본 출근 요소 | 1개 |
| 원본 퇴근 요소 | 1개 |
| Extension root | 0개 |

DOM만 보면 출퇴근 UI를 주입할 조건은 준비돼 있다. 하지만 Chrome 보안 정책상 Extension 내부 설정 저장소를 직접 읽을 수 없어 다음 두 경우를 현재 증거만으로 완전히 구분하지 못했다.

1. 아마란스 서비스 또는 `attendanceHeader` 기능이 설정에서 OFF인 경우
2. 기존 탭의 content script가 재로드 이후 동작하지 않는 경우

따라서 아마란스 실측 결과는 UI 미노출 자체의 직접 증거지만, 단일 원인 확정 증거로는 사용하지 않는다.

## 3. 원인별 해결 가능성

### 3.1 확장 재로드 이후 기존 탭

#### 현재 방식

`manifest.json`은 정적 `content_scripts`만 사용한다. 정적 content script는 URL이 match pattern에 맞는 문서가 로드될 때 Chrome이 주입한다.

Extension을 업데이트하거나 unpacked Extension을 다시 로드하면 기존 Extension context는 무효화될 수 있다. 무효화된 script는 새 Extension context를 획득하거나 자기 자신을 다시 주입할 수 없다.

현재 README가 안내하는 다음 순서는 이 구조와 일치한다.

1. Extension 새로고침
2. 이미 열려 있던 대상 사이트 탭 새로고침

#### 코드로 가능한 부분 자동복구

다음 구조를 추가하면 업데이트 시 열린 탭에 새 content script를 재주입하는 것은 기술적으로 가능하다.

1. MV3 background service worker 등록
2. `chrome.runtime.onInstalled`의 `update` 이벤트 처리
3. 지원 origin의 열린 탭 탐색
4. `chrome.scripting.executeScript()`로 최신 content script 주입

Chrome 공식 문서에 따르면 unpacked Extension 재로드도 `onInstalled`의 `update`로 처리된다.

하지만 현재 manifest에 없는 다음 권한과 구조가 필요하다.

- `background.service_worker`
- `permissions: ["scripting"]`
- 대상 사이트 `host_permissions` 또는 제한적인 `activeTab`
- 중복 주입을 방지할 런타임 전역 marker
- 일부 탭 주입 실패와 discarded tab 처리

현재 manifest는 의도적으로 `background`, `scripting`, `host_permissions`를 사용하지 않는다. 자동복구를 넣으면 권한 범위와 생명주기 복잡도가 커진다.

판정: **기술적으로 부분 해결 가능하지만 현재 제품 규모에서는 탭 새로고침 유지가 더 단순하고 예측 가능함**.

완전히 자동화해도 Chrome 내부 페이지, 권한 없는 페이지, 로딩·종료 중인 탭까지 항상 복구되는 것은 아니다.

### 3.2 manifest 미매칭 URL에서 SPA 이동

Jira content script의 match 범위는 다음 경로로 제한돼 있다.

```text
/jira/*
/browse/*
/issues/*
```

Confluence는 `/wiki/*`, 아마란스는 origin 전체를 사용한다.

처음 문서가 Jira match 범위 밖에서 로드된 뒤 Atlassian SPA가 전체 reload 없이 `/browse/...` 또는 `/jira/...`로 이동하면 정적 content script가 존재하지 않을 수 있다. `hashchange`, `popstate`, `MutationObserver`는 이미 실행 중인 content script만 사용할 수 있으므로 이 경우를 복구하지 못한다.

가능한 코드 대응:

- Atlassian match를 `https://pms-innogrid.atlassian.net/*`로 넓히고 기능 내부 route 판별로 제한
- background service worker에서 동적 content script 등록 또는 programmatic injection

판정: **코드 해결 가능**.

다만 이 상황은 이번 Chrome 실측에서 직접 재현하지 않았으므로 잠재 원인으로 분류한다. origin 전체 match는 불필요한 Atlassian 화면에도 script를 실행하는 트레이드오프가 있다.

### 3.3 DOM 재렌더와 debounce 지연

공통 런타임의 `scheduleUpdate()`는 DOM mutation이 발생할 때마다 기존 timer를 취소하고 새 timer를 만든다.

```text
mutation 발생
→ 기존 timer 취소
→ 120ms 또는 180ms 뒤 reconcile 예약
```

mutation이 debounce 시간보다 짧은 간격으로 계속 발생하면 reconcile이 페이지가 조용해질 때까지 밀릴 수 있다. 이 경우 지원 화면인데도 UI가 늦게 나타나거나 장시간 나타나지 않을 가능성이 있다.

가능한 코드 대응:

- debounce에 `maxWait` 추가
- trailing debounce 대신 일정 주기의 throttle 사용
- route 변경 시 debounce를 거치지 않는 즉시 reconcile
- 저빈도 안전망 rescan 추가

판정: **코드 해결 가능**.

단, 이번 Chrome 실측에서 continuous mutation으로 인한 starvation을 직접 확인한 것은 아니므로 우선순위는 backlog route와 context invalidation보다 낮다.

### 3.4 외부 DOM selector 변경

각 기능은 Jira `data-testid`, Confluence `data-testid`, 아마란스 class·ID에 의존한다. 외부 서비스가 이를 변경하면 target을 찾지 못해 UI를 제거한다.

판정: **변경된 DOM을 실측한 뒤 selector와 fallback을 수정하면 해결 가능**.

다만 존재하지 않는 요소에 무조건 UI를 붙이는 범용 fallback은 잘못된 업무나 다른 화면에 버튼을 표시할 수 있으므로 적절하지 않다.

### 3.5 권한 오류와 실제 기능 화면 부재

Confluence 권한 오류처럼 편집기 자체가 없거나 Jira 업무 상세가 열리지 않은 경우에는 UI가 수행할 대상이 없다.

판정: **해결 불가이며 해결할 필요도 없음**.

가능한 개선은 기능 버튼 주입이 아니라 Popup의 상태 설명 또는 지원 화면 안내 정도다.

## 4. 권장 운영·개선 경계

### 새로고침으로 유지할 범위

- Extension 설치, 업데이트, unpacked reload 직후 이미 열려 있던 대상 사이트 탭
- 콘솔에 `Extension context invalidated`가 확인된 탭
- 배포 직후 최신 content script 반영 여부를 확인하는 E2E

### 코드 수정 대상으로 볼 범위

- Jira backlog에서 선택 업무 preview panel이 존재하지만 버튼이 나오지 않는 현상
- 지원 URL인데 초기 진입 경로에 따라 content script가 주입되지 않는 재현 사례
- 새로고침 후에도 필수 DOM이 존재하는데 UI가 간헐적으로 누락되는 사례
- 외부 서비스 DOM 변경으로 기존 selector가 더 이상 맞지 않는 사례

### 코드 수정 대상으로 보지 않을 범위

- 서비스 또는 개별 기능이 설정에서 OFF인 상태
- 접근 권한이 없어 본문·편집기·업무 상세가 존재하지 않는 화면
- `selectedIssue`가 없고 실제 업무 상세도 열리지 않은 보드 화면

## 5. 우선순위 판정

| 우선순위 | 항목 | 이유 |
| --- | --- | --- |
| 1 | Jira backlog route 지원 여부 결정 | DOM과 fresh-tab 재현이 모두 확보됐고 코드 경계가 명확함 |
| 2 | 공통 runtime에 max-wait 또는 즉시 route reconcile 필요성 검증 | 지원 화면의 간헐적 누락을 줄일 수 있으나 현재 직접 재현은 부족함 |
| 3 | Atlassian manifest match 확대 여부 검토 | SPA 진입 경로 문제를 막을 수 있지만 실행·권한 범위가 넓어짐 |
| 4 | 업데이트 시 background 자동 재주입 | 가능하지만 권한·중복 실행·실패 처리 복잡도가 현재 이득보다 큼 |

## 5.1 적용 현황 (2026-08-24)

| 우선순위 | 항목 | 상태 | 적용 내용 |
| --- | --- | --- | --- |
| 1 | Jira backlog route 지원 | 적용 | `isJiraBoardRoute()`가 `viewPath`로 `''`와 `'/backlog'`를 허용한다. `timeline`, `calendar`, `reports`는 계속 제외한다. |
| 2 | runtime max-wait와 즉시 route reconcile | 적용 | `createUpdateScheduler()`로 debounce에 `maxWaitMs`(기본 1000ms)를 추가했다. route 변경은 debounce를 우회해 즉시 reconcile한다. |
| 3 | Atlassian manifest match 확대 | 미적용 | 실행·권한 범위 확대 트레이드오프가 있어 실제 재현 사례 확보 후 재검토한다. |
| 4 | 업데이트 시 background 자동 재주입 | 미적용 | 문서 4장 판정을 유지한다. 탭 새로고침이 기본 복구 수단이다. |

2번의 route 변경 감지는 `hashchange`와 `popstate`만으로는 부족하다. Atlassian SPA는 `pushState`로 이동하므로 두 event가 발생하지 않는다. 따라서 `scheduleUpdate()`가 매 호출 시 `window.location.href`를 마지막 reconcile 시점의 URL과 비교해, 다르면 debounce를 건너뛰고 바로 reconcile한다. 이미 실행 중인 reconcile이 있으면 기존 `rerunRequested` 경로로 합쳐지므로 URL 변경 한 번에 reconcile은 최대 2회만 발생한다.

변경 파일:

- `src/sites/jira/routes.ts`
- `src/platform/runtime/updateScheduler.ts` (신규)
- `src/platform/runtime/createSiteRuntime.ts`
- `src/platform/runtime/types.ts`
- `tests/unit.test.ts`
- `spec/features/jira-work-link-copy.md`
- `spec/product-overview.md`

`npm run build`(typecheck + test 40건 포함)는 통과했다. Chrome 실측 재검증은 확장 재로드가 필요하므로 별도로 수행한다.

## 6. 검증 공백

- Chrome 보안 정책상 Extension 내부 설정 저장소를 직접 읽지 않았으므로 아마란스 미노출 탭의 master/feature toggle 상태는 확인하지 못했다.
- Confluence 새 탭에서 UI가 0개였던 결과는 기능 설정 OFF 가능성이 있어 context 복구 여부의 단독 증거로 사용하지 않았다.
- continuous DOM mutation으로 debounce가 실제 starvation되는 장시간 재현은 수행하지 않았다.
- background 재주입은 설계 가능성만 검토했으며 실제 prototype은 만들지 않았다.

## 7. 관련 코드와 문서

- `manifest.json`
- `src/platform/runtime/createSiteRuntime.ts`
- `src/platform/settings/repository.ts`
- `src/sites/jira/routes.ts`
- `src/sites/jira/features/issueLinkCopy/runtime.ts`
- `src/sites/confluence/features/pageMarkdownCopy/runtime.ts`
- `src/sites/confluence/features/editorMarkdownToAdf/runtime.ts`
- `src/sites/amaranth/features/attendanceHeader/runtime.ts`
- `tests/unit.test.ts`
- `spec/features/jira-work-link-copy.md`
- `README.md`

Chrome 공식 문서:

- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [chrome.runtime](https://developer.chrome.com/docs/extensions/reference/api/runtime)
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

## 8. 최종 판정

1. Jira backlog UI 미노출은 새로고침 문제가 아니며 코드로 해결할 수 있다.
2. Extension reload 이후 기존 탭 context 무효화는 새로고침이 기본 복구 수단이다.
3. context 무효화를 background 재주입으로 완화할 수는 있지만 현재보다 많은 권한과 복잡도가 필요하므로 완전한 무새로고침 보장은 어렵다.
4. 새로고침 후 지원 route와 필수 DOM이 모두 존재하는데도 UI가 누락된다면 공통 runtime 또는 selector 결함으로 보고 코드 수정 대상으로 분류한다.
