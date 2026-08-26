# spec — github-pr-commit-sha-copy

## 목표

GitHub Enterprise PR Conversation 탭의 타임라인 커밋 행에서, 커밋 번호 오른쪽 버튼 한 번으로 40자 전체 SHA를 복사한다. Commits 탭으로 이동하지 않고 Conversation에서 끝낸다.

## 범위

### 포함

- 기존 `githubEnterprise` 사이트에 **두 번째 기능** 추가
- PR Conversation 탭(`/pull/{번호}`)의 타임라인 커밋 행
- 각 커밋 번호 오른쪽에 복사 버튼 주입
- 40자 전체 SHA를 plain text로 복사
- Conversation 전용 route 판정 신설

### 제외

- **Commits 탭** — GitHub 기본 `Copy full SHA` 버튼이 이미 10개 있다. 중복이 된다
- Files changed, Checks 탭
- Issue 타임라인의 커밋 참조
- 저장소 커밋 목록 화면
- 새 사이트·origin 추가 (기존 사이트에 기능만 추가)
- `pullRequestTitleCopy` 동작 변경

## 완료 조건

- [ ] Conversation 탭 타임라인의 커밋 번호마다 버튼이 하나씩 표시된다
- [ ] 버튼이 커밋 번호 오른쪽에 위치한다
- [ ] 클릭하면 40자 전체 SHA가 클립보드에 들어간다
- [ ] 복사 결과가 GitHub 기본 `Copy full SHA` 버튼 결과와 같다
- [ ] 복사 성공·실패 피드백이 보인다
- [ ] 버튼 클릭이 커밋 링크 이동을 유발하지 않는다
- [ ] **Commits 탭에는 버튼이 붙지 않는다** (기본 버튼과 중복 금지)
- [ ] 기존 `pullRequestTitleCopy`가 영향받지 않는다
- [ ] Popup에서 두 기능을 각각 켜고 끌 수 있다
- [ ] 기능을 끄면 주입한 버튼이 모두 사라진다
- [ ] 자동화 테스트가 route 판정과 SHA 추출을 검증한다

## 인터페이스 / 데이터 형식

### 클립보드

40자 전체 SHA를 plain text 한 가지로 기록한다.

```text
1bb0ce4a2f... (40자)
```

GitHub 기본 버튼(`Copy full SHA for 1bb0ce4`)과 같은 값이며, GitLab `커밋 번호 복사`와도 일치한다.

### DOM 계약

| 대상 | selector | 비고 |
| --- | --- | --- |
| 타임라인 항목 | `.TimelineItem` | Commits 탭 배제 경계 |
| 커밋 번호 셀 | `.text-right.ml-1` | 우측 정렬. 자식은 `code` 하나 |
| 커밋 링크 | `a[href]` (셀 안) | 표시 텍스트 7자 |
| 전체 SHA | `href` 마지막 세그먼트 | `/pull/{번호}/commits/{40자}` |

**SHA는 `href`에서 읽는다.** GitLab은 `data-commit` 속성이었지만 GitHub은 링크 경로에 담는다. 표시 텍스트(7자)는 사용하지 않는다.

버튼은 `.text-right.ml-1` 안 `code` **뒤**에 넣는다. 셀이 우측 정렬이므로 커밋 번호가 왼쪽으로 밀리고 버튼이 오른쪽 끝을 차지한다. 셀 오른쪽 여백이 0px이라 다른 삽입 위치는 넘침을 만든다.

### 라우트

```text
/{owner}/{repo}/pull/{번호}
```

끝 슬래시만 허용한다. **하위 탭은 모두 제외한다.**

```text
/pull/{번호}/commits   제외  ← 기본 버튼과 중복
/pull/{번호}/files     제외
/pull/{번호}/checks    제외
```

기존 `parseGithubEnterpriseRoute`의 `detail` 판정은 `(?:/.*)?`로 하위 탭을 포함하므로 **재사용할 수 없다.** `pullRequestTitleCopy`에는 그 동작이 맞으므로 기존 판정은 그대로 두고 새 판정을 추가한다.

### 버튼

- `code` 뒤에 삽입
- Shadow DOM + `style.all = 'initial'`
- GitHub Primer 커스텀 속성(`--fgColor-muted` 등) 사용, 리터럴 fallback 병기
- 아이콘 버튼. 성공 시 체크, 실패 시 X를 1.5초 표시

## 의존성

### 새로 만드는 것

```text
src/sites/githubEnterprise/features/commitShaCopy/
  clipboard.ts
  runtime.ts
spec/features/github-pr-commit-sha-copy.md
```

### 고치는 것

| 파일 | 변경 |
| --- | --- |
| `src/catalog/types.ts` | `FEATURE_IDS`에 기능 ID 추가 (열린 질문 1번 결정 후) |
| `src/catalog/sites.ts` | `githubEnterprise.features`에 항목 추가 |
| `src/platform/settings/defaults.ts` | 기본 설정 추가 |
| `src/sites/githubEnterprise/routes.ts` | Conversation 전용 판정, SHA 추출 |
| `src/sites/githubEnterprise/selectors.ts` | 타임라인·셀·링크 계약 |
| `src/sites/githubEnterprise/content.ts` | 기능 등록 |
| `tests/unit.test.ts` | route·SHA 추출 테스트 |
| `README.md`, `spec/*` | 기능표·변경 이력·문서 목록 |

**`manifest.json`은 건드리지 않는다.** origin이 이미 등록돼 있다.

### 재사용

- `createSiteRuntime` — 이미 `githubEnterprise`에 연결돼 있다. features 배열에 추가만 한다
- `writePlainText`
- `FEATURE_ROOT_ATTRIBUTE`

## 위험 요소

| 위험 | 대응 |
| --- | --- |
| **Commits 탭에서 기본 버튼과 중복** | route 게이트 + `.TimelineItem` 스코프 이중 방어. 회귀 테스트로 고정 |
| 기존 route 재사용으로 하위 탭 통과 | Conversation 전용 판정을 신설. 기존 `detail`은 손대지 않음 |
| 표시 텍스트(7자)를 복사 | `href` 40자 추출을 계약으로 명시하고 길이 검증 |
| 커밋 번호가 밀려 레이아웃이 어색해짐 | 셀 우측 정렬 특성상 자연스러운 결과. 실측으로 확인 필요 |
| Turbo 캐시 복원으로 죽은 버튼 부활 | `pullRequestTitleCopy`와 같은 `WeakSet` 추적 |
| 기능 ID가 GitLab과 충돌 | 열린 질문 1번에서 결정 |
| 같은 사이트에 기능이 둘이 되며 상호 간섭 | 서로 다른 `FEATURE_ROOT_ATTRIBUTE` 값 사용. dispose 범위 분리 |

## 비고

GitLab `커밋 번호 복사`와 목적·복사 값·배치가 같고 DOM 계약만 다르다. 두 spec을 나란히 두면 사이트별 차이가 드러난다.

| | GitLab | GitHub Enterprise |
| --- | --- | --- |
| SHA 위치 | `data-commit` 속성 | `href` 경로 |
| 표시 길이 | 8자 | 7자 |
| 범위 경계 | `.system-note` (댓글 배제) | `.TimelineItem` (Commits 탭 배제) |
| 댓글 커밋 참조 | 존재 (6건) | 없음 |
| 기본 버튼 위치 | Commits 탭 | Commits 탭 |
