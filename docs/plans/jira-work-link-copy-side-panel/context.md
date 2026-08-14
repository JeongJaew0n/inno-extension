# context — jira-work-link-copy-side-panel

## 사용자의 원 요청

사용자는 Jira board 2147의 `selectedIssue=NPT-144` 화면에서 업무 상세가 modal이 아닌 우측 사이드 패널로 표시될 때도 기존 `업무 링크 복사`와 `업무 링크 복사(제목포함)` 버튼을 노출하도록 개선해 달라고 요청했다. 먼저 로그인된 Chrome으로 원인을 분석해 문서화한 뒤, `ai-plan-memory`를 만들고 즉시 구현을 진행하도록 지시했다.

## 왜 이걸 지금 하는가

현재 기능은 같은 board URL과 같은 선택 업무라도 Jira가 상세를 modal로 렌더링할 때만 버튼을 표시한다. 사용자의 실제 화면에서는 Jira가 동일 업무를 우측 preview panel로 열기도 하며, 이 경우 복사 기능을 사용할 수 없다.

Chrome 실측 결과 panel과 modal은 현재 업무 번호와 제목에 같은 `data-testid`를 사용하지만 최상위 컨테이너가 다르다. 현 resolver는 dialog가 없으면 target을 만들지 않기 때문에 panel 전환 직후 기존 버튼까지 제거한다.

## 결정된 방향

Jira board 선택 업무 resolver가 issue modal과 preview panel을 모두 명시적인 상세 scope로 인식하게 확장하고, 기존 업무 번호·제목 selector, 버튼 UI, clipboard 계약과 공통 runtime은 그대로 재사용한다.

## 기각된 대안

- Jira REST API 사용 — 현재 DOM에 필요한 업무 번호와 제목이 존재하며 추가 권한, 인증, 요청 실패 처리가 불필요하다.
- 새 MutationObserver 추가 — 기존 site runtime이 modal/panel DOM 교체를 이미 감지하고 reconcile한다.
- URL만으로 제목 구성 — 업무 번호는 알 수 있지만 현재 편집된 제목을 클릭 시점에 반영할 수 없다.
- 전역 `[role="dialog"]`만 확대 사용 — preview panel은 dialog가 아니며 다른 Jira dialog를 잘못 선택할 가능성도 남는다.
- backlog 등 모든 board 하위 view까지 동시 확대 — 이번 사용 사례는 기본 board path이고 기존 route 정책 변경이 필요하지 않다.

## 제약 / 합의 사항

- 기술적 제약:
  - Jira Cloud의 비공개 DOM과 `data-testid`에 의존한다.
  - panel selector는 현재 사내 Jira의 `preview-panels.preview-panel` 실측에 근거한다.
  - title 포함 복사는 클릭 시점 DOM을 다시 읽어야 한다.
- 시간·범위 제약:
  - 이번 작업은 target scope 확장과 회귀 검증에 한정한다.
  - 릴리즈, commit, push, main 병합은 별도 요청 전에는 수행하지 않는다.
- 사용자가 명시한 선호:
  - 사용자 용어는 `이슈`보다 `업무`를 사용한다.
  - 분석을 문서로 남긴 뒤 바로 구현한다.
  - 모든 Jira board 기본 화면에서 동작하는 기존 정책을 유지한다.
- 작업 트리 제약:
  - `.codex/skills/extension-release`, README, 제품 Spec의 기존 미커밋 변경을 보존한다.

## 관련 자료

- `docs/jira-work-link-copy-side-panel-analysis.md`
- `src/sites/jira/features/issueLinkCopy/runtime.ts`
- `src/sites/jira/selectors.ts`
- `src/sites/jira/routes.ts`
- `src/platform/runtime/createSiteRuntime.ts`
- `spec/features/jira-work-link-copy.md`
- Jira 실측 URL: `https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147?selectedIssue=NPT-144`

## 현재 상태 — 2026-08-14

- 구현 완료:
  - preview panel selector 추가
  - board resolver의 modal/panel scope 판별
  - `selectedIssue` 일치 link 검증
  - panel 전용 `board-panel-link` mount kind 추가
- 검증 완료:
  - TypeScript typecheck 통과
  - 전체 단위 테스트 36개 통과
  - production build 통과
  - build 산출물에 panel selector와 `board-panel-link` 포함 확인
  - `git diff --check` 통과
- Chrome E2E 대기:
  - Chrome 제어 정책상 `chrome://extensions` 접근이 차단되어 최신 `dist/`를 설치된 unpacked extension에 자동 재로드할 수 없었다.
  - 우회하지 않고 중단했으며, 사용자가 확장 관리 화면에서 Inno Extension을 한 번 재로드한 뒤 NPT-144의 panel/modal 전환과 두 복사 버튼을 확인하는 것이 다음 재개 지점이다.
- 기존 미커밋 변경인 `README.md`, `spec/product-overview.md`, `.codex/skills/extension-release/`는 수정·정리하지 않고 보존했다.
