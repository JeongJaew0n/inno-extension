# 계획 — GitLab 토큰 권한 프리셋

## 만드는 것

GitLab `Generate fine-grained token` 화면에 **권한 프리셋 적용** 버튼을 붙인다.
누르면 개발·배포에 쓰는 권한 묶음을 한 번에 **선택**한다. 토큰 **생성은 하지 않는다.**
이름·만료일 입력과 `Generate token` 은 사용자가 한다.

| 항목 | 값 |
| --- | --- |
| 사이트 | `gitlab` |
| 기능 ID | `tokenPermissionPreset` |
| 이름 | 토큰 권한 프리셋 |
| 기본값 | ON — 이 화면에서만 버튼이 보이고, 누르기 전에는 아무것도 하지 않는다 |
| 적용 화면 | `/-/user_settings/personal_access_tokens/granular/new` |
| 네트워크 | 없음. 권한 목록은 GitLab 화면이 이미 불러와 둔 것을 쓴다 (`usesNetwork` 아님) |

## 누르면 일어나는 일

1. 접근 범위를 **All groups and projects that I'm a member of** 로 고른다 (이미 골랐으면 그대로).
2. 프리셋 카테고리에 속한 권한을 전부 선택한다.

   | 경계 | 카테고리 |
   | --- | --- |
   | Group and project | CI/CD, Groups, Integrations, Packages and Registry, Project Features, Project Planning, Projects, Repository, System Access, System Migration, Wiki |
   | User | CI/CD, Groups, Packages and Registry, Project Features, Project Planning, Projects, Repository, Search, System Access, System Migration |
   | Global | CI/CD, Groups, Organizations, Packages and Registry, Project Features, Projects |

3. 버튼 옆에 결과를 적는다 — 경계별 리소스·권한 수, 화면에 없던 카테고리, 권한이 비어 남은 리소스 수.

사용자가 이미 체크해 둔 것은 **덮어쓴다.** 프리셋은 "이 묶음으로 맞춘다"는 뜻이다.

## 하지 않는 것

- `Generate token` · `Cancel` 을 누르지 않는다. 폼을 제출하지 않는다.
- 만들어진 토큰 값을 읽지 않는다. 토큰 목록 화면에서는 돌지 않는다.
- 프리셋 편집 UI 는 이번 범위가 아니다. 카테고리는 코드 상수다(내장 템플릿과 같은 방식).

## 완료 조건

- `npm run check` 통과, 프리셋 선택 로직 단위 테스트
- e2e: 가짜 토큰 화면에서 버튼 → 선택 값 전달 · 접근 범위 선택 · 결과 문구 · 제출 없음
- 실제 GitLab 화면: 버튼이 보이는 것까지 확인. **버튼 누르기는 사용자가 한다** (Claude Code 는 실제 토큰 화면에서 권한을 선택하는 동작을 할 수 없다)
- spec · README 반영
