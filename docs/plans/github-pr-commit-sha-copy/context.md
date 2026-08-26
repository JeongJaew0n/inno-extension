# context — github-pr-commit-sha-copy

## 사용자의 원 요청

> git hub에도 방금 만든 비슷한 기능 넣고 싶음.
> Conversation 탭 `.../pull/292` 여기서 보이는 commit 번호 우측에 복사 버튼 넣고 싶음.
> 기능은 `.../pull/292/commits` 여기의 commits 탭에서 되는 복사기능과 동일한 기능 넣고 싶음.
> 분석해서 plan

참조 URL: `https://github.nhnent.com/inje/be-cloudstation-veritas-api/pull/292`

## 왜 이걸 지금 하는가

GitLab에 넣은 `커밋 번호 복사`와 같은 문제다. GitHub Enterprise도 Commits 탭에만 복사 버튼이 있고 Conversation 탭에는 없다. 리뷰 중 가장 오래 머무는 화면에서 커밋 번호를 옮기려면 탭을 이동했다 돌아와야 한다.

실측으로 이 공백을 확인했다.

| 탭 | 기본 복사 버튼 |
| --- | --- |
| Commits (`/pull/292/commits`) | **10개** |
| Conversation (`/pull/292`) | **0개** |

## GitLab 작업과의 차이

**사이트 추가가 필요 없다.** `githubEnterprise`는 이미 등록된 사이트다. `pullRequestTitleCopy`에 이어 **두 번째 기능**을 붙이는 작업이다. GitLab 때 필요했던 catalog 사이트 등록, favicon, manifest origin 추가가 모두 생략된다.

기능 자체의 계약은 GitLab과 사실상 같다. 전체 SHA 복사, 커밋 번호 오른쪽 배치, 공용 런타임과 Shadow DOM.

## 실측으로 확인한 사실

2026-08-26, 로그인된 실제 세션에서 확인했다.

### Conversation 탭의 커밋 행 구조

```text
div.js-details-container.Details
  div.d-flex.flex-md-row
    div.d-flex.flex-auto
      div.text-right.ml-1        ← 커밋 번호 셀
        code
          a.Link--secondary      ← 표시 7자, href에 40자 전체 SHA
```

| 항목 | 값 |
| --- | --- |
| 커밋 링크 수 | 10 (Commits 탭 배지와 일치) |
| 표시 텍스트 | 7자 단축 SHA |
| `href` | `/{owner}/{repo}/pull/{번호}/commits/{40자 SHA}` |
| 모두 `.TimelineItem` 안 | 예 (10/10) |
| 셀 자식 | `code` 하나뿐 |

**전체 SHA는 `href` 끝에 있다.** GitLab이 `data-commit` 속성에 담았던 것과 달리 GitHub은 링크 경로에 담는다.

### 기본 복사 버튼이 하는 일

Commits 탭에서 확인했다.

| 항목 | 값 |
| --- | --- |
| `aria-label` | `Copy full SHA for 1bb0ce4` |
| 클래스 | `CopyToClipboardButton-module__tooltip--...` |
| 복사 값 | **40자 전체 SHA** |
| 값의 위치 | **DOM 속성에 없음.** React 컴포넌트 내부 상태 |

이름 그대로 `full SHA`를 복사한다. 사용자가 "동일한 기능"이라 했으므로 **40자 전체 SHA**가 복사 값이다. GitLab 기능과도 일치한다.

값이 DOM에 없다는 점은 우리 구현에는 영향이 없다. 우리는 `href`에서 읽는다.

### 결정적 발견 1 — 댓글 범위 문제가 없다

GitLab에서는 커밋 참조 링크가 시스템 노트와 사용자 댓글 양쪽에 같은 클래스로 나타나 범위를 좁혀야 했다. GitHub은 다르다.

| 위치 | 개수 |
| --- | --- |
| 타임라인 커밋 행 | 10 |
| **댓글 본문** | **0** |

`.comment-body`, `.js-comment-body` 안에는 이 형태의 링크가 없다. GitLab에서 필요했던 추가 범위 한정이 여기서는 불필요하다.

### 결정적 발견 2 — Commits 탭에서 중복될 위험이 있다

같은 selector를 route 게이트 없이 쓰면 Commits 탭에서도 걸린다.

| selector | Conversation | Commits |
| --- | --- | --- |
| `a[href*="/commits/"]` + 7자 텍스트 | 10 | **10** |
| 위 + `.TimelineItem` 안 | 10 | **0** |
| 위 + `.text-right` 셀 안 | 10 | **0** |

Commits 탭에는 이미 기본 버튼이 10개 있으므로, 여기에 우리 버튼이 붙으면 같은 일을 하는 버튼이 두 개가 된다.

`.TimelineItem` 또는 `.text-right` 스코프만으로도 Commits 탭은 자연히 배제되지만, 의도를 명시하기 위해 route 게이트도 함께 둔다.

### 결정적 발견 3 — 기존 route 계약을 재사용할 수 없다

