# GitLab 토큰 권한 프리셋

## 목적

fine-grained 토큰을 만들 때마다 권한 수백 개를 카테고리별로 골라야 한다. 늘 쓰는 묶음이 정해져 있으니
**선택을 한 번에** 끝낸다. **토큰 생성은 사용자가 한다.**

## 적용 화면

`https://rnd-app.innogrid.com/-/user_settings/personal_access_tokens/granular/new`

토큰 목록 화면(`/personal_access_tokens`)에는 붙지 않는다. 만들어진 토큰 값이 보이는 곳이다.

## 행동 계약

| 시점 | 동작 |
| --- | --- |
| 화면을 열 때 | 페이지 제목(`[data-testid="page-heading"]`) 아래에 **권한 프리셋 적용** 버튼이 생긴다. 아무것도 바꾸지 않는다 |
| 버튼을 누를 때 | ① 접근 범위를 `All groups and projects that I'm a member of` 로 고른다 ② 프리셋 카테고리의 권한을 모두 선택한다 ③ 결과를 버튼 아래에 적는다 |
| 그 뒤 | 이름·만료일 입력과 `Generate token` 은 사용자가 한다 |

- 이미 체크해 둔 권한은 프리셋으로 **덮어쓴다.**
- 폼을 제출하지 않는다. `Generate token` · `Cancel` 을 누르지 않는다.
- 연달아 눌러도 한 번만 돈다.

### 프리셋

| 경계 | 카테고리 |
| --- | --- |
| Group and project | CI/CD, Groups, Integrations, Packages and Registry, Project Features, Project Planning, Projects, Repository, System Access, System Migration, Wiki |
| User | CI/CD, Groups, Packages and Registry, Project Features, Project Planning, Projects, Repository, Search, System Access, System Migration |
| Global | CI/CD, Groups, Organizations, Packages and Registry, Project Features, Projects |

고른 카테고리 안의 **모든 리소스·모든 동작**(읽기·쓰기·삭제 포함)이 선택된다. 넓은 권한이므로 만료일을 짧게 둔다.
실측(2026-09-30): 선택되는 권한 383 · 73 · 87, 합 543.

### 결과 문구

| 경우 | 문구 |
| --- | --- |
| 성공 | `권한 N개 선택 — Group and project … · User … · Global …` |
| 경고 (주황) | 접근 범위 라디오를 못 찾음 · 권한이 빈 리소스가 남음 · 화면에 없는 카테고리 |
| 실패 (빨강) | 권한 선택기를 못 찾음 · 목록이 아직 없음 · 응답 없음. **아무것도 바꾸지 않는다** |

## 구조

- 선택기는 GitLab 의 Vue 2 컴포넌트 `PersonalAccessTokenPermissionsSelector` 다. `__vue__` 는 페이지 world 에만 있어서
  **MAIN world 브리지**(`src/sites/gitlab/main.ts`)가 조작하고, content script 는 `CustomEvent` 로 요청·응답만 한다.
- 선택은 컴포넌트의 `emitInput(value)` → `syncSelectedResources()` 로 한다. 체크박스를 하나씩 누르지 않는다.
- **네트워크 요청 없음.** 권한 목록은 화면이 이미 불러온 `permissionsByBoundary` 를 읽는다. `usesNetwork` 대상이 아니다.

## 위험

- GitLab 내부(컴포넌트 이름, 메서드, 데이터 모양)에 기댄다. 업그레이드나 Vue 3 전환에서 깨질 수 있다. 그때는 실패 문구가 뜬다.
- 접근 범위 라벨을 영어 문구로 찾는다. GitLab 언어를 바꾸면 라디오를 못 찾고 경고가 뜬다(권한 선택은 된다).

## 검증

- 단위: 경로 판정, 권한 고르기(중복 제거·없는 카테고리), 결과 문구, 제출·네트워크 코드 없음
- e2e: 가짜 토큰 화면 — 목록 화면 미주입, 누르기 전 무변화, 선택 값, 접근 범위, 제출 0회, 결과 문구
- 실제 GitLab: 화면·컴포넌트·메서드·카테고리 존재를 읽기로 확인(2026-09-30). 버튼 누르기는 사용자가 확인한다

## 변경 이력

- 2026-09-30: 처음 만듦. 사용자가 쓰던 북마클릿을 확장 기능으로 옮겼다.
