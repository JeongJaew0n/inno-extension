# checklist — gitlab-mr-commit-sha-copy

> 작업 진행하면서 AI가 순차적으로 체크한다. `[x]`로 표시한 항목은 완료된 것으로 간주한다.
> 새 항목이 발견되면 적절한 단계에 추가하고 체크리스트를 유지한다.

## 0. 준비

- [x] 실제 GitLab 화면에서 Overview 커밋 목록 DOM 구조 실측
- [x] GitLab 기본 `Copy commit SHA` 버튼이 복사하는 값 확인 (40자 전체 SHA)
- [x] 댓글 본문에도 같은 클래스의 커밋 참조가 있음을 확인 (6건)
- [x] namespace 깊이가 가변임을 확인 (실측 3단)
- [x] `spec.md` / `context.md`를 다시 읽고 어긋난 곳이 없는지 확인
- [x] 현재 branch와 미커밋 변경 확인

## 1. 열린 질문 해소

- [x] Commits 탭의 `body[data-page]` 값 확인 → route 판정에 쓸 수 있는지 결정
- [~] `added N commits` 노트가 여러 개인 MR에서 동작 확인 — MR !2는 시스템 노트가 0개라 검증 불가. 구현은 모든 노트를 순회함
- [~] `Toggle commit list` 접기 시 버튼 동작 확인 — 텍스트는 있으나 요소 미포착. 접힘 시 동작 미확인
- [x] 댓글 커밋 참조에도 버튼을 붙일지 사용자에게 확인

## 2. 사이트 등록

- [x] `SITE_IDS`에 `gitlab`, `FEATURE_IDS`에 `commitShaCopy` 추가
- [x] catalog에 사이트 서술 추가
- [x] `defaults.ts`에 기본 설정 추가
- [x] GitLab favicon 확보 후 `SITE_ICON_URLS`에 연결
- [x] `manifest.json`에 `https://rnd-app.innogrid.com/*` content script 추가
- [ ] 저장된 설정과의 정합성 확인 (사후 기록의 장애 재발 여부)

## 3. 구현

- [x] `routes.ts` — 가변 깊이 namespace를 허용하는 MR Overview route 판정
- [x] `selectors.ts` — 시스템 노트, 커밋 참조 링크 계약
- [x] `clipboard.ts` — `data-commit` 40자 검증과 복사
- [x] `runtime.ts` — 시스템 노트로 한정한 버튼 주입, 멱등성, dispose
- [x] `content.ts` — 진입점
- [x] 버튼 클릭이 링크 이동을 막는지 확인 (`preventDefault` + `stopPropagation`)

## 4. 테스트

- [x] route 판정: 2단·3단·4단 namespace 허용
- [x] route 판정: `/commits`, `/diffs`, `/pipelines` 제외
- [x] route 판정: 다른 호스트 제외
- [x] SHA 추출: `data-commit` 40자만 허용, 8자 표시 텍스트 사용 안 함
- [x] SHA 추출: 속성 누락·비정상 값 처리
- [x] 범위 한정: 댓글 안 커밋 참조가 대상에서 빠지는지 (회귀 가드)

## 5. 문서

- [x] `spec/features/gitlab-commit-sha-copy.md` 작성
- [x] `spec/README.md` 목록에 연결
- [x] `spec/product-overview.md` 기능표와 변경 이력
- [x] `README.md` 기능표와 디렉터리 구조
- [x] `context.md` 현재 상태 갱신

## 6. 검증

- [x] `npm run build` 통과 (typecheck + 테스트)
- [ ] 확장 재로드 후 Overview 탭에서 버튼 표시 확인
- [ ] 복사 결과가 40자 전체 SHA인지 확인
- [ ] GitLab 기본 버튼 결과와 동일한지 대조
- [ ] 댓글 커밋 참조에 버튼이 없는지 확인
- [ ] Commits 탭에 버튼이 없는지 확인
- [ ] Popup에서 GitLab 토글 동작 확인
- [ ] 기능 OFF 시 버튼 제거 확인
- [ ] **기존 4개 사이트 회귀 없음 확인** (사이트 추가가 설정 정합성에 영향)

## 7. 마무리

- [ ] 관심사별로 커밋 분리
- [ ] 실측 검증 결과를 커밋 메시지와 spec에 반영
- [ ] 미검증 항목이 있으면 명시
