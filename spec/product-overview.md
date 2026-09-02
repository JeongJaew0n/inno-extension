# Inno Extension 제품 개요

- 상태: Active
- 최종 갱신일: 2026-08-14
- 대상 버전: 0.3.x

## 한 줄 요약

Inno Extension은 사내 업무 사이트에서 반복적으로 수행하는 UI 조작을 더 가까운 위치에 제공하고, 여러 사이트의 편의 기능을 하나의 Chrome 확장 프로그램과 하나의 설정 화면에서 관리하게 한다.

## 배경과 사용자 문제

초기에는 아마란스의 출퇴근 버튼을 더 쉽게 누르기 위한 단일 사이트 확장으로 시작했다. 이후 Jira 보드 분석과 업무 링크 복사 같은 별도 편의 기능이 추가되면서 사이트별 확장을 따로 설치·빌드·관리하는 비용이 생겼다.

한편 모든 기능을 하나의 거대한 content script로 합치면 서로 다른 SPA의 URL, DOM selector, observer, cleanup 책임이 결합되어 한 사이트의 변경이 다른 사이트까지 깨뜨릴 수 있다. 제품은 설치와 설정은 하나로 유지하되, 실행 책임은 사이트와 기능 단위로 격리하는 방향을 택했다.

## 제품 목표

- 사내 사이트의 반복적인 화면 조작을 줄인다.
- 여러 서비스의 편의 기능을 하나의 확장 프로그램에서 발견하고 켜고 끌 수 있게 한다.
- 서비스 전체 활성화와 개별 기능 활성화를 분리해 사용자의 설정 조합을 보존한다.
- 각 기능이 독립적으로 시작·갱신·정리되어 SPA 변경과 기능 토글에 안전하게 대응한다.
- 최소 권한과 DOM 기반 상호작용을 기본으로 하며, 형식 변환은 가능한 경우 브라우저 내부의 순수 변환으로 제공한다.

## 비목표

- 사용자의 명시적 행동 없이 출퇴근이나 Jira 업무를 자동 처리하지 않는다.
- 승인되지 않은 사내 API나 세션 구조를 일반 기능에서 임의로 호출하지 않는다.
- 조직 전체 배포 정책이나 Chrome Web Store 운영을 현재 제품 범위로 보지 않는다.
- 모든 사내 사이트를 범용적으로 자동 지원하지 않는다. 새 사이트는 명시적인 catalog와 독립 runtime을 통해 추가한다.
- Popup을 복잡한 업무 애플리케이션으로 확장하지 않는다. 기능 탐색과 설정 관리에 집중한다.

## 서비스와 기능

| 서비스 | 기능 | 기본값 | 현재 범위 |
| --- | --- | --- | --- |
| 아마란스 | 헤더 출퇴근 버튼 | ON | 원본 출퇴근 버튼을 헤더 가까이에 제공하고 기록된 오늘 출근 시각의 인사말을 복사 |
| 아마란스 | 신청서 제목 자동채움 | ON | 근태신청서의 제목을 Popup에 저장한 문구로 입력 |
| Jira | 업무 링크 복사 | ON | Jira 보드 선택 업무와 직접 업무 조회 화면에서 링크 또는 링크+제목 복사 |
| Confluence | 본문 Markdown 복사 | ON | 문서 조회 화면에서 제목·댓글을 제외한 본문을 Markdown으로 복사 |
| Confluence | Markdown -> ADF 변환 | OFF | Popup 변환, `edit-v2` 코드블럭 -> ADF 변환 |
| GitHub Enterprise | PR 제목 링크 복사 | ON | 저장소 PR 목록과 PR 상세에서 제목을 Markdown 링크 또는 평문으로 복사 |
| GitHub Enterprise | 커밋 번호 복사 | ON | PR Conversation 탭 타임라인의 커밋 번호를 전체 SHA로 복사 |
| GitLab | 커밋 번호 복사 | ON | Merge Request 개요 탭의 커밋 목록에서 전체 SHA를 복사 |

