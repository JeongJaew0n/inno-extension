# checklist — inno-extension-multi-site

> 작업 진행하면서 AI가 순차적으로 체크한다. `[x]`로 표시한 항목은 완료된 것으로 간주한다.
> 새 항목이 발견되면 적절한 단계에 추가하고 체크리스트를 유지한다.
> 실제 작업은 한 번에 1~2개 항목만 진행하고 매 단위마다 이 문서를 갱신한다.

## 0. 준비

- [x] 두 저장소의 현재 구조와 핵심 entry를 조사
- [x] 첨부 UI의 사이트 목록/사이트 상세/기능 상세 패턴 분석
- [x] 멀티 사이트 아키텍처 초안 작성
- [x] plan memory의 spec.md / context.md / checklist.md 생성
- [x] 실제 작업 착수 전에 spec.md / context.md를 다시 읽고 코드와 어긋난 부분 확인
- [x] `/Users/jjw/my/Dev/inno-extension` Git 상태와 현재 빌드/typecheck 재검증
- [x] `/Users/jjw/my/Dev_ENT/jjw_inno_extension` 테스트/build 재검증
- [x] 통합 작업용 `codex/` 브랜치 생성 또는 현재 브랜치 사용 근거 기록

## 1. 통합 기반

- [x] 통합 확장 표시 이름과 버전 정책 확정
- [x] target Manifest를 아마란스/Jira 다중 content entry로 변경
- [x] Popup action과 background service worker entry 추가
- [x] 공통 source 디렉터리 구조 생성
- [x] catalog의 SiteId/FeatureId/descriptor 타입 정의
- [x] 아마란스와 Jira site/feature metadata 등록
- [x] manifest origin과 catalog origin 일치 검사 추가

## 2. 설정 플랫폼

- [x] `ExtensionSettingsV1` 타입과 기본값 구현
- [x] site gate와 feature enabled의 effective state 계산 함수 구현
- [x] `chrome.storage.sync` SettingsRepository 구현
- [x] 누락된 설정을 기본값으로 보충하는 merge 구현
- [x] schema version migration framework 구현
- [x] 기존 `overlayEnabled`를 boardInspector 설정으로 옮기는 migration 구현
- [x] site OFF가 child 값을 변경하지 않는 회귀 테스트 추가
- [x] Popup과 content runtime에서 같은 설정 repository 계약 사용

## 3. 사이트 Runtime

- [x] `FeatureRuntime.reconcile/dispose` 계약 구현
- [x] 사이트당 하나의 debounce DOM scheduler 구현
- [x] storage 변경 시 활성 기능을 재조정하는 site runtime 구현
- [x] 사이트 OFF 시 observer 중단과 전체 feature dispose 구현
- [x] 사이트 ON 시 observer 재연결과 즉시 reconcile 구현
- [ ] 기능 단위 ON/OFF가 다른 기능에 영향을 주지 않는 테스트 추가

## 4. 아마란스 기능 이관

- [x] 기존 selector를 `sites/amaranth/selectors.ts`로 이동
- [x] 기존 click delegation과 active 동기화를 attendanceHeader feature로 이동
- [x] 기존 버튼/style 주입을 idempotent reconcile로 변환
- [x] dispose 시 버튼 container와 style 제거 구현
- [ ] 아마란스 hash SPA 이동 후 재주입 확인
- [ ] 실제 출근/퇴근 버튼 위임 회귀 확인

## 5. Jira 기능 이관

- [x] Jira URL/이슈 키 파싱을 strict TypeScript로 이동
- [x] Jira selector를 `sites/jira/selectors.ts`로 분리
- [x] 이슈 링크 복사를 issueLinkCopy feature로 분리
- [x] 링크 clipboard payload 회귀 테스트 이관
- [x] 보드 snapshot/패널을 boardInspector feature로 분리
- [x] feature별 root marker와 독립 dispose 구현
- [ ] selectedIssue SPA 변경 시 복사 버튼이 갱신되는지 확인
- [ ] 지원하지 않는 Jira route에서 모든 주입물이 제거되는지 확인

