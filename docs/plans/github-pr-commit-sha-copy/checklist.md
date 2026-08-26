# checklist — github-pr-commit-sha-copy

> 작업 진행하면서 AI가 순차적으로 체크한다. `[x]`로 표시한 항목은 완료된 것으로 간주한다.
> 새 항목이 발견되면 적절한 단계에 추가하고 체크리스트를 유지한다.

## 0. 준비

- [x] Conversation 탭 커밋 행 DOM 구조 실측
- [x] Commits 탭 기본 버튼이 복사하는 값 확인 (`Copy full SHA`, 40자)
- [x] Conversation 탭에 기본 버튼이 없음을 확인 (0개 vs Commits 10개)
- [x] 댓글 본문에 같은 형태의 커밋 링크가 없음을 확인 (GitLab과 다른 점)
- [x] Commits 탭에서 naive selector가 10개 걸림을 확인 (중복 위험)
- [x] `.TimelineItem` 스코프면 Commits 탭에서 0개임을 확인
- [x] 기존 `PULL_DETAIL_PATTERN`이 하위 탭을 포함함을 확인 (재사용 불가)
- [x] 커밋 번호 셀의 우측 여백이 0px임을 확인
- [x] `spec.md` / `context.md`를 다시 읽고 어긋난 곳이 없는지 확인
- [x] 현재 branch와 미커밋 변경 확인

## 1. 열린 질문 해소

- [x] **기능 ID 결정** — GitLab도 `commitShaCopy`다. 공유할지 구분할지
- [~] `added N commits` 묶음 행과 단독 커밋 행이 같은 구조인지 확인 — 실측 미수행
- [~] 상태 아이콘(체크·X)이 있는 행에서 버튼 정렬 확인 — 실측 미수행. 아이콘은 셀 밖이라 영향 없어 보임

## 2. 구현

- [x] `routes.ts` — Conversation 전용 route 판정 추가 (기존 `detail`은 유지)
- [x] `routes.ts` — `href`에서 40자 SHA 추출·검증
- [x] `selectors.ts` — 타임라인 항목, 커밋 번호 셀, 커밋 링크 계약
- [x] `features/commitShaCopy/clipboard.ts`
- [x] `features/commitShaCopy/runtime.ts` — 버튼 주입, WeakSet 추적, dispose
- [x] `content.ts` — features 배열에 추가
- [x] 버튼 클릭이 링크 이동을 막는지 확인

## 3. 사이트 등록

- [x] `FEATURE_IDS`에 기능 ID 추가
- [x] catalog `githubEnterprise.features`에 서술 추가
- [x] `defaults.ts`에 기본 설정 추가
- [x] `manifest.json` 변경이 **필요 없음**을 재확인 (origin 기등록)

## 4. 테스트

- [x] route: `/pull/{번호}` 허용, 끝 슬래시 허용
- [x] route: `/commits`, `/files`, `/checks` **제외** (중복 방지 회귀 가드)
- [x] route: 다른 호스트 제외
- [x] SHA: `href`에서 40자만 추출, 7자 표시 텍스트 사용 안 함
- [x] SHA: 비정상 href 처리
- [x] 기존 `parseGithubEnterpriseRoute` 동작이 바뀌지 않았는지 (기존 테스트 유지)

## 5. 문서

- [x] `spec/features/github-pr-commit-sha-copy.md` 작성
- [x] `spec/README.md` 목록에 연결
- [x] `spec/product-overview.md` 기능표와 변경 이력
- [x] `README.md` 기능표
- [x] `context.md` 현재 상태 갱신

## 6. 검증

- [x] `npm run build` 통과 (typecheck + 테스트 73건)
- [x] 확장 재로드 후 동작 확인 — 2026-08-26 사용자 확인 ("잘 나오네. 테스트 완료했어.")

사용자가 동작을 확인했다. 아래는 개별 측정 결과를 받지 않아 미확인으로 남긴다.

- [ ] Popup에서 두 기능을 각각 토글, 기능 OFF 시 버튼 제거

## 7. 마무리

- [x] 관심사별로 커밋 분리
- [x] 미검증 항목 명시
- [ ] 릴리즈
