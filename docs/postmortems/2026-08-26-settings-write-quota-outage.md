# 설정 쓰기 할당량 소진으로 전체 기능 중단

- 날짜: 2026-08-26
- 영향: 아마란스, Jira, Confluence 전체. 확장 UI가 아무 화면에도 주입되지 않음
- 발견 경로: 사용자가 "지금은 익스텐션이 아예 안뜨는데?"라고 알림
- 상태: 해결. 2026-08-26 사용자가 재로드 후 복구를 확인했다
- 배포: `v0.5.0`

## 1. 한 줄 요약

`getSettings()`가 읽을 때마다 저장소에 쓰고 있었고, 그 쓰기가 다시 reconcile을 유발하는 순환 구조에서 `chrome.storage.sync`의 시간당 쓰기 할당량이 소진됐다. 그 뒤로는 설정을 읽지 못했고, 예외 처리가 없어 모든 기능이 함께 죽었다.

## 2. 증상

| 항목 | 관측값 |
| --- | --- |
| 주입된 확장 root | 0개 |
| 아마란스 `.noti-details` | 존재 |
| 아마란스 `.myWorkTime` | 존재 |
| 아마란스 `.worktime ul.btns li` | 존재 |
| 확장 버튼 컨테이너 | 없음 |

DOM 앵커는 전부 정상인데 확장만 아무것도 하지 않는 상태였다.

콘솔에 남은 오류는 하나였다.

```text
Error: This request exceeds the MAX_WRITE_OPERATIONS_PER_HOUR quota.
  at chrome-extension://.../assets/writePlainText-BQXPFN4V.js
```

asset 이름은 `writePlainText`지만 번들 청크 이름일 뿐이고, 실제 호출자는 같은 청크에 묶인 `src/platform/settings/repository.ts`다.

## 3. 근본 원인

### 3.1 읽기 경로가 쓰기를 유발했다

수정 전 `getSettings()`는 다음과 같았다.

```ts
export async function getSettings(): Promise<ExtensionSettingsV1> {
  const stored = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  const settings = normalizeSettings(stored[SETTINGS_STORAGE_KEY]);

  if (JSON.stringify(stored[SETTINGS_STORAGE_KEY]) !== JSON.stringify(settings)) {
    await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
  }

  return settings;
}
```

정규화 결과를 저장소에 되써서 옛 키를 정리하려는 의도였다. 문제는 이 함수가 **매 reconcile마다** 호출된다는 점이다. `createSiteRuntime`의 `reconcileNow()`가 가장 먼저 하는 일이 `getSettings()`다.

### 3.2 쓰기가 다시 reconcile을 불렀다

```text
reconcile
  → getSettings()
  → stored ≠ normalized 이면 storage.sync.set()
  → chrome.storage.onChanged 발화
  → handleStorageChange() → scheduleUpdate()
  → reconcile
  → ...
```

`createSiteRuntime`은 `SETTINGS_STORAGE_KEY` 변경을 감시해 reconcile을 예약한다. 설정 변경을 다른 탭에 반영하기 위한 정상적인 설계다. 그런데 읽기가 쓰기를 유발하면 이 감시가 자기 자신을 되먹인다.

정상 상황에서는 첫 쓰기 후 `stored == normalized`가 되어 순환이 한 바퀴에 멈춘다. **쓰기가 실패하면 멈추지 않는다.** stored가 갱신되지 않으므로 조건이 계속 참이고, 매 reconcile이 다시 쓰기를 시도한다.

### 3.3 예외 처리가 없어 전체가 죽었다

```ts
reconciling = true;
try {
  settings = await getSettings();   // ← 여기서 reject되면
  ...                               //   아래 기능 주입이 전부 실행되지 않는다
} finally { ... }
```

`try`에 `catch`가 없었다. 할당량 초과로 `getSettings()`가 거부되면 그 아래 기능별 `reconcile()` 호출에 도달하지 못한다. 사이트별 런타임이 모두 같은 코드를 쓰므로 **세 사이트가 동시에** 아무것도 하지 않게 됐다.

이것이 "일부 기능이 이상하다"가 아니라 "아예 안 뜬다"로 나타난 이유다.

## 4. 트리거와 근본 원인의 구분

**트리거**는 이번 세션의 카탈로그 변경이다.

- `githubEnterprise` 사이트 추가
- `boardInspector` 기능 제거

둘 다 저장된 설정과 정규화 결과를 다르게 만든다. 즉 3.1의 조건문을 참으로 만든다.

**근본 원인은 트리거가 아니다.** 읽기 경로에서 쓰기를 하는 구조는 처음부터 있었고, 카탈로그를 바꿀 때마다 같은 조건이 성립한다. 이번이 아니어도 다음 기능 추가·삭제에서 재현될 구조였다.

## 5. 확인된 것과 추정

### 확인된 사실

- 콘솔에 `MAX_WRITE_OPERATIONS_PER_HOUR` 초과 오류가 기록됐다.
- `getSettings()`가 조건부로 `storage.sync.set()`을 호출하는 코드가 있었다.
- `handleStorageChange`가 `SETTINGS_STORAGE_KEY` 변경에 reconcile을 예약한다.
- `reconcileNow()`에 `getSettings()`를 감싸는 `catch`가 없었다.
- 장애 시점에 DOM 앵커는 정상이고 주입된 root만 0개였다.

### 추정

