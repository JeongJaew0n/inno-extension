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

/** 설명 Markdown 변환 기능. */
export const EDITOR_MARKDOWN_TO_ADF_ROOT = 'jira-editor-markdown-to-adf';

/**
 * 업무 **설명** 편집기를 담은 컨테이너.
 *
 * Jira는 한 화면에 편집기가 여럿이다. 설명과 댓글이 동시에 열릴 수 있고 **각각 자기
 * `editor-primary-toolbar`를 만든다.** 문서 전체에서 툴바를 찾으면 댓글 편집기에 버튼이 붙는다.
 *
 * | 편집기 | 구분되는 조상 |
 * | --- | --- |
 * | 설명 | `issue.views.field.rich-text.editor-container` |
 * | 댓글 | `issue.activity.comment` |
 *
 * `aria-label`("설명 영역입니다…")은 한국어라 언어 설정에 따라 바뀐다. 앵커로 쓰지 않는다.
 *
 * docs/plans/jira-editor-markdown-to-adf/context.md
 */
export const DESCRIPTION_EDITOR_CONTAINER =
  '[data-testid="issue.views.field.rich-text.editor-container"]';

/** 설명 Markdown 복사 기능. */
export const DESCRIPTION_MARKDOWN_COPY_ROOT = 'jira-description-markdown-copy';

/**
 * 업무 **설명** 필드. 읽기 화면과 편집 화면을 모두 담는다.
 *
 * 본문 렌더러를 **이 안에서만** 찾는다. 댓글도 같은 `.ak-renderer-document` 를 쓰므로 문서
 * 전체에서 찾으면 댓글 본문을 복사하게 된다.
 */
export const DESCRIPTION_FIELD = '[data-testid="issue.views.field.rich-text.description"]';

/** 설명 읽기 화면의 본문. Confluence 문서 본문과 같은 렌더러다. */
export const DESCRIPTION_RENDERER = '.ak-renderer-document';

/**
 * `설명` 라벨 줄. 버튼을 이 안쪽 flex 줄에 붙인다.
 *
 * 라벨 자신은 `display: block` 이고, 그 첫 자식이 `display: flex` 줄이다. 실측에서 라벨 텍스트가
 * x 261 에서 끝나고 706 까지 445px 가 비어 있었다.
 */
export const DESCRIPTION_LABEL = '[data-testid="issue.views.issue-base.common.description.label"]';

/** 설명 편집 취소 기능. */
export const DESCRIPTION_EDIT_ACTIONS_ROOT = 'jira-description-edit-actions';

/**
 * 설명 **편집** 상태를 담는 컨테이너. 읽기 상태의 `DESCRIPTION_FIELD` 와 다른 요소다.
 *
 * | 상태 | 나타나는 `data-testid` |
 * | --- | --- |
 * | 읽기 | `issue.views.field.rich-text.description` |
 * | 편집 | `issue.views.field.rich-text.editor-container` |
 */
export const DESCRIPTION_EDITOR_CONTAINER_FIELD =
  '[data-testid="issue.views.field.rich-text.editor-container"]';

/**
 * 편집기 아래쪽 `취소` 버튼.
 *
 * **`comment-` 접두사지만 댓글 것이 아니다.** Jira 가 설명 편집에도 댓글 편집기 컴포넌트를
 * 재사용해서 붙은 이름이다. 그래서 반드시 **설명 편집 컨테이너 안에서** 찾아야 한다. 문서
 * 전체에서 찾으면 진짜 댓글 편집기의 취소 버튼을 누르게 된다.
 */
export const DESCRIPTION_EDITOR_CANCEL_BUTTON = '[data-testid="comment-cancel-button"]';

/** 편집기 아래쪽 `저장` 버튼. 이름이 `comment-` 인 이유는 위와 같다. */
export const DESCRIPTION_EDITOR_SAVE_BUTTON = '[data-testid="comment-save-button"]';

/** 보드 활성 스프린트 정보 기능. */
export const BOARD_SPRINT_INFO_ROOT = 'jira-board-sprint-info';

/**
 * 보드 상단 바의 필터 목록.
 *
 * `버전 · Epic · 유형 · 레이블 · 빠른 필터` 가 이 안의 `<ul>` 에 들어 있다. 이 컨테이너 끝에
 * 붙이면 **`빠른 필터` 오른쪽**이 된다. 실측에서 오른쪽으로 369px 가 비어 있었다.
 */
export const BOARD_FILTER_CONTAINER = '[data-testid="software-filters.ui.list-filter-container"]';

/** 지난 스프린트 보기 기능. */
export const PAST_SPRINT_VIEW_ROOT = 'jira-past-sprint-view';
export const PAST_SPRINT_PANEL_ROOT = 'jira-past-sprint-panel';

/**
 * 보드 본문. 패널을 이 위에 덮는다.
 *
 * 실측으로 고른 값이다. 처음에 `software-board.board-container.board` 로 넣었다가 **그런 요소가
 * 없어서** 패널이 조용히 안 뜨는 버그를 만들었다. 실제로 있는 것은 `software-board.board` 와
 * `software-board.board-area` 둘이고, 뒤가 이미 `position: relative` 라 덮기에 알맞다.
 *
 * **보드 DOM 을 건드리지 않는다.** 카드를 지우면 React 의 가상 DOM 과 실제 화면이 어긋난 채
 * 남아서, 나중에 드래그나 `스프린트 완료` 가 보이는 것과 다른 대상에 걸린다.
 *
 * docs/plans/jira-past-sprint-view/spec.md
 */
export const BOARD_CONTENT = '[data-testid="software-board.board-area"]';
