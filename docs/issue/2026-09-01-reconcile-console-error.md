# reconcile 경로에서 보고된 콘솔 오류

- 발생일: 2026-09-01
- 상태: **1차 조사.** 후속 단서(재로드로 안 사라짐)로 원인이 좁혀졌다. → [확장 재로드로 사라지지 않는 콘솔 오류](./2026-09-01-stale-content-script-console-error.md)
- 보고 맥락: 성능 분석 2순위(설정 읽기 비용) 측정을 위해 임시 계측 코드를 넣고 확장을 재로드한 직후

## 1. 보고 원문

사용자 보고는 다음 한 줄이 전부다.

```text
assets/writePlainText-D5NrH3fs.js:1 (b)
오류남
```

2차 보고에서 발생 화면이 추가됐다.

```text
컨텍스트: https://pms-innogrid.atlassian.net/browse/NPT-143
에러: assets/writePlainText-D5NrH3fs.js:1 (b)
```

**오류 메시지 본문은 두 번 모두 전달되지 않았다.** 스택 위치만 있다.

## 2. 확인된 사실

### 2.1 해당 위치는 `reconcileNow()`다

청크 이름이 `writePlainText`이지만 실제 내용은 다르다. 빌드 산출물을 직접 확인했다.

| 확인 | 결과 |
| --- | --- |
| 청크 크기 | 3,092 B |
| `storage.sync` 포함 | **0회** |
| `getSettings` 포함 | **0회** |
| `execCommand` 포함 | 1회 |

청크 이름은 Vite가 묶인 모듈 중 하나에서 따온 것이고, 이 청크에는 공용 런타임이 함께 들어 있다.

`async function b()`의 실체는 `createSiteRuntime.ts`의 `reconcileNow()`다.

```js
async function b(){
  var n;
  if(c){                                    // if (!started) return
    if(o){d=!0;return}                      // if (reconciling) { rerunRequested = true; return }
    o=!0;
    try{
      try{ a=await R() }                    // settings = await getSettings()
      catch(l){
        console.error(`[Inno Extension] ${e.siteId} 설정을 읽지 못했습니다`, l);
        if(!a) return
      }
      ...
      const s=a.sites[e.siteId];
      if(i=window.location.href, !s.enabled){ E(); v(); return }
```

**따라서 스택의 `(b)`는 `reconcileNow()` 안에서 난 오류다.**

### 2.2 계측 코드가 storage 읽기를 대폭 늘렸다

보고 시점에 설치돼 있던 임시 계측(`src/platform/settings/__bench.ts`)은 Jira content script 시작 시 다음을 수행했다.

| 항목 | 호출 수 |
| --- | --- |
| 콜드 측정 | 1 |
| 기준값 조회 | 1 |
| 예열 | 80 |
| 본 측정 | 80 |
| **페이지 로드당 합계** | **약 162회** |

평상시 `getSettings()`는 reconcile마다 1회다. 계측이 이를 두 자릿수 배로 늘렸다.

### 2.3 계측 자체는 성공했다

같은 빌드에서 측정은 정상 완료됐고 오류 속성은 비어 있었다.

```json
{
  "sanity": "OK (full >= raw)",
  "rawGet": { "n": 40, "median": 0.1, "mean": 0.178, "p95": 1.3 },
  "full":   { "n": 40, "median": 0.1, "mean": 0.170, "p95": 0.9 }
}
```

즉 **측정에 쓰인 162회 호출 중 예외로 중단된 것은 없었다.** 계측 코드 안에서는 오류가 관측되지 않았다.

### 2.4 [결정적] 보고된 청크는 계측 포함 빌드에만 존재한다

청크 파일명의 해시는 내용이 바뀌면 함께 바뀐다. 계측 코드를 제거하고 다시 빌드한 뒤 확인했다.

| 시점 | 청크 파일명 |
| --- | --- |
| 계측 도입 전 | `writePlainText-ZMIRNF__.js` |
| **계측 포함 (보고 시점)** | **`writePlainText-D5NrH3fs.js`** |
| 계측 제거 후 (현재) | `writePlainText-ZMIRNF__.js` (원래 해시로 복귀) |

`__bench.ts`가 `repository.ts`와 `schema.ts`를 import하면서 이 청크의 구성이 달라졌고 해시가 바뀌었다. 계측을 걷어내자 원래 해시로 돌아왔다.

**따라서 보고된 오류는 임시 계측이 포함된 빌드에서 발생했다.** 현재 배포 형상에는 그 파일이 존재하지 않는다.

이것으로 4.3(동적 import 실패)은 배제된다. 그 변경은 Confluence 전용이고, 발생 화면이 Jira `browse/NPT-143`으로 확정됐다.

## 3. 재현 시도와 결과

