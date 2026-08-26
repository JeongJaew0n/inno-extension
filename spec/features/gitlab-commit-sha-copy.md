# 커밋 번호 복사

- 사이트: GitLab (`rnd-app.innogrid.com`)
- 기능 ID: `commitShaCopy`
- 기본값: ON

## 목적

Merge Request 개요 탭에서 커밋 번호를 바로 복사한다. GitLab이 제공하는 `Copy commit SHA` 버튼은 Commits 탭에만 있어서, 커밋 번호를 옮기려면 탭을 이동했다 돌아와야 한다. 개요는 리뷰 중 가장 오래 머무는 화면이므로 거기서 끝낸다.

## 적용 조건

- GitLab 서비스 전체 기능이 ON이다.
- `커밋 번호 복사` 기능이 ON이다.
- 대상 origin이 `https://rnd-app.innogrid.com`이다.
- URL이 Merge Request 개요 화면이다.

```text
/{namespace...}/-/merge_requests/{번호}
```

`namespace`는 중첩 그룹 때문에 **깊이가 가변**이다. 실측 대상은 `nativeplatformteam/cone-chain/cone-chain-backend`로 3단이었다. 세그먼트 수를 고정하지 않는다.

`/commits`, `/diffs`, `/pipelines` 같은 하위 탭은 대상이 아니다. Commits 탭에는 GitLab 기본 복사 버튼이 이미 있다.

## 사용자 경험

개요 탭의 `added N commits` 시스템 노트 안 커밋 목록에서, 각 커밋 번호 **오른쪽**에 20x20 아이콘 버튼을 표시한다.

클릭하면 커밋 번호를 복사하고 1.5초간 체크 아이콘으로 바뀐다. 실패하면 X 아이콘을 같은 시간 동안 표시한다.

버튼은 커밋 링크 바로 옆에 놓이므로 클릭 시 링크 이동이 일어나지 않도록 기본 동작과 전파를 모두 막는다.

## 클립보드 계약

plain text 한 가지만 기록한다.

```text
7b2946c5a1... (40자 전체 SHA)
```

화면에 보이는 텍스트는 8자 단축 SHA이지만 **복사 값은 40자 전체 SHA**다. GitLab이 Commits 탭에서 제공하는 기본 버튼도 `data-clipboard-text`에 전체 SHA를 담는다. 같은 MR 안에서 두 버튼이 다른 값을 주면 혼란스러우므로 GitLab 관례를 따른다. 전체 SHA는 어디서든 유효하지만 단축 SHA는 저장소가 커지면 충돌할 수 있다.

## 기술적 맥락과 제약

### DOM 계약

| 대상 | selector | 비고 |
| --- | --- | --- |
| 시스템 노트 | `.system-note` | 댓글과 구분하는 경계 |
| 커밋 참조 링크 | `a.gfm.gfm-commit` | 시스템 노트 안으로 한정 |
| 전체 SHA | `data-commit` 속성 | 40자 |

**SHA는 반드시 `data-commit`에서 읽는다.** 표시 텍스트는 8자 단축본이고, `href`는 커밋 상세가 아니라 `/-/merge_requests/{번호}/diffs?commit_id={SHA}` 형태라 `/commit/` 경로를 포함하지 않는다.

### 댓글 커밋 참조를 제외하는 이유

커밋 참조 링크는 시스템 노트와 사용자 댓글 양쪽에 **같은 클래스**로 나타난다. 실측에서 개요 탭의 `a.gfm.gfm-commit` 12개 중 6개가 댓글 안이었다.

| 위치 | 개수 |
| --- | --- |
| `added N commits` 시스템 노트 | 6 |
| 사용자 댓글 본문 | 6 |

댓글 속 커밋 언급은 복사 대상이 아니라는 사용자 결정에 따라 `.system-note` 안으로 범위를 한정한다. 이 경계는 회귀 테스트로 고정한다.

### DOM 재생성

GitLab은 화면 전환과 활동 갱신에서 DOM을 다시 그린다. 복원된 host는 `isConnected`와 속성이 모두 정상이라 속성만으로는 클릭 리스너 유무를 구분할 수 없다. 런타임이 직접 만든 host만 `WeakSet`으로 추적하고, 그 집합에 없는 host는 제거한 뒤 다시 만든다.

### 스타일

host는 Shadow DOM을 사용하고 `style.all = 'initial'`로 페이지 스타일 상속을 끊는다. CSS 커스텀 속성은 이 경계를 통과하므로 GitLab의 `--gl-*` 변수를 그대로 사용해 테마를 따라간다. 변수가 없는 환경을 위해 리터럴 fallback을 함께 둔다.

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
| `data-commit`이 40자 전체 SHA가 아님 | 해당 항목을 건너뛴다 |
| 지원 화면이 아님 | 기존 host를 모두 제거한다 |

## 수용 기준

- 개요 탭 `added N commits` 목록의 커밋 번호마다 버튼이 하나씩 표시된다.
- 버튼이 커밋 번호 오른쪽에 위치한다.
- 복사 결과가 40자 전체 SHA이며 GitLab 기본 버튼 결과와 같다.
- 버튼 클릭이 커밋 링크 이동을 유발하지 않는다.
- 사용자 댓글의 커밋 참조에는 버튼이 붙지 않는다.
- Commits 탭에는 버튼이 붙지 않는다.

## 검증 기준

- 자동화 테스트가 route 판정(가변 namespace 깊이, 하위 탭 제외), SHA 정규화, 시스템 노트 범위 한정을 검증한다.
- 실제 화면에서의 버튼 표시와 복사 동작은 수동 확인이 필요하다. 2026-08-26 사용자가 동작을 확인했다.

## 알려진 리스크와 열린 질문

- `.system-note`, `a.gfm.gfm-commit`, `data-commit`은 GitLab 내부 마크업이다. 버전이 올라가면 바뀔 수 있다.
- `added N commits` 노트가 여러 개인 MR에서의 동작은 실측하지 못했다. 구현은 모든 시스템 노트를 순회하므로 자연히 처리되지만 확인이 필요하다.
- `Toggle commit list` 접기 동작 중 버튼 상태는 실측하지 못했다. 목록이 사라지면 host도 제거되고 다시 나타나면 재생성되는 것이 설계 의도다.
- 댓글 커밋 참조 지원은 현재 범위 밖이다. 사용 관찰 후 재검토한다.
- 다른 GitLab 인스턴스는 지원하지 않는다.

## 변경 이력

- 2026-08-26: MR 개요 탭의 커밋 목록에서 전체 SHA를 복사하는 기능을 추가했다. 사용자 댓글의 커밋 참조는 범위에서 제외했다.

## 관련 자료

- [제품 개요](../product-overview.md)
- [용어사전](../glossary.md)
- [구현 계획](../../docs/plans/gitlab-mr-commit-sha-copy/spec.md)
