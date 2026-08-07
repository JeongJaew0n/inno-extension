# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-08-04
- Primary product surfaces: Chrome Popup, 아마란스와 Jira에 주입되는 보조 UI
- Evidence reviewed: `README.md`, `spec/product-overview.md`, `spec/features/`, `src/popup/main.ts`, `src/popup/popup.css`, 사이트별 runtime과 style

## Brand

- Personality: 빠르고 실용적인 사내 업무 도구, 차분하고 직접적인 안내
- Trust signals: 사용자가 누른 행동만 실행하고 성공·실패·비활성 이유를 즉시 보여 준다.
- Avoid: 원본 서비스처럼 가장하는 UI, 과도한 장식, 모호한 성공 상태, 업무를 자동 제출하는 인상

## Product goals

- Goals: 반복 조작 단축, 서비스·기능별 발견 가능성, 설정 상태와 실행 결과의 명확한 피드백
- Non-goals: 원본 업무 앱 대체, 복잡한 워크플로 자동화, 새로운 범용 디자인 시스템 구축
- Success signals: 기능 위치와 다음 행동을 별도 설명 없이 이해하고, 실행·저장 성공 여부를 즉시 판단할 수 있다.

## Personas and jobs

- Primary personas: 아마란스와 Jira를 반복적으로 사용하는 사내 구성원
- User jobs: 자주 쓰는 동작을 가까운 위치에서 실행하고, 필요한 문구와 적용 범위를 직접 설정한다.
- Key contexts of use: 데스크톱 Chrome, 로그인된 사내 업무 화면, 짧은 시간 안에 반복 작업을 처리하는 상황

## Information architecture

- Primary navigation: Popup의 `편의기능`과 `설정` 탭
- Core routes/screens: 서비스 목록 → 서비스 상세 → 기능 상세
- Content hierarchy: 서비스 상태, 기능 상태, 적용 범위, 상세 옵션, 초기화 순서

## Design principles

- 상태는 숨기지 않는다: 저장·성공·실패·비활성 상태를 해당 컨트롤 가까이에서 보여 준다.
- 다음 행동을 알려 준다: 비활성 상태는 이유와 해결 경로를 함께 제공한다.
- 원본 흐름을 존중한다: 보조 UI는 원본 제출이나 결재를 대신하지 않는다.
- Tradeoffs: Popup의 제한된 면적에서는 장문 설명보다 짧은 상태 문구와 필요 시 노출되는 툴팁을 우선한다.

## Visual language

- Color: Popup의 보라색 강조색을 기본으로 사용하고 성공은 녹색, 오류는 붉은색으로 보조한다.
- Typography: 시스템 sans-serif, 10~15px 중심의 조밀한 업무 도구 스케일
- Spacing/layout rhythm: 4~8px 내부 간격과 10~16px 섹션 간격
- Shape/radius/elevation: Popup은 7~12px radius, 주입 버튼은 원본 아마란스의 작은 사각형 버튼 형태에 맞춘다.
- Motion: 150ms 안팎의 짧은 전환만 사용하며 성공 확인은 한 번만 강조한다.
- Imagery/iconography: 서비스 식별에는 로컬 아이콘을 사용하고 상태 전달은 텍스트와 최소한의 기호를 병행한다.

## Components

- Existing components to reuse: 서비스 카드, 기능 카드, switch, secondary button, option field, notice
- New/changed components: 저장 버튼의 saving/saved/error 상태, 비활성 자동채움 버튼의 안내 툴팁
- Variants and states: default, hover, focus-visible, disabled, saving, success, error
- Token/component ownership: Popup 공통 상태는 `popup.css`, 외부 사이트 주입 UI는 해당 기능의 전용 style이 소유한다.

## Accessibility

- Target standard: 정식 인증 범위는 아니지만 키보드 접근과 명확한 상태 전달을 기본 계약으로 둔다.
- Keyboard/focus behavior: 모든 버튼은 focus-visible을 제공하고 호버 안내는 키보드 포커스에서도 동일하게 노출한다.
- Contrast/readability: 상태색만으로 의미를 전달하지 않고 텍스트를 함께 사용한다.
- Screen-reader semantics: 동적 저장 상태는 live region으로 알리고 비활성 버튼은 `aria-disabled`와 구체적인 접근성 이름을 제공한다.
- Reduced motion and sensory considerations: `prefers-reduced-motion`에서 상태 애니메이션을 제거한다.

## Responsive behavior

- Supported breakpoints/devices: Popup은 380px 데스크톱 Chrome 폭, 주입 UI는 사내 서비스의 데스크톱 레이아웃
- Layout adaptations: 긴 안내는 툴팁 안에서 줄바꿈하고 원본 입력 폭을 침범하지 않는다.
- Touch/hover differences: 현재 주 사용 환경은 마우스·키보드이며 호버 전용 정보는 반드시 포커스로도 제공한다.

## Interaction states

- Loading: 저장 버튼 문구를 `저장 중…`으로 바꾸고 중복 제출을 막는다.
- Empty: 자동채움 문구가 없으면 버튼을 비활성 상태로 표시한다.
- Error: 저장 실패 시 붉은 보조색과 `저장 실패 · 다시 시도` 문구를 표시한다.
- Success: 저장 완료 시 녹색 보조색과 `✓ 저장됨` 문구를 잠시 표시한다.
- Disabled: 비활성 이유와 설정 경로를 호버·포커스 안내로 제공한다.
- Offline/slow network: 동기화 저장이 지연되면 loading 상태를 유지하고 실패 시 재시도할 수 있게 한다.

## Content voice

- Tone: 짧고 직접적이며 사용자가 다음에 할 행동을 포함한다.
- Terminology: 최상위 분류는 `서비스`, Jira의 issue는 사용자 UI에서 `업무`라고 부른다.
- Microcopy rules: 성공은 완료형, 실패는 재시도 가능성을, 비활성 안내는 정확한 설정 경로를 표현한다.

## Implementation constraints

- Framework/styling system: Vanilla TypeScript와 기능별 CSS, 외부 UI 프레임워크 미사용
- Design-token constraints: 별도 토큰 계층을 만들지 않고 기존 색상·간격 패턴을 재사용한다.
- Performance constraints: 사이트별 단일 observer와 기능 lifecycle을 유지하며 중복 DOM을 만들지 않는다.
- Compatibility constraints: Chrome Manifest V3, 외부 SPA의 DOM 재렌더와 제어 입력을 고려한다.
- Test/screenshot expectations: typecheck·unit test·production build를 기본으로 하고, DOM 의존 UI는 로그인된 실제 화면에서 selector와 배치를 확인한다.

## Open questions

- [ ] 향후 모바일·터치 환경 지원이 필요해지면 호버 툴팁을 상시 도움말 또는 클릭 안내로 확장할지 결정한다.
