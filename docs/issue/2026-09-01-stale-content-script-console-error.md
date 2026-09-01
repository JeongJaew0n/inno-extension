# 확장 재로드로 사라지지 않는 콘솔 오류

- 발생일: 2026-09-01
- 상태: **원인 유력, 대응 적용됨.** 삭제·재설치로만 사라지는 이유까지 설명됨. 오류 메시지 전문은 미확보
- 관련: [reconcile 경로에서 보고된 콘솔 오류](./2026-09-01-reconcile-console-error.md) — 같은 사건의 1차 조사

## 1. 보고 원문

```text
컨텍스트: https://pms-innogrid.atlassian.net/browse/NPT-143
에러: assets/writePlainText-D5NrH3fs.js:1 (b)
```

> 아니 근데 이슈가 새로고침해도 오류가 안사라져. 삭제를 하고 추가해야돼.

**이 마지막 문장이 원인 판별의 핵심 단서다.**

## 2. 결론

이미 열려 있던 탭에 **죽은 content script가 남아 있어서** 발생하는 오류로 보인다.

확장을 재로드하면 기존 탭의 content script는 사라지지 않고 **context만 무효화된 채 계속 돌아간다.** 그 스크립트가 `chrome.storage`를 호출할 때마다 예외가 나고, `reconcileNow()`가 그것을 잡아 `console.error`를 남긴다. 스택에 찍히는 위치가 `(b)`다.

| 조치 | 죽은 스크립트가 사라지는가 |
| --- | --- |
| 확장 재로드 | **아니오** — 기존 탭의 스크립트는 그대로 남는다 |
| 확장 삭제·재추가 | **예** — Chrome이 모든 탭의 content script를 내린다 |
| **대상 탭 새로고침** | **예** — 이게 정석 해법이다 |

즉 삭제·재설치는 과한 조치였고, **해당 Jira 탭을 새로고침하는 것으로 충분했을 가능성이 높다.**

## 3. 이 가설이 설명하는 것

### 3.1 왜 확장 재로드로 안 사라지는가

Chrome 확장을 재로드해도 이미 주입된 content script는 페이지에서 제거되지 않는다. 그 스크립트는 계속 실행되지만 소속 확장 context가 무효화되어 `chrome.*` API 호출이 모두 실패한다.

이 프로젝트에는 이미 같은 현상이 기록돼 있다. [Extension UI 미노출 분석](../extension-ui-visibility-recovery-analysis.md) 2.3절에서 Confluence 탭의 `Extension context invalidated` 오류를 25건 관측했고, 판정은 다음과 같았다.

> 판정: **기존 content script 자체의 완전 복구는 불가능**.

`README.md` 문제 해결 절도 확장 새로고침 **다음에 대상 사이트 탭 새로고침**을 함께 안내한다. 이번 사례는 그 두 번째 단계가 빠진 상황과 일치한다.

### 3.2 왜 삭제·재추가로는 사라지는가

확장을 삭제하면 Chrome이 해당 확장의 content script를 모든 탭에서 내린다. 죽은 스크립트가 물리적으로 사라지므로 더 이상 오류를 낼 주체가 없다.

부수적으로 확장 ID도 바뀔 수 있다. 이 세션에서도 ID가 `mjdbhoko...`에서 `pofjkocn...`으로 바뀐 것이 관측됐다.

### 3.3 왜 존재하지 않는 청크 이름이 스택에 찍히는가

보고된 `writePlainText-D5NrH3fs.js`는 현재 빌드에 없다.

| 시점 | 청크 파일명 |
| --- | --- |
| 계측 도입 전 | `writePlainText-ZMIRNF__.js` |
| **계측 포함** | **`writePlainText-D5NrH3fs.js`** |
| 계측 제거 후 (현재) | `writePlainText-ZMIRNF__.js` |

디스크에서 파일이 사라져도, **그 탭이 이미 메모리에 로드해 둔 모듈은 계속 살아 있고 스택 트레이스에 원래 파일명을 그대로 보고한다.** 파일이 없는데 스택에 나오는 것이 이 가설의 예측과 정확히 일치한다.

즉 그 탭은 계측 빌드가 살아 있던 시점에 로드됐고, 이후 재로드에도 그 상태로 남아 있었다.

### 3.4 왜 오류 위치가 `(b)`인가

`reconcileNow()`는 설정 읽기 실패를 잡아 로그만 남긴다.

```ts
try {
  settings = await getSettings();          // chrome.storage.sync.get
} catch (error) {
  console.error(`[Inno Extension] ${options.siteId} 설정을 읽지 못했습니다`, error);
  if (!settings) return;
}
```

context가 무효화된 스크립트에서는 `chrome.storage.sync.get`이 예외를 던진다. 그것을 잡아 남기는 `console.error`의 호출 위치가 minify 후 `(b)`다.

**이 경우 확장은 설계대로 동작한 것이다.** 2026-08-26 장애 이후 추가한 방어가 전면 장애 대신 로그 한 줄로 막아냈다.

## 4. 배제한 가설

### 4.1 저장된 설정이 원인 — 배제

"재로드로는 안 지워지고 재설치로만 지워지는 것"을 찾다가 `chrome.storage.sync['extensionSettings']`를 먼저 의심했다. 확장이 쓰는 영속 상태는 이것 하나뿐이다.