`src/sites/githubEnterprise/routes.ts`의 `PULL_DETAIL_PATTERN`은 하위 탭을 포함한다.

```text
/inje/repo/pull/292          -> detail 로 매칭됨
/inje/repo/pull/292/commits  -> detail 로 매칭됨
/inje/repo/pull/292/files    -> detail 로 매칭됨
```

`pullRequestTitleCopy`에는 의도된 동작이다. 제목은 모든 하위 탭에 표시되므로 어디서든 복사할 수 있어야 한다.

그러나 이번 기능은 **Conversation 탭 전용**이다. 기존 `parseGithubEnterpriseRoute`를 그대로 쓰면 Commits 탭에서도 통과한다. **별도의 Conversation 전용 판정이 필요하다.**

### 레이아웃 제약

커밋 번호 셀은 우측 정렬이고 행 오른쪽 끝과 딱 붙어 있다.

| 항목 | 값 |
| --- | --- |
| 셀 클래스 | `text-right ml-1` |
| 셀 오른쪽 여백 | **0px** (행 오른쪽 끝과 동일) |
| 셀 폭 | 51px |

버튼을 셀 안 `code` 뒤에 넣으면 셀이 우측 정렬이므로 **커밋 번호가 왼쪽으로 밀리고 버튼이 오른쪽 끝을 차지한다.** 행 폭은 flex 컨테이너가 정하므로 넘치지 않는다. 요청("commit 번호 우측")과도 맞는다.

## 결정된 방향

- `githubEnterprise` 사이트에 **두 번째 기능** `commitShaCopy`를 추가한다.
- 대상은 **PR Conversation 탭의 타임라인 커밋 행**이다.
- SHA는 **`href`의 마지막 40자 세그먼트**에서 읽는다.
- 복사 값은 **40자 전체 SHA**. GitHub 기본 버튼, GitLab 기능과 모두 일치한다.
- 버튼은 `div.text-right.ml-1` 안 `code` 뒤에 넣는다.
- Conversation 전용 route 판정을 새로 만든다. 기존 `detail` 판정을 재사용하지 않는다.

## 기각된 대안

**기존 `parseGithubEnterpriseRoute`의 `detail` 재사용** — 구현은 짧아지지만 Commits 탭에서도 통과해 기본 버튼과 중복된다.

**단축 SHA(7자) 복사** — 화면 표시와 같지만 GitHub 기본 버튼이 `Copy full SHA`라는 이름으로 전체를 복사한다. 사용자가 "동일한 기능"을 요청했으므로 전체 SHA가 맞다.

**DOM 스코프만으로 Commits 탭 배제** — 실측상 `.TimelineItem` 스코프면 Commits 탭에서 0개라 동작은 한다. 그러나 GitHub이 마크업을 바꾸면 조용히 중복이 생긴다. route 게이트가 명시적 안전장치다.

**`pullRequestTitleCopy`에 흡수** — 두 기능은 대상 화면과 복사 값이 다르다. Popup에서 따로 켜고 끌 수 있어야 한다.

## 제약 / 합의 사항

- 새 사이트나 새 origin이 추가되지 않는다. `manifest.json`은 건드리지 않는다.
- 공용 런타임 계약(`reconcile`/`dispose`)을 따른다.
- Shadow DOM과 `style.all = 'initial'`로 격리한다.
- 클립보드는 공용 `writePlainText()`를 사용한다.
- GitHub Enterprise는 Turbo를 쓴다. 캐시 복원으로 리스너를 잃은 host를 걸러내는 `WeakSet` 추적이 필요하다. `pullRequestTitleCopy`와 같은 이유다.

## 열린 질문

1. **기능 ID 충돌** → **`githubCommitShaCopy`로 구분.** 사용자 결정(2026-08-26). `FEATURE_IDS`가 사이트를 가로지르는 단일 목록이므로 이름만으로 어느 사이트 기능인지 드러나게 한다.
2. **커밋 행 그룹.** 실측 MR에서는 `added 5 commits` 묶음과 단독 커밋 행이 섞여 있었다. 두 형태 모두 같은 구조인지 확인이 필요하다.
3. **상태 아이콘.** 일부 행에 체크·X 아이콘이 SHA 왼쪽에 있다. 셀 밖이라 영향 없어 보이지만 버튼 삽입 후 정렬 확인이 필요하다.

## 관련 자료

- [GitLab 커밋 번호 복사 계획](../gitlab-mr-commit-sha-copy/spec.md) — 같은 성격의 직전 작업
- [GitLab 커밋 번호 복사 Spec](../../../spec/features/gitlab-commit-sha-copy.md)
- [GitHub Enterprise PR 제목 링크 복사 Spec](../../../spec/features/github-pull-request-title-copy.md) — 같은 사이트의 기존 기능

## 현재 상태 — 2026-08-26

구현 완료, 사용자 동작 확인 완료. 자동화 테스트 73건 통과.

열린 질문 2·3번(커밋 행 그룹 형태, 상태 아이콘 정렬)은 실측하지 못했다.
