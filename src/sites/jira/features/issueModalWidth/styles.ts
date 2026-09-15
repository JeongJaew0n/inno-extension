import {
  ISSUE_DIALOG,
  ISSUE_MODAL_POSITIONER,
  ISSUE_MODAL_WIDE_ATTRIBUTE,
  ISSUE_MODAL_WIDTH_STYLE_ID,
} from '../../selectors';

/**
 * 모달의 폭·높이 제한을 푸는 규칙.
 *
 * `<html>`에 붙는 속성 아래에서만 동작한다. 스타일 시트는 한 번만 주입하고 토글은 속성만
 * 바꾼다. 모달이 닫혔다 다시 열려도 시트가 살아 있어 다시 주입할 필요가 없다.
 *
 * `!important`가 필요하다. Jira가 원자 CSS 클래스로 크기를 지정하는데, 그 클래스는 빌드마다
 * 해시가 바뀌므로 선택자로 이길 수 없다.
 *
 * **폭**: 위치 컨테이너와 본체가 각각 막는다. 둘 다 풀어야 뷰포트 전체가 된다.
 *
 * **높이**: 위치 컨테이너가 `position: absolute`에 `top: 60px; bottom: 59px; max-height`로
 * 잡혀 있다. `top`·`bottom`을 0으로 만들고 `max-height`를 풀어야 위아래 여백이 사라진다.
 *
 * 본체 높이는 `100vh`로 준다. `100%`로 주면 컨테이너 높이가 확정되기 전에 계산돼 본문 전체
 * 높이(실측 15688px)까지 늘어나 화면 밖으로 넘친다.
 *
 * 우측 필드 컬럼은 건드리지 않는다. 남는 폭은 본문이 가져간다.
 *
 * docs/plans/jira-issue-modal-fullwidth/spec.md
 */
const STYLE_TEXT = `
html[${ISSUE_MODAL_WIDE_ATTRIBUTE}] ${ISSUE_MODAL_POSITIONER} {
  top: 0 !important;
  bottom: 0 !important;
  max-height: 100vh !important;
}

html[${ISSUE_MODAL_WIDE_ATTRIBUTE}] ${ISSUE_MODAL_POSITIONER},
html[${ISSUE_MODAL_WIDE_ATTRIBUTE}] ${ISSUE_DIALOG} {
  width: 100vw !important;
  max-width: 100vw !important;
}

html[${ISSUE_MODAL_WIDE_ATTRIBUTE}] ${ISSUE_DIALOG} {
  height: 100vh !important;
  max-height: 100vh !important;
}
`;

export function ensureIssueModalWidthStyles(document: Document): void {
  if (document.getElementById(ISSUE_MODAL_WIDTH_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = ISSUE_MODAL_WIDTH_STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

export function removeIssueModalWidthStyles(document: Document): void {
  document.getElementById(ISSUE_MODAL_WIDTH_STYLE_ID)?.remove();
  document.documentElement.removeAttribute(ISSUE_MODAL_WIDE_ATTRIBUTE);
}

export function isWideModeOn(document: Document): boolean {
  return document.documentElement.hasAttribute(ISSUE_MODAL_WIDE_ATTRIBUTE);
}

export function setWideMode(document: Document, on: boolean): void {
  if (on) document.documentElement.setAttribute(ISSUE_MODAL_WIDE_ATTRIBUTE, '');
  else document.documentElement.removeAttribute(ISSUE_MODAL_WIDE_ATTRIBUTE);
}
