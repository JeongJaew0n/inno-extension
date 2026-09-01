# 성능 관점 리팩터링 분석

- 작성일: 2026-09-01
- 분석 대상: Inno Extension `v0.6.0` (지원 사이트 5개, 기능 8개)
- 분석 방법: 실제 로그인 세션에서 DOM 비용 벤치마크, 배포 번들 의존 그래프 추적, 코드 중복 정량화

## 1. 결론

**예상과 달리 DOM 작업은 병목이 아니다.** reconcile 한 번의 DOM 비용은 무거운 페이지에서도 0.35ms다. 흔히 손대는 selector 최적화, 쿼리 캐싱, 관찰자 범위 축소는 이 프로젝트에서 얻을 것이 거의 없다.

실제로 비용이 큰 곳은 하나다.

| 순위 | 항목 | 근거 | 예상 효과 |
| --- | --- | --- | --- |
| 1 | Confluence content script가 Markdown 파서를 정적으로 포함 | **측정됨** — 80.9KB 중 47.2KB | **적용 완료.** 80.9 → 34.7KB (57% 감소) |
| 2 | reconcile마다 `chrome.storage.sync` 읽기 | 구조 분석. **비용 미측정** | reconcile 지연 감소 |
| 3 | 복사 버튼 런타임 3종의 중복 | **측정됨** — 576줄, reconcile 본문은 주석 1줄 차이 | 유지보수. 번들 소폭 감소 |

3번은 성능 개선이라기보다 유지보수 개선이다. 성능 효과는 부수적이다.

> **재검토 결과 (2026-09-01).** 최초 작성 시 host 생성 비용을 측정하지 않은 채 "DOM은 병목이 아니다"라고 단정했다. 다시 측정하니 host 13개 생성에 3.2ms로 탐색 비용의 10배였다. 다만 정상 상태에서 재생성이 일어나지 않음을 확인해 결론 자체는 유지된다. 상세는 3.1.1에 있다.

## 2. 측정 환경

| 항목 | 값 |
| --- | --- |
| 대상 1 | Jira 보드 + 선택 업무 패널 (DOM 3,623 노드) |
| 대상 2 | GitHub Enterprise PR Conversation (DOM 3,565 노드, TimelineItem 26개, 주입 host 13개) |
| 반복 | 항목당 200회, 레이아웃 강제 항목은 50회 |
| 번들 | `npm run package` 산출물 `dist/` |

## 3. 측정 결과

### 3.1 reconcile 한 번의 DOM 비용 — 병목 아님

Jira 보드에서 `issueLinkCopy`가 매 reconcile에 수행하는 작업이다.

| 작업 | ms/회 |
| --- | --- |
| `findBoardIssueScope`의 document 조회 3회 | 0.126 |
| 패널 안 `a[href]` 순회 + 앵커마다 `new URL()` | 0.010 |
| host 정리용 전체 문서 스캔 | 0.029 |
| 제목 `cloneNode(true)` | 0.001 |
| `h1` 목록 + `getClientRects()` (레이아웃 강제) | 0.034 |
| **합계** | **약 0.20** |

GitHub PR에서 두 기능이 동시에 도는 경우다.

| 작업 | ms/회 |
| --- | --- |
| `commitShaCopy`: TimelineItem 26개 순회 + 셀·링크 조회 | 0.198 |
| `pullRequestTitleCopy`: 목록 행·제목 조회 | 0.057 |
| host 정리용 전체 문서 스캔 (기능당 1회, 총 2회) | 0.097 |
| **합계** | **약 0.35** |

reconcile은 debounce 120~180ms, maxWait 1000ms로 제한된다. 최악의 경우에도 초당 1회 수준이므로 **0.35ms는 프레임 예산(16.7ms)의 2%다.**

`getClientRects()`가 레이아웃을 강제하지만 0.034ms에 그친다. `cloneNode(true)`도 0.001ms다. 둘 다 "비싸 보이는" 호출이지만 실측에서는 무시할 수준이다.

#### 측정 방법 검증

같은 쿼리를 200회 반복하면 브라우저 내부 캐시 때문에 실제보다 빠르게 나올 수 있다. 매 회 DOM을 변경해 캐시를 무효화한 뒤 다시 쟀다.

| 방식 | ms/회 |
| --- | --- |
| 반복만 | 0.121 |
| 매 회 DOM 변경 후 조회 | 0.090 |

비율 0.75로 무효화한 쪽이 오히려 빨랐다. 측정 노이즈 범위이며 **캐싱 편향은 없다.**

### 3.1.1 버튼 생성 비용 — 최초 분석에서 빠졌던 항목

