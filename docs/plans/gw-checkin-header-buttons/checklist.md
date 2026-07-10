# checklist — gw-checkin-header-buttons

> 작업 진행하면서 AI 가 순차적으로 체크. `[x]` 로 표시한 항목은 완료된 것으로 간주.
> 새 항목이 발견되면 적절한 단계에 추가하고 체크리스트를 유지한다.

## 0. 준비
- [x] spec.md / context.md 다시 한 번 읽고 어긋난 곳 없는지 확인
- [x] gw.innogrid.com 로그인 상태에서 실제 DOM(`.noti-details`, `.worktime ul.btns li`) 재확인

## 1. 프로젝트 스캐폴딩
- [x] package.json / tsconfig.json 생성
- [x] Vite + 확장 번들 구성 (`@crxjs/vite-plugin`)
- [x] manifest.json (MV3) 작성 — content_scripts 매칭: `https://gw.innogrid.com/*`
- [x] 디렉터리 구조 생성: src/content/, src/shared/

## 2. 구현
- [x] `src/shared/selectors.ts` — 대상 selector 상수 중앙화
- [x] `src/content/injectButtons.ts` — noti-details 아래에 출근/퇴근 버튼 DOM 생성
- [x] `src/content/delegate.ts` — 헤더 버튼 클릭 → 원본 li.click() 위임
- [x] `src/content/delegate.ts` — 원본 active 상태를 헤더 버튼에 동기화
- [x] `src/content/observer.ts` — MutationObserver 로 헤더/버튼 사라지면 재주입
- [x] `src/content/index.ts` — 진입점: 최초 주입 + observer 시작
- [x] `src/content/styles.ts` — 헤더 톤에 맞춘 버튼 스타일 (<style> 주입)

## 3. 검증
- [x] Vite 빌드 성공 (dist 산출물 생성)
- [x] 타입 체크 통과 (tsc --noEmit)
- [ ] 실제 gw 페이지에 번들 주입 → 헤더 `noti-details` **아래**에 버튼 표시 확인
- [x] 가로 float 배치 의존 제거, `noti-details` 아래 블록 배치로 단순화
- [x] 현재 상태(active) 반영 확인 — 원본 "퇴근" active 가 헤더 버튼에 파란색으로 반영됨
- [ ] 크롬에 "압축해제된 확장(dist/)" 으로 로드 — **사용자가 직접 수행 필요**
- [ ] 출근/퇴근 클릭 → 원본 처리 동작 확인 — **실제 근태 영향 있어 사용자가 실사용 시 확인**
- [ ] SPA 내 화면 이동 후 버튼 유지(재주입) 확인 — 로드 후 실사용 확인 권장

## 4. 마무리
- [x] README 에 설치/로드 방법 기록
- [ ] git commit / push — **사용자 허락 후 진행**
- [ ] 실사용 후 미세 조정(버튼 세로 정렬, 색상 등) 피드백 반영

## 남은 작업 메모
- 확장 로드와 실제 출퇴근 클릭 검증은 부수효과(실제 근태 처리)가 있어 사용자 몫으로 남김.
  검증 시에는 주입/표시/상태동기화까지만 자동 확인했고, 실제 li.click() 은 호출하지 않았다.
- 원본 li 에 React onClick 이 바인딩된 것과, delegateClick 이 원본을 찾는 경로는 확인 완료.