| 시도 | 결과 |
| --- | --- |
| Jira `browse/NPT-143` 재로드 후 콘솔 조회 | 오류 없음 |
| Jira `browse/NPT-166` 재로드 후 콘솔 조회 | 오류 없음 |
| `data-inno-bench-error` 속성 확인 | `null` |
| 확장 주입 상태 | 정상 (root 1개) |

**재현하지 못했다.**

도구 제약도 있었다. content script는 ISOLATED world에서 실행되고, 사용한 콘솔 조회 도구는 그 로그를 잡지 못했다. 확장 로그가 한 번도 캡처되지 않았으므로 **"오류가 없었다"가 아니라 "확인할 수 없었다"가 정확하다.**

## 4. 가설

### 4.1 [유력] 처리된 오류 로그가 보인 것

`reconcileNow()`는 설정 읽기 실패를 잡아 로그만 남기고 계속한다.

```ts
catch (error) {
  console.error(`[Inno Extension] ${options.siteId} 설정을 읽지 못했습니다`, error);
  if (!settings) return;
}
```

`console.error`는 DevTools에서 붉은 오류로 표시되고 호출 위치가 스택으로 붙는다. 그 위치가 정확히 `(b)`다.

계측이 storage 읽기를 162회로 늘렸으므로 일부가 실패했다면 이 로그가 여러 번 떴을 수 있다. **이 경우 확장은 정상 동작한다.** 2026-08-26 장애 이후 추가한 방어가 의도대로 작동한 것이다.

**약점.** 2.3에서 계측 내부 호출은 모두 성공했다. 계측과 reconcile이 동시에 storage를 두드리는 구간에서만 실패했다고 보려면 추가 근거가 필요하다.

### 4.2 [가능] `settings.sites[siteId]`가 undefined

```js
const s = a.sites[e.siteId];
if(i=window.location.href, !s.enabled){ ... }   // s가 undefined면 TypeError
```

`getSettings()`가 실패하고 이전 설정 `a`가 남아 있으면 `if(!a) return`을 통과한다. 그 `a`가 현재 `siteId`를 갖지 않으면 다음 줄에서 터진다.

정상 경로에서는 `normalizeSettings()`가 항상 모든 사이트를 채우므로 발생하지 않아야 한다. 다만 **이 줄에는 방어가 없다.**

### 4.3 [배제됨] 1순위 변경의 동적 import 실패

같은 시점에 Confluence Markdown 파서를 동적 import로 바꿨다. 그러나 발생 화면이 Jira `browse/NPT-143`으로 확정됐고 해당 변경은 Confluence 전용이다. **배제한다.**

## 5. 조치

- 임시 계측 코드를 제거했다 (`__bench.ts` 삭제, `jira/content.ts` 호출 제거).
- 계측이 원인이었다면 이 제거로 사라진다. **사라지는지 여부 자체가 4.1 가설의 검증이다.**

## 6. 확인이 필요한 것

1. **오류 메시지 전문.** 스택 위치만으로는 4.1과 4.2를 구분할 수 없다. DevTools에서 해당 줄을 펼친 전체 텍스트가 필요하다. 두 번의 보고 모두 위치만 있었다.
2. ~~어느 사이트에서 발생했는지~~ → **Jira `browse/NPT-143`으로 확정.**
3. **계측 제거 후에도 재현되는지.** 현재 빌드에는 보고된 청크 자체가 없다. 재로드 후 재현되면 계측과 무관한 문제이며 우선순위가 올라간다.
4. 붉은 오류 한 줄이었는지, 반복해서 여러 줄이었는지.

## 7. 후속 검토 대상

원인과 별개로, 조사 중 드러난 개선 여지다.

| 항목 | 내용 |
| --- | --- |
| `settings.sites[siteId]` 방어 부재 | 4.2 경로에 옵셔널 체이닝이나 조기 반환이 없다. 설정 읽기 실패 후 이전 설정을 재사용하는 구조라면 방어할 가치가 있다 |
| content script 로그 관측 수단 | ISOLATED world 로그를 외부에서 읽을 방법이 없어 진단이 오래 걸렸다. 이번에는 DOM 속성으로 우회했다. 상시 진단 채널을 둘지 검토 |
| 청크 이름과 내용 불일치 | `writePlainText-*.js`에 공용 런타임이 들어 있어 스택만으로 위치를 오판하기 쉽다. 실제로 이번 조사 초기에 `repository.ts`로 잘못 짚었다 |

## 8. 관련 자료

- [사후 기록 — 설정 쓰기 할당량 장애](../postmortems/2026-08-26-settings-write-quota-outage.md) — 같은 `reconcileNow()` 경로에서 난 과거 전면 장애
- [성능 관점 리팩터링 분석](../performance-refactoring-analysis.md) — 이번 계측의 배경
- `src/platform/runtime/createSiteRuntime.ts` — `reconcileNow()`
