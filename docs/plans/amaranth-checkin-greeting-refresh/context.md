# 인사말 복사 — 배경과 현재 구조

## 요청

출근 모달을 누르고 난 뒤에는 출근 데이터가 바로 찍히지 않아서 `인사말 복사`를 쓰려면
새로고침을 한 번 해야 한다. 다음 두 가지를 검토한다.

1. 뜨는 모달을 인터셉트해 거기에 `인사말 복사` 버튼을 추가
2. 출근 모달 처리 후 출근 데이터를 갱신할 방법

**제약**: 모달을 놓쳤을 때도 복사할 수 있어야 하므로 **지금 있는 버튼은 건드리지 않는다.**

## 현재 구현

`src/sites/amaranth/features/attendanceHeader/`

| 파일 | 역할 |
| --- | --- |
| `runtime.ts` | `.noti-details`에 출근·퇴근·`인사말 복사` 버튼 주입 |
| `checkinTime.ts` | `readTodayCheckinTime()` — 근무시간 위젯 DOM에서 오늘 출근 시각을 읽는다 |
| `greeting.ts` | `formatCheckinGreeting()` — `n시 n분 출근입니다.` 문구 |

주입한 출근·퇴근 버튼은 사이트 원본 `li`에 클릭을 위임한다.

```ts
const original = activeDocument?.querySelector(originalSelector(kind));
original.click();
```

`인사말 복사`는 **위젯 DOM만** 읽는다. 기록이 없으면 현재 시각으로 대체하지 않는다.

> 기록된 출근 시각이 없으면 현재 시각으로 대체하지 않는다.
> 대체하면 실제 근태와 다른 문구를 사용자가 눈치채지 못한 채 공유하게 된다.

2026-08-26에 "클릭 순간의 브라우저 시간"에서 "위젯에 기록된 시각"으로 바꾼 결과다. 그 결정은
유지한다.

## 실측한 사실

측정일 2026-09-09. 대상 계정은 당일 `출근 09:35 / 퇴근 미등록` 상태였다.

### 페이지 구조

| 항목 | 값 |
| --- | --- |
| 앱 스택 | React + jQuery 3.6.4 |
| 출근 버튼 핸들러 | React `onClick: () => j("come")` (미니파이) |
| 위젯 마크업 | `<div class="worktime"><ul class="btns"><li class="active">출근</li><li>퇴근</li></ul></div>` |

### 데이터는 로드 시 한 번만 가져온다

```text
POST /human/common/judgeTimeManagement/getTodayComeLeaveInfo
```

**이 요청이 페이지 로드 때 딱 한 번 나간다.** SPA 라우트를 옮겼다 돌아와도(`#/mail` → `#/`)
재조회하지 않는 것을 관찰했다. 새로고침 말고는 위젯이 갱신될 경로가 없다. **신고된 증상의
직접 원인이다.**

`notificationTools`가 쓰는 방식(사이트 자체 탭을 클릭해 재조회 유도)에 해당하는 트리거가
근무시간 위젯에는 없다.

### 확장이 API를 직접 부를 수 없다

| 본문 | 결과 |
| --- | --- |
| `{}` | **401**, `resultCode: 601` |
| `{empCd, deptCd, coCd}` | **401**, `resultCode: 601` |

쿠키만으로는 통과하지 못한다. 페이지가 붙이는 헤더가 더 있다. 그 헤더는 확인하지 못했다 —
관찰을 걸어둔 12초 동안 페이지가 스스로 낸 요청이 없었다.

### 모달의 정체

퇴근 버튼을 눌러 모달을 띄우고 **확인을 누르지 않은 채** 구조만 읽었다. 근태 기록은 변하지
않았고 기록 요청도 발생하지 않았다.

```text
출퇴근 체크
퇴근 체크 하시겠습니까?
오늘 하루 띄우지 않기
[취소] [확인]
```

| 항목 | 값 |
| --- | --- |
| 컴포넌트 | Orbit UI `OBTConfirm` |
| DOM 경로 | `OBTPortal_orbitPortalRoot` → `OBTConfirm_root` → `OBTConfirm_wrapper` → `OBTConfirm_confirmBoxStyle` → `OBTConfirm_buttonsDiv` |
| 클래스 접미사 | 빌드 해시(`__LPK56` 등). 선택자는 `[class*="OBTConfirm_root"]` 형태여야 한다 |
| **모달 안의 시각** | **없음** |
| 끌 수 있는가 | **있다** — `오늘 하루 띄우지 않기` |

모달을 여는 순간 이 요청이 나간다.

```text
POST /human/common/judgeTimeManagement/confirmApplicationStatus
body: { empCd, deptCd, coCd }   → 200
```

즉 사번·부서·회사 코드는 페이지 안에서 얻을 수 있다.

## 확인하지 못한 것

- **출근/퇴근 확정 API의 이름과 응답 형태.** 모달의 `확인`을 눌러야 나오는데, 실제 근태가
  기록되므로 누르지 않았다.
- `getTodayComeLeaveInfo`가 요구하는 인증 헤더.
- 확정 후 결과 모달이 따로 뜨는지, 뜬다면 시각을 보여주는지.

## 관련 파일

| 파일 | 내용 |
| --- | --- |
| `src/sites/amaranth/selectors.ts` | `MY_WORK_TIME*`, `CHECKIN_LI`, `CHECKOUT_LI` |
| `src/sites/amaranth/features/attendanceHeader/*` | 현재 구현 |
| `src/sites/amaranth/features/notificationTools/runtime.ts` | 사이트 UI를 클릭해 재조회를 유도하는 선례 |
| `src/sites/confluence/main.ts` | MAIN world 브리지 선례 |
