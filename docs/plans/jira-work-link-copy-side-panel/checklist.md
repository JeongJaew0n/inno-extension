# checklist — jira-work-link-copy-side-panel

> 작업 진행하면서 AI가 순차적으로 체크한다. `[x]`로 표시한 항목은 완료된 것으로 간주한다.
> 새 항목이 발견되면 적절한 단계에 추가하고 체크리스트를 유지한다.

## 0. 준비

- [x] `spec.md` / `context.md`를 다시 읽고 분석 결과와 어긋난 곳이 없는지 확인
- [x] 현재 branch와 기존 미커밋 변경을 확인하고 보존 범위를 확정

## 1. 구현

- [x] Jira preview panel selector 계약 추가
- [x] board 선택 업무 resolver가 modal과 panel을 모두 지원하도록 확장
- [x] modal/panel 전환 시 host 식별과 remount 계약 정리
- [x] 제목 포함 복사의 클릭 시점 재조회가 panel에서도 동작하는지 확인

## 2. 문서 정합성

- [x] Jira 업무 링크 복사 Spec의 적용 범위·사용자 경험·기술 계약을 panel까지 갱신
- [x] 분석 문서에 실제 구현 반영 결과와 회귀 테스트 범위를 기록

## 3. 검증

- [x] selector와 target 판별 회귀 테스트 추가
- [x] modal, panel target과 직접 업무 URL·clipboard 기존 동작 단위 검증
- [x] TypeScript typecheck와 전체 test 36개 통과
- [x] production build 통과 및 산출물에 panel 계약 포함 확인
- [ ] Chrome에서 우측 panel에 버튼 두 개가 한 번만 표시되는지 확인
- [ ] Chrome에서 modal ↔ panel 전환과 버튼 remount 확인
- [ ] Chrome에서 업무 번호와 제목 포함 복사 결과 확인

## 4. 마무리

- [x] `git diff --check`와 변경 파일 범위 확인
- [x] 완료 조건과 checklist를 최종 상태로 갱신
- [x] Chrome E2E 미체크 사유와 확장 재로드 후 재개 지점을 `context.md`에 기록
- [x] 후속 `$extension-release` 요청에서 release commit 대상으로 인계
