# MR 제목 복사

- 사이트: GitLab (`rnd-app.innogrid.com`)
- 기능 ID: `mergeRequestTitleCopy`
- 기본값: ON

## 목적

Merge Request 제목을 다른 문서나 메신저로 옮길 때 제목과 주소를 각각 복사하는 과정을 없앤다. GitLab은 제목 옆에 복사 수단을 제공하지 않는다. 실측에서 제목 근처의 기본 복사 버튼은 `Copy branch name`뿐이었다.

## 적용 조건

- GitLab 서비스 전체 기능이 ON이다.
- `MR 제목 복사` 기능이 ON이다.
- 대상 origin이 `https://rnd-app.innogrid.com`이다.
- URL이 다음 중 하나다.

```text
/{namespace...}/-/merge_requests            목록
/{namespace...}/-/merge_requests/{번호}      상세
/{namespace...}/-/merge_requests/{번호}/*    상세 하위 탭도 포함
```

`namespace`는 중첩 그룹 때문에 깊이가 가변이다.

같은 사이트의 `커밋 번호 복사`는 **개요 탭만** 지원한다. 제목은 모든 하위 탭에 표시되므로 어디서든 복사할 수 있어야 하고, 커밋 목록은 개요 탭에만 있기 때문이다. 두 기능의 route 계약이 다른 것은 의도된 차이다.

## 사용자 경험

제목 옆에 버튼 두 개를 표시한다.

| 버튼 | 아이콘 | 복사 결과 |
| --- | --- | --- |
| MR 제목 Markdown 링크 복사 | clipboard | `[제목](URL)` |
| MR 제목만 복사 | 텍스트 기호 | `제목` |

두 버튼은 각자 피드백 타이머를 갖는다. 한쪽 체크 표시가 떠 있는 동안 다른 쪽을 눌러도 서로의 표시를 되돌리지 않는다.

목록에서는 제목 링크 안쪽 흐름에 놓이므로 클릭 시 MR로 이동하지 않도록 기본 동작과 전파를 모두 막는다.

## 클립보드 계약

### MR 제목만 복사

화면에 보이는 제목 그대로를 평문으로 기록한다.

```text
NPT-164 [CCP-BE] CCP -> Jazz kubeManagement 마이그레이션
```

- 앞뒤 공백을 제거하고 연속 공백을 하나로 합친다.
- **Markdown 이스케이프를 하지 않는다.** 링크가 아니므로 `[`, `]`를 그대로 둔다.
- 제목 안의 이슈 자동 링크(`NPT-164`)도 텍스트로 포함된다.

### MR 제목 Markdown 링크 복사

```text
[NPT-164 \[CCP-BE\] CCP -> Jazz kubeManagement 마이그레이션](https://rnd-app.innogrid.com/{namespace}/-/merge_requests/1)
```