3.1은 **탐색 비용만** 측정한 것이었다. 실제 reconcile에는 host 생성이 포함된다. 이 부분을 빠뜨렸으므로 별도로 측정했다.

| 작업 | ms |
| --- | --- |
| host 1개 생성 (Shadow DOM + `innerHTML` 파싱 + listener) | **0.182** |
| host 13개 생성 (GitHub PR의 실제 주입 수) | **3.215** |

**host 1개 생성이 탐색 전체(0.35ms)의 절반이고, 13개면 약 10배다.** 처음 보고한 "reconcile 0.35ms"는 이 항목을 포함하지 않은 값이었다.

다만 reconcile은 멱등이라 host를 매번 만들지 않는다. 실제 재생성 빈도를 측정했다.

| 조건 | 결과 |
| --- | --- |
| GitHub PR에서 20초간 (스크롤 포함) | host 추가 **0건**, 제거 **0건** |

**따라서 3.2ms는 최초 1회 비용이고 정상 상태에서 반복되지 않는다.** 결론은 바뀌지 않지만, 처음 문서는 근거가 불완전했다.

이 항목이 뒤집히는 조건은 명확하다. **SPA 재렌더로 host가 자주 파괴·재생성되면 3.2ms가 반복 비용이 된다.** 그 경우 우선순위가 크게 올라간다. 현재는 그런 상황을 관측하지 못했다.

### 3.2 사이트별 content script 번들 — 여기가 문제다

각 호스트에서 실제로 내려받고 파싱·평가하는 총량이다. 동적 import 체인을 따라 합산했다.

| 호스트 | world | 총 KB | 비고 |
| --- | --- | --- | --- |
| **`pms-innogrid.atlassian.net/wiki`** | ISOLATED | **80.9** | `markdown-to-adf` 47.2KB 포함 |
| `gw.innogrid.com` | ISOLATED | 23.6 | |
| `github.nhnent.com` | ISOLATED | 17.5 | |
| `pms-innogrid.atlassian.net` (Jira) | ISOLATED | 15.0 | |
| `rnd-app.innogrid.com` | ISOLATED | 12.4 | |
| `pms-innogrid.atlassian.net/wiki` | MAIN | 3.0 | ProseMirror 브리지 |

Confluence가 나머지 넷을 합친 것보다 크다.

### 3.3 47.2KB의 정체

정적 import 체인을 추적했다.

```text
src/sites/confluence/content.ts
  → features/editorMarkdownToAdf/runtime.ts        (정적 import)
    → code-block-to-adf.ts
      → adf/markdown-to-adf.ts
        → marked  (npm 의존성)
```

`marked`는 Markdown 파서다. 이것이 Confluence content script에 정적으로 묶여 **모든 `/wiki/*` 페이지에서 파싱·평가된다.**

그런데 이 코드가 실제로 필요한 조건은 매우 좁다.

| 조건 | 값 |
| --- | --- |
| `Markdown → ADF` 기능 기본값 | **OFF** |
| 실행 시점 | 사용자가 변환 버튼을 **클릭**했을 때만 |
| 버튼이 존재하는 화면 | `edit-v2` 편집 화면만 |

즉 **기본 설정 사용자는 이 47.2KB를 한 번도 쓰지 않는다.** 문서를 읽기만 하는 사용자도 모든 페이지에서 이 비용을 낸다.

## 4. 측정하지 못한 것

정직하게 남긴다. 아래 항목은 이 문서의 우선순위 근거로 쓰지 않았다.

### 4.1 MutationObserver 압력 — 측정 실패

공용 런타임은 `document.body`에 `childList`, `subtree`, `attributes(class)`를 모두 감시한다. SPA에서 class 변경이 잦아 관찰자가 계속 깨어날 것으로 예상했다.

실측 결과는 예상과 달랐다.

| 조건 | 10초간 관찰자 호출 |
| --- | --- |
| Jira 보드 유휴 | **0회** |
| 합성 스크롤·hover 이벤트 | **0회** |

유휴 상태에서 0회인 것은 확인했다. 그러나 합성 이벤트로는 실제 사용 중 부하를 재현하지 못했다. React는 `dispatchEvent`로 만든 hover에 실제 사용자 입력과 같게 반응하지 않는다.

**따라서 실사용 중 관찰자 압력은 확인되지 않았다.** 유휴 시 0회라는 사실만으로 "문제 없음"이라 단정하지 않는다. 실제 마우스·키보드 입력이 필요한 측정이므로 별도 수단이 필요하다.

### 4.2 `chrome.storage.sync` 읽기 비용 — 측정 불가

`reconcileNow()`는 가장 먼저 `await getSettings()`를 호출한다. 이는 `chrome.storage.sync.get()`이며 확장 프로세스와의 **비동기 IPC**다.

