# spec — gitlab-mr-commit-sha-copy

## 목표

GitLab MR Overview 탭의 `added N commits` 목록에서, 커밋 번호 오른쪽의 버튼 한 번으로 전체 커밋 SHA를 복사한다. Commits 탭으로 이동하지 않고 Overview에서 끝낸다.

## 범위

### 포함

- 새 사이트 `gitlab` 추가 (`rnd-app.innogrid.com`)
- 새 기능 `commitShaCopy`
- MR Overview 탭의 `added N commits` 시스템 노트 안 커밋 목록
- 각 커밋 번호 오른쪽에 복사 버튼 주입
- 40자 전체 SHA를 plain text로 복사

### 제외

- 사용자 댓글 본문의 커밋 참조 (실측 6건 존재, 열린 질문 1번)
- Commits 탭 — GitLab 기본 버튼이 이미 제공한다
- Changes 탭, Pipelines 탭
- MR 외의 화면 (커밋 목록, 저장소 조회, 이슈)
- `rnd-app.innogrid.com` 외의 GitLab 인스턴스
- 커밋 메시지나 링크 복사 — 이번 요청은 번호만이다

## 완료 조건

- [ ] Overview 탭 `added N commits` 목록의 커밋 번호마다 버튼이 하나씩 표시된다
- [ ] 버튼이 커밋 번호 오른쪽에 위치한다
- [ ] 클릭하면 40자 전체 SHA가 클립보드에 들어간다
- [ ] 복사 성공·실패 피드백이 보인다
- [ ] 버튼 클릭이 커밋 링크 이동을 유발하지 않는다
- [ ] 댓글 본문의 커밋 참조에는 버튼이 붙지 않는다
- [ ] Commits 탭 등 범위 밖 화면에는 버튼이 붙지 않는다
- [ ] Popup에 GitLab이 다섯 번째 사이트로 표시되고 기능을 켜고 끌 수 있다
- [ ] 기능을 끄면 주입한 버튼이 모두 사라진다
- [ ] 자동화 테스트가 route 판정과 SHA 추출을 검증한다

## 인터페이스 / 데이터 형식

### 클립보드

40자 전체 SHA를 plain text 한 가지로 기록한다. GitLab 기본 `Copy commit SHA` 버튼과 같은 값이다.

```text
7b2946c5... (40자)
```

`text/html`은 기록하지 않는다.

### DOM 계약

| 대상 | selector | 비고 |
| --- | --- | --- |
| 시스템 노트 | `.system-note` | 댓글과 구분하는 경계 |
| 커밋 참조 링크 | `a.gfm.gfm-commit` | 시스템 노트 안으로 한정 |
| 전체 SHA | `data-commit` 속성 | 40자. 표시 텍스트는 8자 |
| 커밋 항목 | 링크의 부모 `li` | |

**SHA는 반드시 `data-commit`에서 읽는다.** 표시 텍스트는 8자 단축본이고, `href`는 `/commit/`이 아니라 `/-/merge_requests/{iid}/diffs?commit_id={SHA}` 형태다.

### 라우트

```text
/{namespace...}/-/merge_requests/{iid}
```

- `namespace`는 **깊이가 가변**이다. 중첩 그룹 때문에 실측 대상은 3단이다. 고정 세그먼트 수를 가정하지 않는다.
- `{iid}`는 숫자다.
- `/commits`, `/diffs`, `/pipelines` 같은 하위 경로는 제외한다.

`body[data-page="projects:merge_requests:show"]`를 보조 판정에 쓸 수 있는지는 Commits 탭 값을 확인한 뒤 결정한다 (열린 질문 4번).

### 버튼

- 커밋 번호 링크 `afterend`에 삽입
- Shadow DOM + `style.all = 'initial'`
- GitLab CSS 커스텀 속성 사용, 리터럴 fallback 병기
- 아이콘 버튼. 복사 완료 시 체크, 실패 시 X를 잠시 표시

## 의존성

### 새로 만드는 것

```text
src/sites/gitlab/
  routes.ts                              MR Overview route 판정
  selectors.ts                           DOM 계약
  content.ts                             진입점
  features/commitShaCopy/clipboard.ts    SHA 검증과 클립보드
  features/commitShaCopy/runtime.ts      버튼 주입
src/popup/assets/gitlab-favicon.png
spec/features/gitlab-commit-sha-copy.md
```

### 고치는 것

| 파일 | 변경 |
| --- | --- |
| `src/catalog/types.ts` | `SITE_IDS`에 `gitlab`, `FEATURE_IDS`에 `commitShaCopy` |
| `src/catalog/sites.ts` | 사이트 서술 추가 |
| `src/platform/settings/defaults.ts` | 기본 설정 추가 |
| `src/popup/main.ts` | `SITE_ICON_URLS`에 항목 추가 (`Record<SiteId, string>`이라 누락 시 컴파일 오류) |
| `manifest.json` | `https://rnd-app.innogrid.com/*` content script |
| `tests/unit.test.ts` | route·SHA 추출 테스트 |
| `README.md`, `spec/product-overview.md`, `spec/README.md` | 기능표·변경 이력·문서 목록 |

### 재사용

- `createSiteRuntime` — 사이트 공용 observer, debounce, maxWait
- `writePlainText` — 클립보드 fallback 포함
- `FEATURE_ROOT_ATTRIBUTE` — host 표식

## 위험 요소

| 위험 | 대응 |
| --- | --- |
| 댓글 커밋 참조에 버튼이 붙음 | `.system-note` 안으로 범위 한정. 회귀 테스트로 고정 |
| SHA를 표시 텍스트에서 읽어 8자만 복사 | `data-commit` 사용을 계약으로 명시하고 40자 검증 |
| namespace 깊이 고정으로 route 미매칭 | 가변 깊이 정규식. 3단 이상 케이스를 테스트에 포함 |
| GitLab이 SPA 전환으로 목록을 다시 그림 | 공용 런타임 reconcile에 위임. 멱등성은 기준 요소 동일성으로 판정 |
| 카탈로그 변경이 저장된 설정과 어긋남 | 사후 기록 참조. `getSettings()`는 더 이상 되쓰지 않으므로 안전 |
| GitLab 버전 업그레이드로 `gfm-commit` 클래스 변경 | 실측 기반 selector임을 spec에 명시. 변경 시 재실측 |

## 비고

GitHub Enterprise 기능과 형식이 다르다. 그쪽은 `[제목](URL)` Markdown 링크, 이쪽은 SHA 문자열이다. 각 서비스의 기본 동작과 사용자 요청을 따른 결과이며 의도된 차이다.
