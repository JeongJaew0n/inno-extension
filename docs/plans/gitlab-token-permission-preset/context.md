# 맥락 — GitLab 토큰 권한 프리셋

## 요청 (2026-09-30)

사용자가 쓰던 북마클릿(`gitlab-token-bookmarklet.html`, 개인 보관)을 확장 기능으로 옮긴다.
사용자 말: "확장이 권한 '선택'만 해주고, '생성' 같은 건 내가 하려고 한 것".

## 실측 (2026-09-30, rnd-app.innogrid.com)

- 화면 경로 `/-/user_settings/personal_access_tokens/granular/new` 가 있다.
- Vue 2 다. `__vue__` 로 인스턴스에 닿는다. Vue 루트가 7개라 `main` 에서 아래로만 훑으면 못 찾는다.
  **첫 체크박스에서 `$parent` 로 올라가면** `PersonalAccessTokenPermissionsSelector` 가 나온다.
- 그 인스턴스에 `permissionsByBoundary`(경계별 권한 배열) · `emitInput(value)` · `syncSelectedResources()` 가 있다.
- 권한 항목은 `{ name, resource, categoryName }` 모양이다.
- 프리셋 카테고리는 전부 있다. 선택되는 권한 수: Group and project 383/552 · User 73/104 · Global 87/248 (합 543).
- 접근 범위 라디오 라벨: `Only my personal projects` / `All groups and projects that I'm a member of` / `Only specific groups or projects that I'm a member`.
- 버튼 자리 후보: `[data-testid="page-heading"]` (페이지 제목 블록).

## 결정

| 결정 | 이유 |
| --- | --- |
| MAIN world 스크립트로 조작 | `__vue__` 는 페이지 world 의 expando 라 content script(ISOLATED)에서 안 보인다. Jira 스프린트 상태 브리지와 같은 방식(CustomEvent 요청/응답) |
| 선택은 `emitInput` 으로 | 체크박스 543개를 클릭하면 느리고, 가상 목록이면 화면에 없는 항목을 못 누른다. 북마클릿이 실측으로 쓰던 경로다 |
| 카테고리는 코드 상수 | 설정에 통째로 저장하면 다음 릴리즈에서 목록을 고쳐도 기존 사용자는 옛 목록을 쓴다 |
| 네트워크 없음 | 권한 목록은 화면이 이미 불러왔다. 특별 관리 대상이 아니다 |

## 위험

- GitLab 내부 컴포넌트 이름·메서드에 기댄다. 업그레이드나 Vue 3 전환에서 깨질 수 있다.
  그때는 버튼 옆에 "권한 선택기를 찾지 못했다"가 뜨고 아무것도 바꾸지 않는다.
- 권한 범위가 넓다(삭제·설정 변경 포함). 설명에 적어 둔다.

## 기각한 대안

- **북마클릿 유지** — 확장이 설정·배포·업데이트를 한곳에서 맡는 편이 낫다는 사용자 판단.
- **체크박스를 DOM 클릭** — 위 결정 참조.
