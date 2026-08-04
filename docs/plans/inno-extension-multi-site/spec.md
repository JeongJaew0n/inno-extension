# spec — inno-extension-multi-site

## 목표

`/Users/jjw/my/Dev/inno-extension`을 단일 기준 저장소로 삼아 아마란스와 Jira 편의 기능을 하나의 Chrome Extension으로 통합하고, 사이트별 마스터 토글과 하위 기능별 토글·상세 설정을 제공한다.

## 범위

- 포함:
  - 기존 아마란스 확장 기능을 통합 저장소의 `amaranth` 사이트 모듈로 이관
  - 현재 Jira 확장의 이슈 링크 복사 기능과 NPT 보드 정보 패널 기능 이관
  - 아마란스와 Jira를 서로 다른 content script entry와 runtime으로 격리
  - 사이트/기능 metadata를 관리하는 직렬화 가능한 catalog 구성
  - 사이트 마스터 토글과 기능별 토글을 저장하는 버전화된 설정 계층 구성
  - Popup에 사이트 목록, 사이트 상세, 기능 상세, 일반 설정 화면 구성
  - 실제 아마란스/Jira favicon을 로컬 asset으로 포함해 사이트 카드 아이콘으로 표시
  - 토글 변경 시 실행 중인 기능을 mount/reconcile/dispose하는 lifecycle 구성
  - 아마란스 hash SPA와 Jira SPA DOM 변경 대응
  - 단일 `dist/` 및 배포 ZIP 생성
  - 설정·route·clipboard·lifecycle 단위 테스트와 실제 사이트 수동 E2E
- 제외:
  - 조직 전체 배포 정책 및 Chrome Web Store 등록
  - 설정 export/import
  - 아마란스와 Jira 외 세 번째 사이트
  - 출퇴근 자동화, API 직접 호출, 토큰 분석
  - 기존 원본 저장소 즉시 삭제
  - Popup UI 프레임워크 도입; 초기 구현은 Vanilla TypeScript 사용

## 완료 조건 (Definition of Done)

- [ ] `/Users/jjw/my/Dev/inno-extension`의 단일 빌드 산출물이 두 origin에서 동작한다.
- [ ] `https://gw.innogrid.com/*`와 `https://pms-innogrid.atlassian.net/jira/*`가 서로 다른 content entry를 사용한다.
- [ ] 사이트 마스터 OFF 시 해당 사이트의 모든 주입 DOM, style, timer, observer가 정리된다.
- [ ] 사이트 OFF/ON 후 하위 기능 enabled 값이 보존된다.
- [ ] 기능 하나를 OFF해도 같은 사이트의 다른 기능은 계속 동작한다.
- [ ] Popup에서 사이트별 활성 기능 수 `X/Y`가 정확히 표시된다.
- [ ] Popup 사이트 카드가 문자 placeholder 대신 해당 사이트의 로컬 favicon을 표시한다.
- [ ] Popup에서 사이트 목록 → 사이트 상세 → 기능 상세로 이동하고 뒤로 갈 수 있다.
- [ ] Chrome 재시작 또는 Popup 재실행 후 설정이 유지된다.
- [ ] 아마란스 헤더 출근/퇴근 버튼 클릭이 기존 원본 버튼으로 위임된다.
- [ ] 아마란스 원본 active 상태가 주입 버튼에 동기화된다.
- [ ] Jira 이슈 링크 복사는 `text/plain=NPT-n`과 `text/html=<a href="...">NPT-n</a>`를 생성한다.
- [ ] Jira 보드 패널과 이슈 링크 복사가 독립적으로 켜고 꺼진다.
- [ ] 지원하지 않는 Jira URL/보드에는 기능 DOM이 주입되지 않는다.
- [ ] TypeScript typecheck, unit test, build가 모두 성공한다.
- [ ] 배포 ZIP에 실행에 불필요한 test, docs, source map이 포함되지 않는다.
- [ ] 통합 확장 검증 전까지 기존 두 저장소의 구현과 배포 산출물을 삭제하지 않는다.

## 인터페이스 / 데이터 형식

### 사이트와 기능 식별자

```ts
type SiteId = 'amaranth' | 'jira';

type FeatureId =
  | 'attendanceHeader'
  | 'issueLinkCopy'
  | 'boardInspector';
```

식별자는 storage key와 내부 routing에 사용하므로 표시 이름과 분리하고, 출시 이후 임의로 변경하지 않는다.

### Catalog

Popup과 background가 읽는 catalog에는 DOM 함수나 site runtime을 포함하지 않는다.

