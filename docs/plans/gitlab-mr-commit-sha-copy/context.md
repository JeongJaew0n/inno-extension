# context — gitlab-mr-commit-sha-copy

## 사용자의 원 요청

> 기능 추가하자. 사이트추가해야해 gitlab. 주소는 위 참고.
> 기능은 commit 번호 복사 기능임.
> `.../merge_requests/1/commits` 여기들어가면 기본적으로 commit 복사 기능을 제공하긴하는데,
> commit tab을 들어가야해.
> 그래서 원하는건, overview 탭에서 보면 그 사람이 언제 어떤 commit 했는지 보여주는 화면에서
> commit 번호가 보이는데 여기에 commit 복사 버튼을 넣는거야.
> commit 번호 우측에 생기면 좋을 것 같아.
> 일단 분석해서 docs/plans에 넣어둬.

참조 URL: `https://rnd-app.innogrid.com/nativeplatformteam/cone-chain/cone-chain-backend/-/merge_requests/1`

## 왜 이걸 지금 하는가

MR Overview 탭의 `added N commits` 활동 항목에는 커밋 번호가 보이지만 복사 수단이 없다. GitLab이 제공하는 `Copy commit SHA` 버튼은 Commits 탭에만 있어서, 커밋 번호를 옮기려면 탭을 이동했다 돌아와야 한다.

Overview는 리뷰 중 가장 오래 머무는 화면이다. 거기서 바로 복사할 수 있으면 탭 왕복이 사라진다.

## 실측으로 확인한 사실

2026-08-26, 로그인된 실제 세션에서 확인했다.

### Overview 탭의 커밋 목록

`added 6 commits` 시스템 노트 안에 `ul > li` 목록이 있고, 각 `li`가 다음 구조다.

```text
li
  a.gfm.gfm-commit   ← 표시 텍스트 8자 단축 SHA
  " - 커밋 메시지"
```

`a.gfm.gfm-commit`의 속성은 다음과 같다.

| 속성 | 값 |
| --- | --- |
| `data-commit` | **40자 전체 SHA** |
| `data-original` | 8자 단축 SHA (표시 텍스트와 동일) |
| `data-reference-type` | `commit` |
| `data-project-path` | `nativeplatformteam/cone-chain/cone-chain-backend` |
| `title` | 커밋 메시지 |
| `href` | `/{경로}/-/merge_requests/1/diffs?commit_id={40자 SHA}` |

`href`에 `/commit/`이 없다. 커밋 상세가 아니라 MR diff의 특정 커밋으로 가는 링크다. **SHA는 `href`가 아니라 `data-commit`에서 읽어야 한다.**

### 결정적 발견 — 커밋 참조는 목록 밖에도 있다

| 위치 | `a.gfm.gfm-commit` 개수 |
| --- | --- |
| `added N commits` 시스템 노트 | 6 |
| **사용자 댓글 본문** | **6** |
| 합계 | 12 |

같은 클래스가 댓글 안 커밋 언급에도 붙는다. `a.gfm.gfm-commit`만으로 선택하면 사용자가 요청하지 않은 댓글 속 커밋 참조에도 버튼이 붙는다. **시스템 노트로 범위를 좁혀야 한다.**

### GitLab 기본 버튼이 복사하는 값

Commits 탭의 기본 버튼을 확인했다.

| 항목 | 값 |
| --- | --- |
| `title` | `Copy commit SHA` |
| `aria-label` | `Copy commit SHA {8자 SHA}` |
| `data-clipboard-text` | **40자 전체 SHA** |
| 개수 | 7 (Commits 탭 배지 숫자와 일치) |

즉 GitLab의 관례는 **전체 SHA 복사**다.

### 라우트

| 항목 | 값 |
| --- | --- |
| Overview URL | `/{namespace...}/-/merge_requests/{iid}` |
| namespace 깊이 | **3** (`nativeplatformteam/cone-chain/cone-chain-backend`) |
| `body[data-page]` | `projects:merge_requests:show` |

GitHub Enterprise는 `{owner}/{repo}` 2단 고정이지만 **GitLab namespace는 중첩 그룹이라 깊이가 가변**이다. 이번 대상만 해도 3단이다. route 판정에서 깊이를 고정하면 안 된다.

## 결정된 방향