```ts
reconciling = true;
try {
  try {
    settings = await getSettings();   // ← 매 reconcile, DOM 작업보다 먼저
  } catch (error) { ... }
```

페이지 컨텍스트에서는 `chrome.storage`에 접근할 수 없어 왕복 시간을 측정하지 못했다. 일반적으로 IPC 왕복은 동기 DOM 쿼리보다 한 자릿수 이상 느리지만, **이 프로젝트에서의 실제 값은 확인하지 못했다.**

구조적으로는 개선 여지가 분명하다. 설정은 사용자가 Popup에서 바꿀 때만 변하고, 그 변경은 이미 `chrome.storage.onChanged`로 통지받고 있다. 즉 **매번 읽을 이유가 없다.**

## 5. 개선 항목

### 5.1 [1순위] Confluence Markdown 파서 지연 로딩

**문제.** 기본 OFF이고 클릭 시에만 쓰이는 47.2KB가 모든 Confluence 페이지에서 평가된다.

**방향.** `code-block-to-adf.ts`를 정적 import에서 동적 import로 바꾼다. 변환 버튼 클릭 핸들러 안에서 `await import(...)` 한다.

```text
현재: content.ts 로드 시 marked까지 평가
개선: 버튼 클릭 시점에 처음 평가
```

**주의할 점.**

- 첫 클릭에 로딩 지연이 생긴다. 버튼에 이미 `변환 중` 표시가 있으므로 사용자 경험상 흡수된다.
- Popup의 변환기도 같은 모듈을 쓰는지 확인해야 한다. Popup은 별도 번들이므로 영향이 다르다.
- 동적 import는 Chrome 확장에서 `chrome.runtime.getURL`을 거쳐야 할 수 있다. 현재 빌드가 content script에 이미 동적 import loader를 쓰고 있으므로 선례가 있다.

**검증.** `dist/` 의존 그래프를 다시 추적해 Confluence ISOLATED 번들이 80.9KB에서 약 34KB로 줄었는지 확인한다.

#### 적용 결과 (2026-09-01)

`code-block-to-adf` import를 클릭 시점 동적 import로 바꿨다. 모듈 평가는 한 번만 일어나도록 Promise를 캐시하고, 로딩이 실패하면 캐시를 비워 재시도가 막히지 않게 했다.

| 항목 | 이전 | 이후 |
| --- | --- | --- |
| `/wiki/*` 페이지 로드 시 평가량 | **80.9 KB** | **34.7 KB** |
| 감소 | | **-46.2 KB (57%)** |
| 정적 청크의 `marked` 흔적 | 포함 | **0회** |
| 정적 청크의 `markdown-to-adf` 참조 | `from"./markdown-to-adf..."` | **없음** |
| 클릭 시 추가 로드 | 없음 (이미 포함) | 47.7 KB |

동적 import가 확장에서 동작하려면 청크가 web accessible이어야 한다. 빌드가 두 청크를 Confluence match의 `web_accessible_resources`에 자동 등록하는 것을 확인했다.

```text
assets/code-block-to-adf-C2ZxiFMW.js
assets/markdown-to-adf-Du3Pgqgc.js
```

`adf-to-editor-html.ts`는 `../../adf`에서 **타입만** import하므로(`import type`) 빌드 시 소거되어 정적 청크에 파서를 끌어오지 않는다. Popup은 별도 번들이라 영향이 없다.

자동화 테스트 73건 통과. 2026-09-01 사용자가 브라우저에서 변환 동작을 확인했다. 클릭 시점 모듈 로딩이 이 변경의 핵심 위험이었고, 그 경로가 실제로 동작함이 확인됐다.

### 5.2 [2순위] 설정 읽기를 캐시로 전환

**문제.** reconcile마다 storage IPC가 발생한다. 설정은 거의 변하지 않는다.

**방향.** 최초 1회 읽고 메모리에 유지한다. `chrome.storage.onChanged`가 이미 등록돼 있으므로 그 시점에만 갱신한다.

```text
현재: reconcile -> getSettings() -> storage IPC -> DOM 작업
개선: reconcile -> 메모리 설정 -> DOM 작업
      onChanged -> 캐시 갱신 -> reconcile
```

**주의할 점.**

- 이 경로는 과거 전체 장애의 발원지다. [사후 기록](./postmortems/2026-08-26-settings-write-quota-outage.md)을 먼저 읽는다. 당시 원인은 읽기가 쓰기를 유발하고 그 쓰기가 다시 reconcile을 부르는 순환이었다.
- 캐시를 도입하면 `onChanged` 의존도가 높아진다. 통지가 유실되면 설정이 반영되지 않는다. 현재 구조는 매번 읽으므로 그런 위험이 없었다. **이 트레이드오프를 인지하고 결정해야 한다.**
- `getSettings()` 실패 시 직전 설정으로 계속하는 방어는 이미 있다.