- **쓰기가 1800회에 도달한 정확한 경로는 확정하지 못했다.** 순환 구조와 잦은 재빌드·재로드가 겹친 결과로 보이지만, 각 요인의 기여도를 측정하지는 않았다. 할당량이 이미 소진된 뒤에 관측했기 때문에 소진 과정 자체는 재구성할 수 없었다.
- 확장 ID가 세션 중 `mjdbhoko...`에서 `pofjkocn...`으로 바뀐 것이 관측됐다. 재설치 또는 경로 변경으로 보이나 이번 장애와의 인과는 확인하지 않았다.

## 6. 조치

### 6.1 읽기에서 쓰기를 제거

`getSettings()`는 읽고 정규화해서 돌려주기만 한다. 정규화는 결정적이므로 저장하지 않아도 동작에 차이가 없다. 저장소에 남은 옛 키는 읽을 때마다 무시되고, 사용자가 설정을 바꾸는 순간 `saveSettings()`가 정리한다.

되쓰기로 얻으려던 것은 저장소 청소뿐이었고, 그 대가가 이번 장애였다.

### 6.2 설정 읽기 실패를 견디게

```ts
try {
  settings = await getSettings();
} catch (error) {
  console.error(`[Inno Extension] ${options.siteId} 설정을 읽지 못했습니다`, error);
  if (!settings) return;   // 최초 로드면 판단 근거가 없다
  // 직전 설정으로 계속한다
}
```

저장소가 일시적으로 실패해도 이미 붙어 있는 기능을 통째로 잃지 않는다.

### 6.3 회귀 테스트

`tests/unit.test.ts`에 3건을 추가했다. 핵심은 다음이다.

```text
저장된 값에 제거된 기능이 남아 정규화 결과와 다른 상태
  → getSettings() 3회 호출
  → 쓰기 횟수 === 0
```

`getSettings()`에 되쓰기를 되살리면 이 테스트가 실패한다. 저장값이 없을 때 기본값을 돌려주는 것, `saveSettings()`는 정상적으로 1회 쓰는 것도 함께 검증한다.

## 7. 배운 것

**자주 호출되는 읽기 함수에서 쓰기를 하지 않는다.** `getSettings()`는 이름이 `get`인데 부수효과가 있었다. 호출자는 매 reconcile마다 부담 없이 부를 수 있는 함수로 취급했고, 실제로 그렇지 않았다.

**변경 감시가 자기 쓰기를 되먹지 않는지 확인한다.** `onChanged → reconcile → write` 경로가 성립하면 순환이다. 정상 경로에서 한 바퀴에 수렴한다는 사실이 안전을 보장하지 않는다. 수렴을 방해하는 조건(여기서는 쓰기 실패)이 생기면 즉시 폭주한다.

**공통 경로의 예외 처리 부재는 국소 장애를 전면 장애로 키운다.** 저장소 하나가 실패했을 뿐인데 세 사이트의 모든 기능이 사라졌다.

**카탈로그 변경은 저장된 설정과의 불일치를 만든다.** 사이트나 기능을 추가·삭제할 때는 기존 저장값과 새 정규화 결과가 달라진다는 점을 항상 고려한다.

**진단은 콘솔부터.** 이번에 원인을 찾기 전 manifest 유효성, content script 파일 존재, `defaults.ts` 구조를 먼저 확인했다. 전부 정상이었고 시간만 썼다. 콘솔 오류 한 줄이 즉시 답을 줬다. **모든 사이트가 동시에 죽었다면 공통 경로를 의심하고 콘솔을 먼저 본다.**

## 8. 복구 확인과 남은 일

- [x] 확장 재로드 후 UI 복구 — 2026-08-26 사용자 확인. `v0.5.0`으로 배포됨
- [ ] 저장소에 남은 `boardInspector` 키가 설정 변경 시 실제로 정리되는지 확인

복구 시점에 시간당 쓰기 할당량이 아직 소진 상태였는지는 측정하지 않았다. 따라서 "할당량이
소진돼 있어도 즉시 복구된다"는 예상은 이번 사례로 입증되지 않았다. 읽기가 할당량 대상이
아니라는 사실에 근거한 추론으로 남긴다.

## 8.1 대응 시간

| 시점 | 사건 |
| --- | --- |
| — | 카탈로그 변경(사이트 추가·기능 제거)으로 저장값과 정규화 결과가 어긋남 |
| — | 쓰기 할당량 소진. 이후 모든 사이트에서 UI 미주입 |
| 발견 | 사용자가 "익스텐션이 아예 안뜨는데?"라고 알림 |
| 진단 | manifest·content script·defaults 확인(모두 정상) 후 콘솔에서 원인 확정 |
| 수정 | 되쓰기 제거 + 읽기 실패 방어 + 회귀 테스트 3건 |
| 확인 | 사용자 재로드 후 복구 확인 |

발견은 사용자 신고에 의존했다. 확장이 조용히 아무 일도 하지 않는 상태였기 때문에 자동으로
드러날 경로가 없었다. 이 종류의 무증상 실패를 스스로 알아차릴 방법은 이번 범위에서 다루지
않았다.

## 9. 관련 코드

- `src/platform/settings/repository.ts` — `getSettings()`, `saveSettings()`
- `src/platform/runtime/createSiteRuntime.ts` — `reconcileNow()`, `handleStorageChange()`
- `src/platform/settings/schema.ts` — `normalizeSettings()`
- `tests/unit.test.ts` — 저장소 쓰기 회귀 테스트