기능별 상세 계약은 `spec/features/` 문서에서 관리한다.

## 공통 사용자 경험

Popup의 최상위 단위는 서비스다. 아마란스, Jira, Confluence, GitHub Enterprise, GitLab은 각각 하나의 서비스다. 사용자는 서비스 카드를 통해 대상 사이트와 활성 기능 수를 확인하고, 서비스 전체 기능을 한 번에 끄거나 상세 화면으로 이동한다. 서비스 상세에서는 기능별 토글과 적용 범위를 확인한다.

실제 실행 여부는 다음 규칙을 따른다.

```text
effectiveEnabled = site.enabled && feature.enabled
```

서비스 전체를 꺼도 하위 기능의 선택값은 보존한다. 서비스를 다시 켜면 기존 기능 조합이 복원된다.

## 제품 수준 행동 계약

- 기능은 기본적으로 사용자 행동을 보조하며, 원본 사이트의 업무 규칙을 우회하지 않는다.
- 같은 화면에서 여러 번 재평가되어도 기능 UI가 중복 생성되지 않아야 한다.
- 기능이나 사이트를 끄면 해당 기능이 만든 UI와 listener가 정리되어야 한다.
- SPA 이동이나 DOM 재렌더 이후에도 적용 조건이 유지되면 기능을 복구하고, 조건을 벗어나면 제거한다.
- 확장 프로그램이 실패해도 원본 사이트의 기본 기능은 계속 사용할 수 있어야 한다.
- 사용자에게 보이는 명칭은 사내 서비스 용어를 따른다. Jira의 `issue`는 UI에서 `업무`로 표현한다.

## 설정과 호환성

- 일반 설정은 `chrome.storage.sync`에 버전이 있는 스키마로 저장한다.
- 사이트 마스터 값과 기능별 활성 값을 분리한다.
- 새 기능이나 옵션이 추가되면 기존 저장값에 기본값을 보충한다.
- 내부 식별자는 저장소 호환성을 위해 표시 이름과 분리한다. 사용자 명칭이 바뀌어도 기존 기능 ID를 임의로 변경하지 않는다.
- 과거 Jira 패널의 단일 설정값은 현재 설정 구조로 이관할 수 있어야 한다.

## 기술적 맥락과 제약

- Chrome Manifest V3 기반이다.
- TypeScript strict 설정과 Vite, CRXJS 빌드 체계를 사용한다.
- 사이트별 content script entry를 분리해 origin 간 runtime 의존을 막는다.
- 사이트마다 하나의 조정 runtime을 두고 활성 기능의 lifecycle을 관리한다.
- Jira, Confluence와 아마란스 모두 SPA이므로 URL 이벤트만이 아니라 DOM 변경에도 대응해야 한다.
- DOM selector는 외부 사이트 UI 변경에 취약하므로 사이트별 중앙 계약으로 관리한다.
- 현재 권한은 설정 저장에 필요한 `storage` 중심이며, 기능상 꼭 필요하지 않은 광범위한 권한은 추가하지 않는다.

이 항목들은 구현 방법을 고정하려는 것이 아니라 제품의 안전성, 호환성, 장애 격리 수준을 유지하기 위한 제약이다.

## 보안과 개인정보

- 일반 DOM 기능의 인증, SSO, CSRF, 세션 쿠키는 원본 사이트가 처리하며 확장은 이를 읽거나 재현하지 않는다.
- 문서 본문은 기능 수행에 필요한 순간 현재 DOM에서만 읽고 별도 서버로 전송하지 않는다.
- Markdown -> ADF 입력과 결과는 Popup 메모리 또는 현재 Confluence 편집 DOM에서만 처리하고 별도 서버로 전송하지 않는다.
- 클립보드 쓰기는 사용자의 직접 클릭 안에서만 수행한다.
- 원격 코드를 로드하지 않고 배포 산출물에 포함된 코드만 실행한다.
- 사이트 권한은 실제 지원 origin으로 제한한다.

## 배포와 운영