**선행 조건.** 4.2를 실제로 측정해 개선 폭이 위험을 정당화하는지 먼저 확인한다. 측정 없이 진행하면 근거 없는 최적화다.

### 5.3 [3순위] 복사 버튼 런타임 공통화

성능보다 유지보수 항목이다. 번들 감소는 부수 효과다.

**문제.** 세 기능이 사실상 같은 코드다.

| 파일 | 줄 수 |
| --- | --- |
| `githubEnterprise/pullRequestTitleCopy/runtime.ts` | 215 |
| `githubEnterprise/commitShaCopy/runtime.ts` | 184 |
| `gitlab/commitShaCopy/runtime.ts` | 177 |
| 합계 | **576** |

세 파일이 공통으로 갖는 요소다.

```text
liveHosts WeakSet 추적        3개 파일
findExistingHost()            3개 파일
removeAllHosts()              3개 파일
COPY / CHECK / FAIL 아이콘     3개 파일 (SVG 문자열 동일)
COPY_FEEDBACK_MS = 1500       3개 파일
Shadow DOM + all:initial      3개 파일
preventDefault + stopPropagation  3개 파일
```

두 커밋 복사 런타임의 `reconcile` 본문은 **주석 한 줄만 다르고 나머지가 동일하다.** `createCopyHost`도 CSS 변수명과 aria 문구 19줄만 다르다.

**방향.** 공통 팩토리를 만든다. 사이트별로 달라지는 것은 다음 넷뿐이다.

```text
1. 대상 탐색      (targets: (context) => Array<{anchor, value}>)
2. 복사 값 생성    (이미 value로 위임됨)
3. 버튼 라벨·툴팁
4. 테마 CSS 변수명
```

**주의할 점.**

- `pullRequestTitleCopy`는 두 커밋 복사와 달리 mountKind가 여러 개이고 제목 재조회 로직이 있다. 무리하게 하나로 합치면 조건 분기가 늘어 오히려 나빠진다. **커밋 복사 둘만 먼저 합치는 것이 안전하다.**
- 각 기능의 회귀 테스트(댓글 제외, Commits 탭 제외)가 공통화 후에도 그대로 동작해야 한다.

## 6. 하지 말아야 할 것

측정 근거로 기각한 항목이다. 착수하면 시간만 든다.

| 항목 | 기각 근거 |
| --- | --- |
| selector 최적화, 쿼리 결과 캐싱 | reconcile 전체 DOM 비용이 0.35ms다. 절반으로 줄여도 0.17ms 절약이다 |
| `cloneNode(true)` 제거 | 0.001ms |
| `getClientRects()` 회피 | 0.034ms. 레이아웃 강제이지만 실측상 무의미 |
| 앵커별 `new URL()` 제거 | 10개 앵커에 0.010ms |
| host 정리 스캔을 증분 갱신으로 | 0.029ms |
| MutationObserver 범위 축소 | 압력이 확인되지 않았다. 근거 없이 감시를 좁히면 기능 누락 위험만 생긴다 |
| Shadow DOM 대신 일반 DOM 사용 | 생성 비용 3.2ms는 최초 1회다. 격리를 잃는 대가가 크다. **단 재생성이 잦아지면 재검토 대상** |

## 7. 권고 순서

1. **5.1을 먼저 한다.** 유일하게 측정된 큰 이득이고, 위험이 낮으며, 사후 기록과 무관한 영역이다.
2. **4.2를 측정한다.** 확장 컨텍스트에서 `getSettings()` 왕복 시간을 재는 것이 5.2의 선행 조건이다.
3. 측정값이 유의미하면 5.2를 진행하되 사후 기록을 먼저 읽는다.
4. 5.3은 성능과 분리해 별도로 다룬다.
5. 4.1(관찰자 압력)은 실제 입력이 필요한 측정 수단을 확보한 뒤 재검토한다.

## 8. 관련 자료

- [사후 기록 — 설정 쓰기 할당량 장애](./postmortems/2026-08-26-settings-write-quota-outage.md) — 5.2가 건드리는 경로
- [Extension UI 미노출 분석](./extension-ui-visibility-recovery-analysis.md) — reconcile 스케줄링 배경
- `src/platform/runtime/createSiteRuntime.ts` — reconcile 진입점
- `src/platform/settings/repository.ts` — `getSettings()`
- `src/sites/confluence/content.ts` — 정적 import 체인 시작점
