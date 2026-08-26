# 커밋 번호 복사 (GitHub Enterprise)

- 사이트: GitHub Enterprise (`github.nhnent.com`)
- 기능 ID: `githubCommitShaCopy`
- 기본값: ON

## 목적

PR Conversation 탭에서 커밋 번호를 바로 복사한다. GitHub이 제공하는 `Copy full SHA` 버튼은 Commits 탭에만 있어서, 커밋 번호를 옮기려면 탭을 이동했다 돌아와야 한다.

실측으로 확인한 공백은 다음과 같다.

| 탭 | GitHub 기본 복사 버튼 |
| --- | --- |
| Commits | 10개 |
| Conversation | **0개** |

## 적용 조건

- GitHub Enterprise 서비스 전체 기능이 ON이다.
- `커밋 번호 복사` 기능이 ON이다.
- URL이 PR Conversation 탭이다.

```text
/{owner}/{repo}/pull/{번호}
```

끝 슬래시만 허용한다. **하위 탭은 모두 제외한다.**

```text
/pull/{번호}/commits   제외
/pull/{번호}/files     제외
/pull/{번호}/checks    제외
```

`/commits` 제외가 특히 중요하다. 그곳에는 GitHub 기본 버튼이 이미 있어 우리 버튼이 붙으면 같은 일을 하는 버튼이 두 개가 된다.

같은 사이트의 `PR 제목 링크 복사`는 하위 탭을 **포함**한다. 제목은 모든 탭에 표시되므로 어디서든 복사할 수 있어야 하기 때문이다. 두 기능의 route 계약이 다른 것은 의도된 차이다.

## 사용자 경험

Conversation 탭 타임라인의 커밋 행에서, 각 커밋 번호 **오른쪽**에 20x20 아이콘 버튼을 표시한다.

클릭하면 커밋 번호를 복사하고 1.5초간 체크 아이콘으로 바뀐다. 실패하면 X 아이콘을 같은 시간 동안 표시한다.

버튼은 커밋 링크 바로 옆이므로 클릭 시 링크 이동이 일어나지 않도록 기본 동작과 전파를 모두 막는다.

## 클립보드 계약

plain text 한 가지만 기록한다.

```text
1bb0ce4a2f... (40자 전체 SHA)
```

화면에 보이는 텍스트는 7자 단축 SHA이지만 복사 값은 40자 전체다. GitHub 기본 버튼의 이름이 `Copy full SHA for {단축}`이며 전체를 복사하므로 같은 값을 유지한다. GitLab `커밋 번호 복사`와도 일치한다.

## 기술적 맥락과 제약

### DOM 계약

실측한 커밋 행 구조는 다음과 같다.

```text
div.text-right.ml-1        커밋 번호 셀 (우측 정렬)
  code
    a[href]                표시 7자, href에 40자 전체 SHA
```

| 대상 | selector |
| --- | --- |
| 타임라인 항목 | `.TimelineItem` |
| 커밋 번호 셀 | `.text-right` |
| 커밋 링크 | 셀 안의 `a[href]` |

**SHA는 `href`의 마지막 세그먼트에서 읽는다.** `/pull/{번호}/commits/{40자}` 형태다. 표시 텍스트(7자)는 사용하지 않는다. GitLab이 `data-commit` 속성에 담는 것과 달리 GitHub은 링크 경로에 담는다.

GitHub 기본 버튼은 복사 값을 DOM 속성에 두지 않는다. React 컴포넌트 내부 상태다. 우리 구현은 `href`에서 읽으므로 영향받지 않는다.

### Commits 탭 이중 배제

같은 형태의 커밋 링크가 Commits 탭에도 있다.

| selector | Conversation | Commits |
| --- | --- | --- |
| `href` + 7자 텍스트 | 10 | **10** |
| 위 + `.TimelineItem` | 10 | **0** |

`.TimelineItem` 스코프만으로도 배제되지만, GitHub이 마크업을 바꾸면 조용히 중복이 생긴다. route 판정을 함께 두어 의도를 명시한다.

### 버튼 위치

커밋 번호 셀은 우측 정렬이고 행 오른쪽 끝과 여백 0px로 붙어 있다. 셀 안 `code` **뒤**에 버튼을 넣으면 커밋 번호가 왼쪽으로 밀리고 버튼이 오른쪽 끝을 차지한다. 행 폭은 flex 컨테이너가 정하므로 넘치지 않는다.

### Turbo 캐시 복원

GitHub Enterprise는 Turbo를 사용한다. 캐시된 DOM이 복원되면 host가 클릭 리스너 없이 되살아나고, `isConnected`와 속성이 모두 정상이라 속성만으로는 구분할 수 없다. 런타임이 직접 만든 host만 `WeakSet`으로 추적하고, 그 집합에 없는 host는 제거한 뒤 다시 만든다. `PR 제목 링크 복사`와 같은 대응이다.

### 같은 사이트의 두 기능

`PR 제목 링크 복사`와 서로 다른 `FEATURE_ROOT_ATTRIBUTE` 값을 사용한다. 각자 자기 host만 조회하고 제거하므로 한 기능을 꺼도 다른 기능에 영향이 없다.

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
| `href`에서 40자 SHA를 얻지 못함 | 해당 항목을 건너뛴다 |
| 지원 화면이 아님 | 기존 host를 모두 제거한다 |

## 수용 기준

- Conversation 탭 타임라인의 커밋 번호마다 버튼이 하나씩 표시된다.
- 버튼이 커밋 번호 오른쪽에 위치한다.
- 복사 결과가 40자 전체 SHA이며 GitHub 기본 버튼 결과와 같다.
- 버튼 클릭이 커밋 링크 이동을 유발하지 않는다.
- **Commits 탭에는 버튼이 붙지 않는다.**
- `PR 제목 링크 복사`가 영향받지 않는다.

## 검증 기준

- 자동화 테스트가 Conversation route 판정(하위 탭 제외), `href` SHA 추출, Commits 탭 배제를 검증한다.
- 기존 PR 상세 route가 하위 탭을 계속 포함하는지도 함께 검증한다.
- 실제 화면에서의 버튼 표시와 복사 동작은 수동 확인이 필요하다. 2026-08-26 사용자가 동작을 확인했다.

## 알려진 리스크와 열린 질문

- `.TimelineItem`, `.text-right`는 GitHub 내부 마크업이다. 버전이 올라가면 바뀔 수 있다.
- `added N commits` 묶음 행과 단독 커밋 행이 같은 구조인지 실측하지 못했다.
- 상태 아이콘(체크·X)이 있는 행에서의 정렬은 실측하지 못했다.
- 커밋 번호가 왼쪽으로 밀리는 정도가 시각적으로 자연스러운지 확인이 필요하다.

## 변경 이력

- 2026-08-26: PR Conversation 탭 타임라인의 커밋 번호를 전체 SHA로 복사하는 기능을 추가했다. Commits 탭은 기본 버튼과의 중복을 피해 제외했다.

## 관련 자료

- [제품 개요](../product-overview.md)
- [GitLab 커밋 번호 복사](./gitlab-commit-sha-copy.md) — 같은 목적의 자매 기능
- [GitHub Enterprise PR 제목 링크 복사](./github-pull-request-title-copy.md) — 같은 사이트의 다른 기능
- [구현 계획](../../docs/plans/github-pr-commit-sha-copy/spec.md)