그러나 `normalizeSettings()`는 항상 `createDefaultSettings()`를 기반으로 새 객체를 만들어 반환한다. 저장값에 무엇이 들어 있든 `settings.sites[siteId]`는 항상 채워진다. **저장 데이터가 오류를 만들 경로를 찾지 못했다.**

### 4.2 쓰기 할당량 소진 — 배제

2026-08-26 장애의 원인이었으므로 재발을 의심했다. 그러나 현재 `getSettings()`는 쓰기를 하지 않고, 당시 넣었던 계측도 읽기만 했다. **쓰기 자체가 발생하지 않는다.**

### 4.3 Confluence 동적 import 실패 — 배제

같은 날 적용한 1순위 변경이지만 Confluence 전용이고, 발생 화면은 Jira다.

## 5. 확인하지 못한 것

- **오류 메시지 전문.** 세 번의 보고 모두 스택 위치만 있었다. `Extension context invalidated`인지 다른 것인지 확정하지 못했다.
- 재현. content script 로그가 ISOLATED world에 남아 사용한 도구로 읽지 못했다. "오류가 없었다"가 아니라 **"확인할 수 없었다"**가 정확하다.
- 사용자가 말한 "새로고침"이 페이지 새로고침인지 확장 새로고침인지. **확장 새로고침만 했다면 이 가설과 완전히 일치한다.**

## 6. 검증 방법

가장 빠른 확인은 다음 한 가지다.

1. 확장을 재로드한다.
2. **오류가 보이던 Jira 탭을 새로고침한다.**
3. 오류가 사라지면 이 가설이 확정된다.

메시지 전문을 확보하려면 DevTools에서 오류 줄 왼쪽 삼각형을 펼친다. `Extension context invalidated`가 보이면 확정이다.

## 7. 구조적 개선 후보

원인과 별개로, 이번 조사가 드러낸 것들이다.

| 항목 | 내용 | 근거 |
| --- | --- | --- |
| 무효화된 context를 스스로 인지하고 멈추기 | `chrome.runtime?.id`가 사라진 것을 감지하면 observer를 끊고 조용히 종료할 수 있다. 지금은 매 reconcile마다 실패하고 로그를 쌓는다 | 3.4 |
| 로그 소음 억제 | 같은 오류가 reconcile마다 반복된다. 첫 1회만 남기거나 억제 카운터를 두는 편이 진단에 유리하다 | 3.1 |
| content script 로그 관측 채널 | ISOLATED world 로그를 외부에서 읽을 수단이 없어 세 차례 조사에서 매번 막혔다. **미적용** | 5 |
| 청크 이름과 내용 불일치 | `writePlainText-*.js`에 공용 런타임이 들어 있어 스택만으로 위치를 오판하기 쉽다. 1차 조사에서 실제로 `repository.ts`로 잘못 짚었다. **미적용** | 3.3 |

### 7.1 적용 내용 (2026-09-01)

첫 번째와 두 번째 항목을 함께 적용했다.

`isExtensionContextValid()`가 `chrome.runtime?.id`로 무효화를 판정한다. 무효화된 context에서는 `chrome.runtime` 접근 자체가 던질 수 있어 `try`로 감싼다.

`reconcileNow()` 진입과 `scheduleUpdate()`에서 이를 확인하고, 무효화됐으면 `quiesce()`로 한 번만 알리고 멈춘다.

```text
이전: reconcile마다 getSettings() 실패 -> console.error 반복
이후: 최초 1회 console.info 후 관찰자·타이머·리스너 정리, 이후 조용
```

**주입한 UI는 제거하지 않는다.** 이것이 이번 변경의 핵심 판단이다. `writePlainText()`는 `chrome.*`를 전혀 쓰지 않으므로(실측: 참조 0건) **context가 죽어도 복사 버튼은 계속 동작한다.** 여기서 DOM을 걷어내면 아직 쓸 수 있는 기능까지 사용자에게서 빼앗는 셈이 된다. 갱신만 멈추고 남은 것은 그대로 둔다.

리스너 제거도 `chrome.*` 호출이라 무효화된 context에서는 던진다. `try`로 감싸고 조용히 넘긴다.

로그 수준을 `error`에서 `info`로 낮췄다. 이것은 확장의 결함이 아니라 확장을 재로드했을 때 정상적으로 일어나는 일이며, 사용자가 할 일(탭 새로고침)을 안내하는 문구를 포함한다.

회귀 테스트 2건을 추가했다. `chrome`이 없을 때, `runtime`이 없을 때, `id`가 사라졌을 때, **접근 자체가 던질 때** 모두 `false`를 돌려주는지 확인한다. 자동화 테스트 75건 통과.

**한계.** 이 변경은 증상만 없앤다. [Extension UI 미노출 분석](../extension-ui-visibility-recovery-analysis.md) 3.1절이 판정한 대로 **죽은 script를 되살릴 수는 없다.** 조용히 멈출 뿐이며 새 기능을 쓰려면 탭 새로고침이 여전히 필요하다.

## 8. 관련 자료

- [1차 조사 기록](./2026-09-01-reconcile-console-error.md)
- [Extension UI 미노출 분석](../extension-ui-visibility-recovery-analysis.md) — 2.3절에 같은 현상의 선행 관측
- [사후 기록 — 설정 쓰기 할당량 장애](../postmortems/2026-08-26-settings-write-quota-outage.md) — 3.4의 방어 코드가 추가된 배경
- `src/platform/runtime/createSiteRuntime.ts` — `reconcileNow()`
- `README.md` 문제 해결 절 — 확장 새로고침 후 탭 새로고침 안내
