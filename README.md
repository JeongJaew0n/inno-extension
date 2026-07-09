# Inno GW 출퇴근 헤더 버튼

gw.innogrid.com(더존 그룹웨어)의 출근/퇴근 버튼을 화면 상단 헤더의 프로필(`user-info`)
왼쪽에 고정 배치해, 스크롤 없이 바로 누를 수 있게 하는 크롬 확장입니다.

헤더 버튼을 누르면 원본 출퇴근 버튼이 대신 클릭되어 실제 근태 처리가 이루어집니다.
자동화·알림·API 호출은 하지 않습니다(순수 UI 편의 기능).

## 개발 / 빌드

```bash
npm install
npm run build      # dist/ 생성
npm run typecheck  # 타입 체크
```

## 크롬에 로드하기

1. `npm run build` 로 `dist/` 를 생성한다.
2. 크롬에서 `chrome://extensions` 열기
3. 우측 상단 **개발자 모드** 켜기
4. **압축해제된 확장 프로그램을 로드합니다** 클릭 → 이 프로젝트의 `dist/` 폴더 선택
5. https://gw.innogrid.com 에 접속하면 헤더 프로필 왼쪽에 출근/퇴근 버튼이 나타난다.

수정 후에는 `npm run build` 를 다시 실행하고, 확장 페이지에서 새로고침(↻) 아이콘을 누른다.

## 구조

```
manifest.json              MV3, content_scripts: gw.innogrid.com 매칭
vite.config.ts             @crxjs/vite-plugin 으로 번들
src/
├── content/
│   ├── index.ts           진입점: observer 시작
│   ├── injectButtons.ts   user-info 왼쪽에 버튼 생성/주입
│   ├── delegate.ts        원본 출퇴근 li 클릭 위임 + active 상태 동기화
│   ├── observer.ts        MutationObserver: SPA 리렌더 시 재주입
│   └── styles.ts          주입 버튼 스타일(<style> 주입)
└── shared/
    └── selectors.ts       대상 DOM selector 중앙화(더존 업데이트 대응 지점)
```

## 동작이 멈췄을 때

더존 그룹웨어가 업데이트되면 DOM 구조가 바뀌어 버튼이 안 보일 수 있습니다.
그럴 때는 `src/shared/selectors.ts` 의 selector 상수를 실제 페이지 DOM 에 맞게 고치고
다시 빌드하면 됩니다. 이 파일이 유일한 취약 지점입니다.

- `USER_INFO` — 버튼을 붙일 헤더 기준 요소
- `CHECKIN_LI` / `CHECKOUT_LI` — 원본 출근/퇴근 버튼
- `ACTIVE_CLASS` — 원본의 활성 상태 클래스