- `npm run build`는 typecheck와 test를 먼저 수행한 후 `dist/`를 만든다.
- 개발 환경에서는 `dist/`를 unpacked extension으로 로드한다.
- 새 빌드를 반영하려면 확장 프로그램을 다시 로드하고 이미 열린 대상 사이트를 새로고침해야 한다.
- `npm run package`는 배포용 ZIP을 생성하고 산출물 무결성을 검사한다.
- 릴리즈 버전은 프로젝트 Skill `$extension-release`의 Semantic Versioning 정책으로 결정한다. `0.x.x`에서는 기능 추가와 호환되지 않는 초기 개발 변경은 MINOR, 기존 동작을 유지하는 수정은 PATCH로 관리한다.
- 이미 공개한 버전의 commit, tag, ZIP은 변경하지 않으며 수정이 필요하면 새 버전을 발행한다.

## 주요 결정과 트레이드오프

### 단일 확장, 분리된 runtime

설치와 설정 경험을 통합하기 위해 하나의 확장을 사용한다. 실행은 사이트별 content entry와 기능별 lifecycle로 격리한다. 약간의 플랫폼 코드가 추가되지만 장애 범위와 유지보수 비용을 줄인다.

### 서비스 전체 기능은 gate

서비스 전체 OFF는 하위 값을 덮어쓰지 않는다. 현재 유효 상태를 이해하는 데 한 단계가 추가되지만 사용자가 구성한 기능 조합을 잃지 않는다. 코드에서는 기존 `Site` 모델과 `site gate` 용어를 유지한다.

### DOM 우선

기존 로그인 세션과 원본 UI 동작을 활용한다. 별도 인증과 API 권한을 피할 수 있지만 외부 사이트의 DOM 변경에 영향을 받는다. selector 중앙화와 실제 사이트 확인을 운영 비용으로 수용한다.

Markdown -> ADF 변환은 API 없이 동작하는 로컬 도구다. Popup에서는 ADF JSON만 보여주고, Confluence `edit-v2`에서는 `코드블럭 -> ADF`가 각 코드블럭 안의 Markdown을 해당 위치의 편집 콘텐츠로 변환한다. 본문 전체를 Markdown으로 추정하는 toolbar 버튼은 제공하지 않는다. 편집기 적용은 Confluence가 제공하는 paste 처리 경계를 사용하므로 페이지 저장 API와 version conflict 책임을 피하고 실행 취소 흐름을 유지한다. 대신 외부 editor DOM과 paste 동작 변경에 영향을 받는다.

`코드블럭 -> ADF`와 `Mermaid -> ADF`는 MAIN world bridge로 대상 codeBlock에 실제 ProseMirror NodeSelection을 적용한다. 전자는 Markdown 변환 결과로 원위치 교체하고, 후자는 한 번의 paste transaction으로 Forge component와 접힌 `Mermaid 원본`을 만든다. 앱이 index로 참조하는 source는 접힌 영역에 보존하며 `코드블럭 -> ADF` 변환에서도 제외한다. 위치 검증에 실패하면 Confluence toolbar 실행 취소로 되돌린다.

### Vanilla TypeScript Popup

현재 규모에서는 별도 UI 프레임워크 없이 구현한다. 기능 수와 상호작용 복잡도가 크게 늘어날 때만 프레임워크 도입을 재검토한다.

## 품질 기준

- typecheck, unit test, production build가 성공해야 한다.
- manifest origin과 catalog origin이 일치해야 한다.
- 설정 migration과 site gate 동작을 회귀 테스트로 보호한다.
- DOM 의존 기능은 실제 로그인된 사이트에서 selector와 표시 결과를 확인한다.
- clipboard처럼 브라우저·붙여넣기 대상에 따라 결과가 달라지는 기능은 plain text와 rich text를 구분해 검증한다.
- 실제 근태 처리처럼 외부 부수효과가 있는 행동은 자동 검증하지 않고 안전한 범위까지만 확인한다.

## 알려진 리스크와 열린 질문