- 대상은 MR **Overview 탭의 `added N commits` 목록**이다.
- 버튼은 커밋 번호 **오른쪽**에 붙인다.
- 복사 값은 **40자 전체 SHA**로 한다. GitLab 기본 버튼과 같은 값이어야 사용자가 두 경로를 구분할 필요가 없다.
- SHA는 `data-commit`에서 읽는다. 표시 텍스트(8자)나 `href` 파싱에 의존하지 않는다.

## 기각된 대안

**단축 SHA(8자) 복사** — 화면에 보이는 값과 같아 직관적이지만 GitLab 기본 버튼과 다른 값이 된다. 같은 화면에서 두 버튼이 다른 결과를 주면 혼란스럽다. 전체 SHA는 어디서든 유효하지만 단축 SHA는 저장소에 따라 충돌할 수 있다.

**`a.gfm.gfm-commit` 전체 선택** — 구현은 가장 단순하지만 댓글 속 커밋 참조 6건에도 버튼이 붙는다. 요청 범위를 넘는다.

**Markdown 링크 형식 복사** — GitHub Enterprise 기능과 형식을 맞추는 방법이지만, 요청은 "commit 번호 복사"다. GitLab 기본 버튼도 SHA만 복사한다.

**`href`의 `commit_id` 쿼리에서 SHA 추출** — 값은 같지만 링크 구조 변경에 취약하다. `data-commit`이 더 직접적이다.

## 제약 / 합의 사항

- 새 사이트가 하나 더 늘어난다. `manifest.json`에 `rnd-app.innogrid.com` origin이 추가된다. 현재 지원 사이트는 아마란스, Jira, Confluence, GitHub Enterprise 4개다.
- 공용 런타임 계약(`FeatureRuntime.reconcile`/`dispose`)을 따른다. 기능별 `MutationObserver`를 두지 않는다.
- Shadow DOM과 `style.all = 'initial'`로 격리한다. CSS 커스텀 속성은 이 경계를 통과하므로 GitLab 테마 변수를 쓸 수 있다.
- 클립보드는 공용 `writePlainText()`를 사용한다.
- 사용자 문서를 변경하지 않는다. 읽기와 버튼 주입만 한다.

## 열린 질문 — 해소 결과

1. **댓글 속 커밋 참조에도 버튼을 붙일지** → **제외.** 사용자 결정(2026-08-26): "댓글 속 커밋 참조에는 필요 없어." `.system-note`로 범위를 한정하고 회귀 테스트로 고정했다.

2. **Commits 탭의 `data-page` 값** → **Overview와 동일**하게 `projects:merge_requests:show`였다. **`data-page`로는 탭을 구분할 수 없으므로 URL 경로로 판정한다.**

   덤으로 Commits 탭에는 `a.gfm.gfm-commit`과 `.system-note`가 각각 0개였다. route 판정이 없더라도 DOM 자체가 걸리지 않는다. 다만 의도를 명시하기 위해 route 게이트는 유지한다.

3. **`Toggle commit list` 접힘 동작** → **부분 확인.** 텍스트는 페이지에 존재하지만 `button`/`a`/`[role=button]` 조회로는 잡히지 않았다. 측정 시점에 목록 6개는 모두 보이는 상태였고 `max-height: none`, `overflow: visible`이었다. 접힘 시 동작은 미확인이나, 목록이 사라지면 host도 제거되고 다시 나타나면 재생성되는 것이 reconcile 설계상 자연스러운 결과다.

4. **여러 개의 `added N commits` 노트** → **미확인.** MR !2를 확인했으나 시스템 노트가 0개인 신규 draft라 검증할 수 없었다. 구현은 모든 시스템 노트를 순회하므로 자연히 처리된다.

## 관련 자료

- [GitHub Enterprise PR 제목 링크 복사 Spec](../../../spec/features/github-pull-request-title-copy.md) — 직전에 같은 방식으로 추가한 사이트. 구조를 그대로 참고한다.
- [제품 개요](../../../spec/product-overview.md)
- [사후 기록](../../postmortems/README.md) — 카탈로그 변경이 저장된 설정과 어긋나 장애를 만든 사례. 사이트 추가 시 확인한다.

## 현재 상태 — 2026-08-26

구현 완료. 자동화 테스트 69건 통과, 빌드 통과. **브라우저 실측 검증은 아직.**
