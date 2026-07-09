# context — gw-checkin-header-buttons

## 사용자의 원 요청
사용자는 처음에 "gw.innogrid.com 사이트를 분석해서 이 사이트용 extension을 만들 것이니
아키텍처를 구성해달라"고 요청했다. ai-decision-interview 스킬로 인터뷰를 진행하는 과정에서
요구사항이 점점 좁혀졌고, 최종적으로 사용자가 이렇게 정리했다:

> "그냥 출/퇴근 버튼을 'user-info' 요소 왼쪽에 놔둬줘. 지금은 scroll해서 봐야 해서 불편함."

## 왜 이걸 지금 하는가
gw.innogrid.com(더존 그룹웨어) 메인 화면에서 실제 출퇴근 버튼(`.worktime ul.btns li`)이
화면 아래쪽(y≈1040)에 있어 스크롤해야만 보인다. 매일 출퇴근을 찍는데 매번 스크롤하는 것이
불편하다. 항상 보이는 헤더 영역에 버튼을 두면 스크롤 없이 바로 누를 수 있다.

## 결정된 방향
content script로 헤더 `user-info` 왼쪽에 출근/퇴근 버튼을 새로 만들고, 클릭하면 원본
출퇴근 버튼을 대신 클릭(클릭 위임)한다. 자동화·알림·API 없이 순수 UI 편의 기능이다.

## 확정된 결정 (인터뷰 결과)
| 결정 축 | 확정 내용 | 근거 |
|---|---|---|
| 핵심 동작 | 출/퇴근 버튼을 헤더에 고정 배치만. 자동화·알림·상태감지 제외 | 사용자: 미등록 알림 불필요, 사이트에서 직접 확인 |
| 통합 방식 | content script(DOM). API·인증 재현 없음 | 사이트가 세션·SSO·get_token CSRF 를 이미 처리 |
| 배치 전략 | 새 버튼 생성 + 원본 li 클릭 위임 | 원본 li 에 React onClick 이 바인딩 → clone 은 동작 안 함 |
| 빌드 스택 | TypeScript + Vite 번들, Manifest V3 | 타입 안전성 + 향후 확장 여지 |

## 기각된 대안
- 출퇴근 자동화(스케줄 자동 클릭) — 실제 미출근 시에도 찍힐 수 있어 근태 정책상 민감. 사용자 기각.
- 미등록 알림 / 백그라운드 상태 감지 — "사이트 들어가서 직접 확인하면 됨" 으로 사용자 기각.
- API 직접 호출(background) — 옵코드(`gw027A21` 등) + `get_token` CSRF + SSO 재현 부담이
  크고 더존 API 변경 시 깨지기 쉬움. content script DOM 방식이 더 견고.
- 원본 `.worktime` 요소를 헤더로 이동(reparent) — SPA 리렌더 시 사라지거나 헤더 스타일과
  충돌 가능. "새 버튼 + 클릭 위임" 이 더 안전.
- 순수 JS(번들러 없음) — 기능은 단순하나 사용자가 타입 안전성/확장성 위해 TS+Vite 선택.

## 사이트 분석 결과 (2026-07-09 확인)
- gw.innogrid.com = 더존(Duzon) Amaranth / BizCube X 계열 그룹웨어
- 프론트엔드: React SPA(더존 OBT Orbit 포털), hash 라우팅(`#/`), RealGrid 사용
- API 패턴: `POST /gw/gw{옵코드}` (REST 아님, 옵코드 방식). 일부는 `GET /get_token/` 선행
- 인증: 세션 쿠키 + SSO(`DUZON_BIZCUBEX_SSO_PARAMS`)
- 정적 자산: `/static/js/main.*.js`, `/static/js/vendors.*.js` 등
- 모듈: 전자결재, 메일, 일정, 자원, 게시판, 업무관리, 근태(출퇴근), ONEFFICE, ONECHAMBER

## 제약 / 합의 사항
- 기술적 제약: DOM selector 는 더존 업데이트로 깨질 수 있는 취약 지점 → selectors.ts 중앙화
- 범위 제약: 이번 작업은 출퇴근 버튼 헤더 배치 하나에 집중. 다른 편의 기능은 추후 별도 논의
- 사용자 선호: 자동화 안 함, 알림 안 함, TS+Vite 스택

## 관련 자료
- 저장소: https://github.com/JeongJaew0n/inno-extension.git (현재 비어 있음, 새로 구성)
- 대상 사이트: https://gw.innogrid.com/#/