```ts
interface SiteDescriptor {
  id: SiteId;
  name: string;
  hostLabel: string;
  origin: string;
  contentMatches: readonly string[];
  color: string;
  features: FeatureDescriptor[];
}

interface FeatureDescriptor {
  id: FeatureId;
  name: string;
  description: string;
  routeSummary: string;
  defaultEnabled: boolean;
  hasDetails: boolean;
}
```

### Feature lifecycle

```ts
interface PageContext {
  url: URL;
  document: Document;
}

interface FeatureRuntime {
  readonly id: FeatureId;
  reconcile(context: PageContext): void | Promise<void>;
  dispose(): void;
}
```

- `reconcile()`은 반복 호출에 안전한 idempotent 함수여야 한다.
- `dispose()`는 해당 기능이 생성한 DOM, style, observer, timer, listener를 모두 제거해야 한다.
- site runtime은 storage 변경과 URL/DOM 변경을 debounce해 활성 기능에 전달한다.

### 설정 스키마

```ts
interface ExtensionSettingsV1 {
  schemaVersion: 1;
  sites: {
    amaranth: {
      enabled: boolean;
      features: {
        attendanceHeader: {
          enabled: boolean;
          options: Record<string, never>;
        };
      };
    };
    jira: {
      enabled: boolean;
      features: {
        issueLinkCopy: {
          enabled: boolean;
          options: Record<string, never>;
        };
        boardInspector: {
          enabled: boolean;
          options: {
            supportedProjectKeys: string[];
            supportedBoardIds: string[];
          };
        };
      };
    };
  };
}
```

실행 여부는 다음 식으로만 계산한다.

```ts
const effectiveEnabled = site.enabled && feature.enabled;
```

사이트 마스터 토글은 하위 기능 값을 변경하지 않는 gate다. OFF 상태에서도 사이트 상세 진입과 하위 설정 변경은 허용한다.

### Popup route

```text
#/                              사이트 목록
#/sites/amaranth                아마란스 기능 목록
#/sites/jira                    Jira 기능 목록
#/sites/:site/features/:feature 기능 상세
#/settings                      일반 설정
```

### 권장 소스 구조

```text
src/
├── catalog/
├── platform/
│   ├── runtime/
│   ├── settings/
│   └── messaging/
├── sites/
│   ├── amaranth/
│   │   └── features/attendanceHeader/
│   └── jira/
│       └── features/
│           ├── issueLinkCopy/
│           └── boardInspector/
├── popup/
└── background/
```

### Manifest

- Manifest V3
- 권한: 초기에는 `storage`만 사용
- content entries:
  - `https://gw.innogrid.com/*` → 아마란스 entry
  - `https://pms-innogrid.atlassian.net/jira/*` → Jira entry
- `action.default_popup`과 background service worker 추가
- clipboard는 사용자 클릭 제스처 안에서 처리하며, E2E에서 필요성이 확인되지 않으면 `clipboardWrite` 권한을 추가하지 않는다.

## 의존성

- 외부 라이브러리·서비스·CLI:
  - Chrome Manifest V3
  - TypeScript
  - Vite
  - `@crxjs/vite-plugin`
  - Node.js 내장 `node:test`
  - Vite SSR test bundle runner (`scripts/run-tests.mjs`), 추가 테스트 런타임 의존성 없음
- 사전 작업으로 끝나야 하는 항목:
  - 기준 저장소 `/Users/jjw/my/Dev/inno-extension`의 현재 아마란스 기능 회귀 기준 확보
  - 이관 원본 `/Users/jjw/my/Dev_ENT/jjw_inno_extension`의 Jira 테스트 및 빌드 성공 확인
  - 두 확장을 동시에 활성화했을 때 중복 주입될 수 있음을 전환 절차에 명시

## 비고

- 기준 저장소와 plan memory의 정본은 `/Users/jjw/my/Dev/inno-extension`이다. 최초 작성본은 Jira 원본 저장소에 남겨 이관 근거로만 보존한다.
- 설정은 `chrome.storage.sync`, 일시적인 현재 탭 상태는 메시지 응답으로만 다룬다.
- 서로 다른 unpacked extension ID 사이에서는 storage를 자동으로 읽을 수 없다. 같은 extension ID에 과거 `overlayEnabled`가 존재할 때만 V1 migration 대상으로 취급한다.
- Popup metadata catalog와 site runtime registry를 파일 수준에서 분리해 Popup bundle에 DOM runtime이 포함되지 않게 한다.
- 신규 설치 기본값은 아마란스 헤더 버튼 ON, Jira 링크 복사 ON, Jira 보드 패널 OFF를 권장한다.
- 최초 상세 아키텍처 원본은 `/Users/jjw/my/Dev_ENT/jjw_inno_extension/.omx/plans/inno-extension-multi-site-architecture.md`에 있다.