- 제목의 `[`, `]`, `\`를 이스케이프한다. MR 제목에는 `[CCP-BE]` 같은 대괄호 접두사가 흔하다.
- URL에 괄호나 공백이 있으면 `<...>`로 감싼다.
- 목록의 상대 경로는 origin을 붙여 절대 URL로 만든다.
- 하위 탭 경로, 쿼리, fragment를 제거해 `/-/merge_requests/{번호}`만 남긴다.

정규화·이스케이프 로직은 `src/platform/clipboard/markdownLink.ts`를 GitHub Enterprise 기능과 공유한다.

## 기술적 맥락과 제약

### DOM 계약

| 대상 | selector |
| --- | --- |
| 상세 제목 | `h1.title[data-testid="title-content"]` |
| 목록 행 | `.issuable-list > li` |
| 목록 제목 링크 | `a[data-testid="issuable-title-link"]` |

상세 제목은 `detail-page-header` 안의 유일한 `h1`이다. 자식으로 이슈 자동 링크(`a.gfm`)를 포함할 수 있어 `textContent`로 읽는다.

제목 요소 안에 host가 들어가는 경우를 대비해, 제목을 읽을 때 복제본에서 host를 제거한 뒤 읽는다.

### 버튼 위치

상세에서는 제목 `h1`의 `afterend`에 넣는다. 부모가 flex 컨테이너이고 실측 시 제목 오른쪽에 185px 여유가 있었다.

### DOM 재생성

GitLab은 화면 전환과 목록 갱신에서 DOM을 다시 그린다. 복원된 host는 `isConnected`와 속성이 정상이라 속성만으로는 리스너 유무를 구분할 수 없다. 런타임이 직접 만든 host만 `WeakSet`으로 추적한다.

### 같은 사이트의 두 기능

`커밋 번호 복사`와 서로 다른 `FEATURE_ROOT_ATTRIBUTE` 값을 사용하고 앵커도 겹치지 않는다(제목 vs 커밋 번호 셀). 각자 자기 host만 조회·제거하므로 상호 간섭이 없다.

**같은 앵커에 두 기능이 host를 붙이면 안 된다.** `findExistingHost()`가 `anchor.nextElementSibling` 한 자리만 보기 때문에 서로의 host에 밀려 자기 것을 찾지 못하고, 매 reconcile마다 재생성된다. GitHub Enterprise에서 제목만 복사를 별도 기능으로 나누지 않고 같은 host에 버튼을 추가한 이유가 이것이다.

## 설정과 기본값

| 항목 | 값 |
| --- | --- |
| 서비스 기본값 | ON |
| 기능 기본값 | ON |
| 추가 옵션 | 없음 |

## 실패와 복구

| 상황 | 동작 |
| --- | --- |
| 클립보드 API 거부 | 공용 `writePlainText()`가 textarea 방식으로 대체 시도 |
| 대체까지 실패 | 버튼에 X 아이콘을 1.5초간 표시 |
| 제목이 비어 있음 | 버튼을 만들지 않는다 |
| MR URL을 정규화하지 못함 | 해당 행을 건너뛴다 |
| 지원 화면이 아님 | 기존 host를 모두 제거한다 |

## 수용 기준

- MR 목록의 각 행과 MR 상세에 버튼 두 개가 표시된다.
- 목록에서 버튼 클릭이 MR 이동을 유발하지 않는다.
- 링크 복사는 대괄호가 포함된 제목에서도 구조가 깨지지 않는다.
- 제목만 복사는 이스케이프 없이 화면 그대로를 복사한다.
- 기존 `커밋 번호 복사`가 영향받지 않는다.

## 검증 기준

- 자동화 테스트가 route 판정(목록·상세·하위 탭), URL 정규화, 두 복사 형식의 이스케이프 차이를 검증한다.
- 커밋 번호 복사 route가 개요 탭만 지원하는지도 함께 검증한다.
- 실제 화면에서의 버튼 표시와 복사 동작은 수동 확인이 필요하다. 2026-09-02 사용자가 동작을 확인했다.

## 알려진 리스크와 열린 질문

- `h1.title[data-testid="title-content"]`, `.issuable-list > li`, `a[data-testid="issuable-title-link"]`는 GitLab 내부 마크업이다. 버전이 올라가면 바뀔 수 있다.
- 실측 시 목록에 열린 MR이 1건뿐이어서 DOM 조사 단계에서는 여러 행을 확인하지 못했다.
- 상세 화면에서 버튼이 제목 줄바꿈에 어떻게 얹히는지는 실측하지 못했다.

## 변경 이력

- 2026-09-02: Merge Request 제목을 Markdown 링크 또는 평문으로 복사하는 기능을 추가했다. GitHub Enterprise의 PR 제목 복사와 같은 계약을 따른다.

## 관련 자료

- [제품 개요](../product-overview.md)
- [GitHub Enterprise PR 제목 링크 복사](./github-pull-request-title-copy.md) — 같은 목적의 자매 기능
- [GitLab 커밋 번호 복사](./gitlab-commit-sha-copy.md) — 같은 사이트의 다른 기능
