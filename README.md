# Inno Extension

아마란스와 Jira의 사내 업무 편의 기능을 하나의 Chrome Extension으로 제공한다.

## 지원 사이트와 기능

### 아마란스

- 대상: `https://gw.innogrid.com/*`
- 헤더 출퇴근 버튼
  - 헤더에 출근/퇴근 버튼을 표시한다.
  - 클릭 시 사이트의 원본 출퇴근 버튼으로 이벤트를 위임한다.
  - 원본 active 상태를 주입 버튼에 동기화한다.

### Jira

- 대상: `https://pms-innogrid.atlassian.net/*`
- 이슈 링크 복사
  - NPT 보드 2146에서 선택한 이슈 번호 옆에 복사 버튼을 표시한다.
  - `text/plain=NPT-n`, `text/html=<a href="...">NPT-n</a>` 형태로 복사한다.
- NPT 보드 정보 패널
  - 현재 보드, 화면 이슈 수, 선택 이슈를 표시한다.
  - 기본값은 OFF이며 Popup에서 프로젝트 키와 보드 ID를 설정할 수 있다.

## Popup 설정

- 사이트 목록에서 아마란스/Jira 마스터 토글을 켜고 끈다.
- 사이트를 꺼도 하위 기능의 enabled 값은 보존된다.
- 사이트 상세에서 기능별 토글을 독립적으로 변경한다.
- 기능 상세에서 적용 범위와 세부 옵션을 확인하거나 초기화한다.

실제 기능 실행 여부는 다음 규칙을 따른다.

```text
effectiveEnabled = site.enabled && feature.enabled
```

## 개발

```bash
npm install
npm run typecheck
npm test
npm run build
npm run package
```

- `npm run build`: 검사 후 `dist/` 생성
- `npm run package`: 검사와 빌드 후 `release/inno-extension-<version>.zip` 생성 및 무결성 검사

## Chrome에 로드

1. `npm run build`를 실행한다.
2. Chrome에서 `chrome://extensions`를 연다.
3. 개발자 모드를 켠다.
4. `압축해제된 확장 프로그램을 로드합니다`에서 이 저장소의 `dist/`를 선택한다.
5. 수정 후에는 다시 빌드하고 확장 프로그램 새로고침 버튼을 누른다.

## 구조

```text
src/
├── background/       설치 시 설정 초기화·migration
├── catalog/          사이트와 기능 metadata
├── platform/
│   ├── runtime/      site runtime과 feature lifecycle
│   └── settings/     버전화된 storage schema와 repository
├── popup/            사이트 목록, 사이트 상세, 기능 상세, 일반 설정
└── sites/
    ├── amaranth/     아마란스 content entry와 기능
    └── jira/         Jira content entry와 기능
```

사이트 runtime은 사이트당 하나의 MutationObserver를 사용하며 활성 기능의 `reconcile()`을 호출한다. 기능이 꺼지면 `dispose()`로 자신이 만든 DOM, style, timer, listener를 정리한다.

## 새 기능 추가

1. `src/catalog/sites.ts`에 기능 metadata를 추가한다.
2. `src/platform/settings/defaults.ts`에 기본 설정을 추가한다.
3. 해당 `src/sites/<site>/features/<feature>/` 아래에 `FeatureRuntime`을 구현한다.
4. 사이트 content entry의 runtime 목록에 기능을 등록한다.
5. 옵션이 있다면 Popup 기능 상세 renderer를 추가한다.
6. catalog/default/route/lifecycle 회귀 테스트를 추가한다.

## 계획 문서

- 통합 설계와 작업 체크리스트: `docs/plans/inno-extension-multi-site/`
- 기존 아마란스 기능 맥락: `docs/plans/gw-checkin-header-buttons/`
