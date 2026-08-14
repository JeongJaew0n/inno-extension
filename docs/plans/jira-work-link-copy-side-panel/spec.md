# spec — jira-work-link-copy-side-panel

## 목표

Jira 보드의 선택 업무 상세가 modal 또는 우측 preview panel로 열리는 경우 모두 현재 업무 번호 옆에 `업무 링크 복사`, `업무 링크 복사(제목포함)` 버튼을 제공한다.

## 범위

- 포함:
  - 기본 Jira software board URL의 `selectedIssue` 업무 상세 지원
  - issue modal과 우측 preview panel을 명시적인 상세 컨테이너로 판별
  - 현재 업무 번호와 제목을 기존 selector와 clipboard 계약으로 재사용
  - modal ↔ panel 전환, 업무 변경, panel 닫기 시 버튼 lifecycle 유지
  - modal과 직접 업무 조회 화면의 기존 동작 회귀 방지
  - 기능 Spec과 분석 문서 정합성 갱신
- 제외:
  - backlog, timeline, calendar, reports 등 board 하위 view 지원 확대
  - Jira REST API 호출
  - clipboard 출력 형식 또는 버튼 문구 변경
  - 보드 정보 패널 기능 변경
  - `main` 병합, 릴리즈, 배포

## 완료 조건 (Definition of Done)

- [ ] 우측 preview panel의 현재 업무 번호 옆에 복사 버튼 두 개가 한 번만 표시된다.
- [x] `업무 링크 복사`가 선택 업무 번호와 정규 URL을 기존 plain/rich 형식으로 구성한다.
- [x] `업무 링크 복사(제목포함)`이 클릭 시점의 panel target과 제목을 다시 조회한다.
- [x] modal의 기존 target 판별과 복사 payload 동작이 유지된다.
- [ ] modal ↔ panel 전환과 선택 업무 변경 시 이전 host가 정리되고 새 host가 생성된다.
- [ ] panel 닫기, 기능 OFF 또는 Jira 서비스 OFF 시 주입 UI가 제거된다.
- [x] TypeScript typecheck, 전체 단위 테스트, production build가 성공한다.
- [ ] 로그인된 Chrome에서 NPT-144 panel 표시를 직접 확인한다.

## 인터페이스 / 데이터 형식

보드 상세 scope 후보는 다음 순서로 판별한다.

```css
[role="dialog"][data-testid="issue.views.issue-details.issue-modal.modal-dialog"]
section[data-testid="preview-panels.preview-panel"]
```

scope 안의 현재 업무 link와 제목은 기존 selector를 사용한다.

```css
[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"][href^="/browse/"]
[data-testid="issue.views.issue-base.foundation.summary.heading"]
```

모든 scope 후보는 URL의 `selectedIssue`와 같은 업무 번호 link를 포함해야 유효하다. 부모 업무 breadcrumb나 다른 dialog는 target으로 사용하지 않는다.

## 의존성

- 외부 라이브러리·서비스·CLI:
  - 로그인된 사내 Jira Cloud 화면
  - 기존 Vite, TypeScript, Node test runner
  - Chrome 확장 프로그램 개발자 모드의 최신 `dist/`
- 사전 작업으로 끝나야 하는 항목:
  - `docs/jira-work-link-copy-side-panel-analysis.md`의 Chrome 실측과 원인 분석 완료
  - 현재 working tree의 기존 미커밋 변경 보존

## 비고

- 새 MutationObserver나 Jira API는 추가하지 않는다. 공통 site runtime의 기존 DOM reconcile을 사용한다.
- modal과 panel은 내부 업무 번호·제목 selector가 동일하지만 최상위 컨테이너가 다르다.
- 현재 전역 `[role="dialog"]` fallback은 다른 Jira dialog 오탐 가능성이 있으므로 선택 업무 link 검증 없는 scope로 신뢰하지 않는다.
- 좁은 panel에서 버튼 폭이 부족한 경우는 실제 Chrome 검증 결과에 따라 별도 UI 조정 여부를 판단한다.