## 6. Popup UI

- [x] 아마란스와 Jira 원본 favicon PNG를 로컬 asset으로 저장
- [x] 사이트 카드의 문자 placeholder를 favicon 이미지로 교체
- [x] favicon 파일 형식·크기와 production bundle 포함 여부 검증
- [x] 공통 디자인 token과 Popup 기본 layout 구현
- [x] Popup hash router 구현
- [x] `편의기능 / 설정` 상단 탭 구현
- [x] catalog 기반 사이트 목록 카드 구현
- [x] 사이트 마스터 토글과 `X/Y` 기능 수 표시 구현
- [x] 사이트 카드 외부 열기와 상세 진입 이벤트 분리
- [x] 사이트 상세 기능 목록 구현
- [x] 기능별 토글 구현
- [x] 기능 상세 화면과 route summary 구현
- [x] feature options renderer 등록 구조 구현
- [x] 기능별 기본값 초기화 구현
- [x] keyboard focus와 aria label 접근성 확인

## 7. 검증 및 패키징

- [x] settings default/migration/effective state 단위 테스트 통과
- [x] catalog ID 중복과 settings default 누락 검사 통과
- [ ] feature lifecycle idempotency와 cleanup 테스트 통과
- [ ] 아마란스 fixture DOM 통합 테스트 통과
- [ ] Jira fixture DOM 통합 테스트 통과
- [x] `npm run typecheck` 통과
- [x] `npm test` 통과
- [x] `npm run build` 통과
- [x] 하나의 dist에서 두 content bundle이 분리됐는지 확인
- [x] 배포 ZIP 내용과 무결성 검사
- [x] 실제 Popup 소스를 mock Chrome API harness에서 시각 검증
- [x] Popup 사이트/기능 토글, 상세 이동, `X/Y` 반영과 site gate 상태 보존 확인
- [x] 실제 아마란스/Jira 로그인 탭에서 주요 DOM selector 존재 확인
- [ ] 실제 아마란스 사이트 수동 E2E
- [ ] 실제 Jira NPT board 2146 수동 E2E
- [ ] rich editor 붙여넣기 결과가 `[NPT-n](https://.../browse/NPT-n)`인지 확인
- [ ] 기존 Jira 확장을 끈 상태에서 통합 확장만으로 중복 주입이 없는지 확인

## 8. 마무리

- [x] README를 단일 멀티 사이트 확장 기준으로 갱신
- [x] 아키텍처 및 새 기능 추가 방법 문서화
- [x] 변경 파일과 검증 결과 검토
- [x] 커밋 규칙 확인 후 커밋
- [x] 미체크 항목이 남으면 사유와 다음 시작점을 이 문서에 기록
- [x] 스펙 변경이 있었다면 spec.md를 먼저 갱신
- [x] 다음 세션이 즉시 픽업할 수 있게 마지막 완료 항목과 다음 항목 확인

## 현재 상태

- 완료: 통합 기반, 설정 플랫폼, site runtime, 아마란스/Jira 기능 이관, 실제 사이트 favicon 적용, Popup UI/상태 검증, 단위 테스트 9개, ZIP 패키징
- 다음 작업: diff 최종 검토와 Chrome 확장 재로드 후 실제 두 사이트 E2E
- 실제 이관 코드 변경: `/Users/jjw/my/Dev/inno-extension`의 `codex/multi-site-extension` 브랜치에서 진행 중
- 검증 제약: Chrome 내부 `chrome://extensions` 탭은 자동 제어할 수 없어 통합 dist 재로드 및 실제 사이트 E2E는 수동 재로드 이후 확인 필요
- 재개 지점: Chrome에서 `/Users/jjw/my/Dev/inno-extension/dist`를 새로고침한 뒤 아마란스 출퇴근 위임, Jira selectedIssue 링크 복사, rich editor 붙여넣기를 순서대로 확인
