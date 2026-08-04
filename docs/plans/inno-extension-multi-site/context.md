# context — inno-extension-multi-site

## 사용자의 원 요청

사용자는 Jira용 Chrome Extension을 새로 만들던 중 기존 아마란스 확장 저장소 `/Users/jjw/my/Dev/inno-extension`이 이미 존재한다는 사실을 확인했다. 이후 현재 Jira 확장의 전체 기능을 기존 저장소로 이관하고, 첨부한 참고 UI처럼 사이트별 대분류와 기능별 세부 토글·설정 화면을 갖는 단일 확장 프로그램의 큰 범위 아키텍처 설계를 요청했다.

사용자가 지정한 사이트 범위는 다음과 같다.

- 아마란스: `https://gw.innogrid.com/#/`
- Jira: `https://pms-innogrid.atlassian.net/`

## 왜 이걸 지금 하는가

현재 기능이 두 저장소와 두 확장 프로그램으로 나뉘어 있다.

- `/Users/jjw/my/Dev/inno-extension`
  - 아마란스 `gw.innogrid.com` 전용
  - 헤더에 출근/퇴근 버튼을 주입하고 원본 버튼 클릭을 위임
  - TypeScript + Vite + CRXJS 구성
  - Popup, background, storage 설정 계층 없음
- `/Users/jjw/my/Dev_ENT/jjw_inno_extension`
  - Jira `pms-innogrid.atlassian.net` 전용
  - NPT board 2146 정보 패널과 선택 이슈 링크 복사 제공
  - Popup과 `chrome.storage.sync` 기반 단일 토글 존재
  - JavaScript와 별도 Node 빌드 스크립트 사용

기능이 계속 늘어나면 사이트별 확장을 따로 관리하는 방식은 빌드, 설치, 설정, 배포가 분산된다. 반대로 기존 아마란스 content script에 Jira 코드를 직접 합치면 selector, observer, URL 조건, cleanup 책임이 섞여 회귀 위험이 커진다. 따라서 실제 파일 이관 전에 사이트와 기능 경계를 정의하는 플랫폼 설계가 필요해졌다.

## 결정된 방향

`/Users/jjw/my/Dev/inno-extension`을 단일 기준 저장소로 사용하고, 기존 TypeScript + Vite + CRXJS 체계를 유지한다. 아마란스와 Jira는 origin별 content entry와 site runtime으로 격리하고, 각 기능은 독립적인 lifecycle과 설정을 갖는다. Popup은 직렬화 가능한 catalog를 기반으로 사이트 목록 → 사이트 상세 → 기능 상세 화면을 구성한다.

핵심 상태 규칙은 다음과 같다.

```text
effectiveEnabled = site.enabled && feature.enabled
```

사이트 마스터 OFF는 하위 설정을 지우거나 변경하지 않는다. 사이트를 다시 켜면 사용자가 이전에 선택한 기능 조합이 복원된다.

## 기각된 대안

- 아마란스와 Jira 확장을 계속 별도로 유지 — 설치와 배포가 분산되고 사용자가 두 확장을 각각 관리해야 하므로 기각.
- 모든 사이트 기능을 하나의 거대한 content script에 합치기 — 두 SPA의 URL 조건, selector, MutationObserver, cleanup이 결합되어 장애 범위가 커지므로 기각.
- Popup catalog와 runtime registry를 하나의 객체로 합치기 — Popup bundle이 사이트 DOM 코드까지 import할 가능성이 있어 번들 경계가 무너지므로 기각.
- 사이트 마스터 OFF 시 모든 자식 토글도 OFF로 덮어쓰기 — 사용자가 구성한 기능 조합을 잃고 다시 켤 때 복원할 수 없으므로 기각.
- 현재 단계에서 React/Preact를 즉시 도입 — 참고 UI는 Vanilla TypeScript로 구현 가능한 규모이고 기존 저장소에 새 UI 런타임 의존성을 추가할 필요가 아직 없으므로 보류.
- 기존 저장소를 먼저 삭제한 뒤 통합 — 검증 전 회귀 시 복구 경로가 사라지므로 기각.

## 제약 / 합의 사항

- 기술적 제약:
  - Chrome Manifest V3 기준
  - 기준 저장소의 TypeScript strict 설정 유지
  - Vite와 `@crxjs/vite-plugin` 유지
  - 사이트별 content script는 서로의 runtime을 import하지 않음
  - 모든 기능은 토글 OFF에 대응하는 명시적 `dispose()` 구현
  - DOM selector는 사이트별 중앙 파일로 관리
  - Jira 링크 복사는 Markdown 문자열 생성이 아니라 브라우저 링크 복사와 같은 clipboard payload 사용
- 시간·범위 제약:
  - 이번 단계는 계획 영속화이며 실제 이관은 별도 지시 후 시작
  - Chrome Web Store 등록과 조직 배포 정책은 현재 범위 아님
  - 기능별 고급 옵션은 실제 요구가 생길 때 추가
- 사용자가 명시한 선호:
  - 사이트를 기능 대분류로 표시
  - 사이트별 마스터 토글 제공
  - 사이트 하위에 세부 기능 목록과 개별 토글 제공
  - 기능 상세 화면에서 별도 설정 가능
  - 첨부 UI처럼 사이트 카드, 활성 기능 수, 토글, 상세 진입 구조 사용

## 관련 자료

- 기준 저장소: `/Users/jjw/my/Dev/inno-extension`
- 기준 저장소 Manifest: `/Users/jjw/my/Dev/inno-extension/manifest.json`
- 기존 아마란스 observer: `/Users/jjw/my/Dev/inno-extension/src/content/observer.ts`
- 기존 아마란스 selector: `/Users/jjw/my/Dev/inno-extension/src/shared/selectors.ts`
- 아마란스 기존 계획: `/Users/jjw/my/Dev/inno-extension/docs/plans/gw-checkin-header-buttons/`
- Jira 이관 원본: `/Users/jjw/my/Dev_ENT/jjw_inno_extension`
- Jira content script: `/Users/jjw/my/Dev_ENT/jjw_inno_extension/src/content/content.js`
- Jira core: `/Users/jjw/my/Dev_ENT/jjw_inno_extension/src/shared/core.js`
- 상세 아키텍처 설계: `/Users/jjw/my/Dev_ENT/jjw_inno_extension/.omx/plans/inno-extension-multi-site-architecture.md`
- 첨부 UI 1: `/var/folders/q4/4hy163xd0q15cbw0hbvqnc4r0000gn/T/codex-clipboard-06674cb1-711a-451c-aae6-8ecace34c8b6.png`
- 첨부 UI 2: `/var/folders/q4/4hy163xd0q15cbw0hbvqnc4r0000gn/T/codex-clipboard-161f4d8f-c13e-4a0c-9d9b-38831962f2f2.png`

## 변경 이력

- 2026-08-04: 실제 통합 작업 착수와 함께 plan memory 정본을 `/Users/jjw/my/Dev/inno-extension/docs/plans/inno-extension-multi-site/`로 이관했다. 최초 작성본은 Jira 원본 저장소에 보존한다.
- 2026-08-04: 사용자가 사이트 카드의 문자 아이콘 대신 각 사이트의 실제 favicon을 내려받아 사용하도록 요청했다. 로그인된 실제 페이지가 사용하는 32×32 PNG 원본을 추출해 Popup 로컬 asset으로 포함하기로 했다.
