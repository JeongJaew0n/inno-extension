export const ISSUE_LINK_COPY_ROOT = 'jira-issue-link-copy';

export const ISSUE_DIALOG =
  '[role="dialog"][data-testid="issue.views.issue-details.issue-modal.modal-dialog"]';
export const ISSUE_PREVIEW_PANEL =
  'section[data-testid="preview-panels.preview-panel"]';
export const CURRENT_ISSUE_LINK =
  '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"][href^="/browse/"]';
export const CURRENT_ISSUE_TITLE =
  '[data-testid="issue.views.issue-base.foundation.summary.heading"]';

/** 업무 모달 전체 폭 기능. */
export const ISSUE_MODAL_WIDTH_ROOT = 'jira-issue-modal-width';
export const ISSUE_MODAL_WIDTH_STYLE_ID = 'inno-jira-issue-modal-width-style';
/** 전체 폭 상태를 나타내는 `<html>` 속성. CSS가 이 속성 아래에서만 동작한다. */
export const ISSUE_MODAL_WIDE_ATTRIBUTE = 'data-inno-jira-wide';

/**
 * 모달 폭을 제한하는 두 요소.
 *
 * 모달은 세 겹이다. 바깥부터 `--blanket`(오버레이, 이미 뷰포트 전체), `--positioner`(위치
 * 컨테이너), 그리고 본체다. 폭을 막는 것은 **뒤의 둘**이다.
 *
 * | 요소 | 뷰포트 1512에서 | 뷰포트 1920에서 |
 * | --- | --- | --- |
 * | `--blanket` | 1512 | 1920 |
 * | `--positioner` | 1392 (max-width) | 1800 |
 * | 본체 | 1280 (고정) | 1280 |
 *
 * 본체의 `width: 1280px`는 **뷰포트와 무관한 고정값**이라 화면을 넓혀도 그대로다.
 *
 * docs/plans/jira-issue-modal-fullwidth/spec.md
 */
export const ISSUE_MODAL_POSITIONER =
  '[data-testid="issue.views.issue-details.issue-modal.modal-dialog--positioner"]';

/** 모달 우상단의 `사이드바로 전환` 버튼. 토글 버튼을 이 왼쪽에 붙인다. */
export const ISSUE_MODAL_MINIMISE_BUTTON =
  '[data-testid="issue-view-foundation.header.minimise-button.modal-minimise-button"]';

/** 백로그 슬래시 템플릿 기능. */
export const BACKLOG_SLASH_TEMPLATE_ROOT = 'jira-backlog-slash-template';

/**
 * 백로그 인라인 생성의 제목 입력창.
 *
 * `data-testid`가 없어 `aria-label`로 잡는다. UI 언어가 한글인데 이 값은 영문이라 locale과
 * 무관해 보이지만 계약은 아니다. 그래서 카드 리스트 컨테이너 안에 있는지도 함께 본다.
 *
 * **인라인 생성은 백로그 영역에만 있다.** 스프린트 컨테이너에는 생성 버튼도 입력창도 없는
 * 것을 실측으로 확인했다.
 *
 * docs/plans/jira-backlog-slash-template/context.md
 */
export const BACKLOG_SUMMARY_INPUT = 'input[aria-label="Work item summary"]';
export const BACKLOG_CARD_LIST_CONTAINER = '[data-testid^="software-backlog.card-list.container"]';