- 외부 사이트의 `data-testid`, class, DOM 계층 변경으로 기능이 중단될 수 있다.
- Chrome 내부 확장 관리 화면을 자동 제어하기 어려워 최신 `dist` 재로드 여부가 실제 E2E 결과에 영향을 준다.
- 기능 수가 늘면 Popup의 정보 구조와 catalog 표현력이 부족해질 수 있다.
- 실제 조직 배포 방식, 버전 배포 정책, 자동 업데이트 경로는 아직 확정되지 않았다.
- Jira 보드 하위 view 중 `backlog`는 업무 링크 복사 범위에 포함했다. `timeline`, `calendar`, `reports`까지 확대할지는 기능별로 결정해야 한다.

## 변경 이력

- 2026-07-09: 아마란스 출퇴근 버튼을 헤더 가까이에 제공하는 단일 사이트 확장으로 시작했다.
- 2026-07-10: 실제 헤더 구조에 맞춰 버튼 위치를 알림 상세 영역 아래로 조정했다.
- 2026-08-04: 아마란스와 Jira 기능을 하나의 멀티 사이트 확장으로 통합하고 Popup 설정, 기능 lifecycle, 설정 migration을 도입했다.
- 2026-08-04: 서비스 아이콘과 확장 프로그램 전용 아이콘을 로컬 자산으로 포함했다.
- 2026-08-04: Jira 업무 링크 복사를 단일 NPT 보드 제한에서 모든 Jira 보드로 확장하고, 업무 용어와 제목 포함 복사를 지원했다.
- 2026-08-04: 아마란스와 Jira 같은 최상위 기능 분류의 사용자 용어를 `서비스`로 확정했다.
- 2026-08-04: 아마란스 서비스 아이콘을 투명 배경의 256px 전용 자산으로 교체해 고밀도 화면에서의 선명도를 개선했다.
- 2026-08-04: 아마란스 근태신청서에 사용자 설정 문구를 입력하는 제목 자동채움 기능을 추가했다.
- 2026-08-07: Confluence를 독립 서비스로 추가하고 문서 조회 화면의 본문을 Markdown으로 복사하는 기능을 도입했다.
- 2026-08-11: DOM 기반 복사를 유지하면서 ADF API 기반 고정밀 Markdown 내보내기와 명시적 본문 추가 기능을 기본 OFF로 분리하기로 결정했다.
- 2026-08-11: ADF 도구의 범위를 로컬 Markdown -> ADF JSON 변환으로 축소하고 API 인증, 고정밀 내보내기, 원격 문서 추가, 결과 복사·다운로드를 제거했다.
- 2026-08-11: Confluence `edit-v2` toolbar에서 일반 문단 형태의 Markdown 본문 전체를 편집 콘텐츠로 변환하는 버튼을 추가했다. API 저장 대신 편집기의 실행 취소·사용자 업데이트 흐름을 따르도록 했다.
- 2026-08-11: Confluence 편집 본문의 코드블럭 서식을 일괄 제거하는 버튼을 추가하고, 기존 ADF의 Mermaid 자동 매크로 변환은 Forge 앱 계약이 공개·검증되기 전까지 지원하지 않기로 했다.
- 2026-08-11: 공식 ADF schema의 extension paste 계약과 tenant의 Mermaid extension key를 확인해 기존 결정을 갱신하고, Mermaid 코드 블록만 원본 뒤에 Forge 매크로를 생성하는 `Mermaid -> ADF`를 추가했다.
- 2026-08-12: DOM Range 기반 paste가 ProseMirror 내부 selection을 갱신하지 않아 문서 최상단에 삽입되는 문제를 수정했다. MAIN world selection bridge, 공식 expand DOM 표현, 실제 toolbar undo, 엄격한 pair 검증을 적용하고 실제 Confluence 편집기에서 두 Mermaid의 원위치 치환과 중복 방지를 확인했다.
- 2026-08-12: 저장 ADF에서 macro가 실제 생성된 것을 확인해 실패 판단을 정정했다. 비동기 완료 대기, top-level 위치 삽입, 접힌 source 보존, unpaired component 중복 방지를 반영했다.
- 2026-08-12: Confluence 편집기의 본문 전체 Markdown 변환 버튼을 제거하고, 코드블럭의 Markdown만 원위치 ADF 콘텐츠로 교체하는 `코드블럭 -> ADF`로 통합했다. Mermaid component가 참조하는 접힌 원본은 변환 대상에서 제외한다.
- 2026-08-13: 아마란스 헤더 출근 버튼 아래에 현재 시각을 `n시 n분 출근입니다.` 형식으로 복사하는 `인사말 복사` 버튼을 추가했다.
- 2026-08-14: 프로젝트 릴리즈를 재현 가능한 절차로 관리하기 위해 `$extension-release` Skill과 Semantic Versioning 정책을 추가했다. `0.x.x` 버전 결정, 패키징 검증, annotated tag, GitHub Release 발행, 공개 버전 불변 원칙을 릴리즈 계약으로 확정했다.
- 2026-08-24: `NPT 보드 정보 패널` 기능을 제거했다. 기본 비활성 상태로 유지되던 보조 정보 표시 기능이며, 실사용 근거가 없어 catalog, 기본 설정, Popup 옵션, 전용 selector와 함께 삭제했다. 저장된 설정에 남은 값은 정규화 과정에서 무시된다. 이 기능만을 위해 존재하던 `overlayEnabled` 레거시 설정 이관도 함께 제거했다.
- 2026-08-25: GitHub Enterprise(`github.nhnent.com`)를 네 번째 지원 사이트로 추가하고 `PR 제목 링크 복사` 기능을 도입했다. 저장소 PR 목록과 PR 상세에서 제목을 `[제목](URL)` Markdown 링크로 복사한다. 전역 PR 대시보드 `/pulls`는 DOM 구조가 같지만 적용 범위에서 제외했다.
- 2026-08-26: 아마란스 인사말 복사의 시각 기준을 클릭 순간의 브라우저 시간에서 근무시간 위젯에 기록된 오늘 출근 시각으로 바꿨다. 출근 처리와 복사 사이의 시간차로 실제 근태와 다른 문구가 만들어지던 문제를 없앴다.
- 2026-08-26: GitLab(`rnd-app.innogrid.com`)을 다섯 번째 지원 사이트로 추가하고 `커밋 번호 복사` 기능을 도입했다. Merge Request 개요 탭의 `added N commits` 목록에서 커밋 번호 오른쪽 버튼으로 40자 전체 SHA를 복사한다. 같은 클래스가 사용자 댓글의 커밋 참조에도 쓰이므로 시스템 노트로 범위를 한정했다.
- 2026-08-26: GitHub Enterprise에 `커밋 번호 복사` 기능을 추가했다. PR Conversation 탭 타임라인의 커밋 번호 오른쪽 버튼으로 40자 전체 SHA를 복사한다. Commits 탭에는 GitHub 기본 `Copy full SHA` 버튼이 이미 있어 route 판정과 타임라인 스코프로 이중 배제했다.
- 2026-09-02: GitHub Enterprise `PR 제목 링크 복사`에 제목만 평문으로 복사하는 버튼을 추가했다. 별도 기능으로 나누지 않고 같은 host에 버튼을 더해 앵커 경쟁으로 인한 host 재생성을 피했다.

## 관련 문서

- [Jira 업무 링크 복사](./features/jira-work-link-copy.md)
- [아마란스 신청서 제목 자동채움](./features/amaranth-title-autofill.md)
- [Confluence 문서 본문 Markdown 복사](./features/confluence-page-markdown-copy.md)
- [Confluence Markdown -> ADF 변환기](./features/confluence-adf-markdown-tools.md)
- [용어사전](./glossary.md)
- [사후 기록](../docs/postmortems/README.md)
- [멀티 사이트 통합 계획](../docs/plans/inno-extension-multi-site/spec.md)
- [아마란스 출퇴근 기능 계획](../docs/plans/gw-checkin-header-buttons/spec.md)
- [Jira 보드 분석](../docs/jira-board-2146-chrome-extension-analysis.md)
