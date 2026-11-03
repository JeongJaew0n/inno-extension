// 사이트 구조를 흉내 낸 픽스처. testid·클래스는 저장소 selectors.ts 와 실측 기록을 따른다.
// 사이트의 "반응"(클릭 편집, 달력, 붙여넣기)은 작은 스크립트로 흉내 낸다.
const doc = (title, body, head = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;margin:24px;color:#172b4d}
[role=button]{cursor:pointer}.ak-renderer-document table{border-collapse:collapse}.ak-renderer-document td,.ak-renderer-document th{border:1px solid #ccc;padding:2px 6px}</style>${head}</head><body>${body}</body></html>`;

// Jira 첨부 이미지. 실측 주소 모양: media-cdn.atlassian.com/file/<uuid>/image/cdn?token=…&width=…
export const MEDIA_IMAGE_URL = 'https://media-cdn.atlassian.com/file/00000000-0000-0000-0000-000000000001/image/cdn?token=t&width=1&height=1';
// 1×1 투명 PNG
export const MEDIA_IMAGE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
export const mediaBinary = (url) => (url.startsWith('https://media-cdn.atlassian.com/file/') ? { contentType: 'image/png', base64: MEDIA_IMAGE_PNG } : null);

const RENDERER = `<div class="ak-renderer-document">
  <h2>목표</h2>
  <p>CD 트리거 배선을 고쳐 형상 태그가 자동 갱신되도록 한다. <a href="https://example.com/doc">설계 문서</a></p>
  <ul><li>파이프라인 수정</li><li>레지스트리 프로필 추가</li></ul>
  <p>담당 <button aria-label="More information about 홍길동" data-testid="user-profile-card-trigger-wrapper"><span data-mention-id="u-1"><span data-testid="mention-u-1">@홍길동</span></span></button> 확인 요청. 참고 <span data-inline-card="true"><a href="https://example.com/wiki" data-testid="inline-card-resolved-view"><span data-testid="inline-card-icon-and-title"><span data-testid="icon-wrapper"><img src="https://example.com/favicon.ico" data-testid="inline-card-icon-and-title-image" alt=""></span><span>설계 위키</span></span></a></span></p>
  <table><tbody><tr><th>이름</th><th>값</th></tr><tr><td>STREAM</td><td>dev-001</td></tr></tbody></table>
  <div data-testid="media-card-view" role="none"><div data-testid="ImageRendererWrapper"><img src="${MEDIA_IMAGE_URL}" alt="shot.png" width="1" height="1"></div></div>
</div>`;

// ---------------------------------------------------------------- Jira 업무 상세
const EDITOR = `<div data-testid="issue.views.field.rich-text.editor-container">
  <div data-testid="editor-primary-toolbar" style="display:flex;gap:6px;align-items:center;border-bottom:1px solid #ddd;padding:4px"><button>B</button><button>I</button></div>
  <div class="ProseMirror" contenteditable="true" role="textbox" style="min-height:60px;padding:8px">목표 문단</div>
  <div style="display:flex;gap:8px;margin-top:8px"><button data-testid="comment-save-button" id="native-save">저장</button><button data-testid="comment-cancel-button" id="native-cancel">취소</button></div>
</div>`;
// 댓글 편집기. 실측(2026-10-06, NPT-316): 편집기 하나와 툴바·저장/취소가 `default-editor` 안에 함께 있다.
// 저장·취소의 testid 는 설명 편집과 같은 `comment-*` 다. 우리 기능이 이걸 누르면 안 된다.
const COMMENT_EDITOR = (who) => `<div data-testid="issue.component.editor.default-editor" data-comment-editor="${who}">
  <div data-testid="editor-primary-toolbar" style="display:flex;gap:6px;align-items:center;border-bottom:1px solid #ddd;padding:4px"><button>B</button><button>I</button></div>
  <div class="ProseMirror" contenteditable="true" role="textbox" style="min-height:40px;padding:8px">${who} 댓글 초안</div>
  <div style="display:flex;gap:8px;margin-top:8px"><button data-testid="comment-save-button" data-comment-save="${who}">저장</button><button data-testid="comment-cancel-button" data-comment-cancel="${who}">취소</button></div>
</div>`;
const COMMENT_PLACEHOLDER = '<button id="comment-open" style="width:100%;text-align:left">댓글 추가...</button>';
// 기존 댓글. 실측(2026-10-16, NPT-630) 모양: 루트 안에 `-header` · `-body`(렌더러) · `-footer`(동작 줄)
const COMMENT_ITEM = (id, body, actions = '') => `<div data-testid="issue-comment-base.ui.comment.ak-comment.${id}-header">작성자 · 1시간 전</div>
<div data-testid="issue-comment-base.ui.comment.ak-comment.${id}-body"><div class="ak-renderer-document">${body}</div></div>
<div data-testid="issue-comment-base.ui.comment.ak-comment.${id}-footer"><div data-testid="issue-comment-base.ui.comment.custom-comment.${id}.comment-actions" style="display:flex;gap:8px;align-items:center"><button>답글</button>${actions}<button>…</button></div></div>`;
const EXISTING_COMMENT = COMMENT_ITEM('10001', '<p>댓글 본문은 설명 복사에 들어가면 안 된다</p><ul><li>댓글 목록</li></ul>', '<button id="comment-edit">편집</button>');
const IMAGE_COMMENT = COMMENT_ITEM('10002', `<p>스크린샷 첨부</p><div data-testid="media-card-view" role="none"><div data-testid="ImageRendererWrapper"><img src="${MEDIA_IMAGE_URL}" alt="comment.png" width="1" height="1"></div></div>`);

// 실제 Jira 처럼 설명 필드 안에 **화면에 안 보이는 편집 버튼**이 있다. 라벨 끝이 `edit` 다(실측 2026-10-01).
// 설명이 비면 렌더러 대신 그 버튼과 `설명 편집` 자리표시만 있다.
const HIDDEN_EDIT = (label) => `<button aria-label="${label}, edit" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden"></button>`;
// 실측 구조: 필드 > div > div > div > form > div > div[클릭 영역] > [편집 버튼, 본문]. 편집 전환은 **클릭 영역 안**의
// 클릭만 받는다. 바깥 껍데기 div 에 보낸 이벤트는 안쪽 처리기에 닿지 않는다(옛 편집 버튼이 그래서 먹통이었다).
const readField = (body, label) => `<div data-testid="issue.views.field.rich-text.description" role="presentation" style="position:relative;padding:8px;border:1px solid transparent">`
  + `<div><div><div><form role="presentation"><div><div data-edit-area>${HIDDEN_EDIT(label)}${body}</div></div></form></div></div></div></div>`;
const READ = readField(RENDERER, '설명 편집');
const READ_EMPTY = readField('<div role="presentation" style="color:#6b778c">설명 편집</div>', '설명 추가');

// 설명 제목 줄은 실측(2026-11-03) 구조다: 라벨이 글자뿐인 h2, 부모 heading-with-draft 가 flex 줄(gap 8px)
const issuePage = (key, read) => doc(`[${key}] Jira`, `
<div id="jira-root"><main>
  <nav><a data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item" href="/browse/${key}">${key}</a></nav>
  <h1 data-testid="issue.views.issue-base.foundation.summary.heading">[공통] 사내 Gitlab CI 연계 분석</h1>
  <div><div data-testid="issue-view-base.common.description.heading-wrapper" style="display:flex;align-items:center"><div data-testid="issue-view-base.common.description.heading-with-draft" style="display:flex;gap:8px;align-items:center"><h2 data-testid="issue.views.issue-base.common.description.label" style="margin:0;font-size:14px">설명</h2></div></div></div>
  <div id="desc-slot">${read}</div>
  <section id="comments"><h3>댓글</h3>
    <div data-testid="issue.activity.comment" id="composer-slot">${COMMENT_PLACEHOLDER}</div>
    <div data-testid="issue.activity.comments-list"><div data-testid="issue-comment-base.ui.comment.ak-comment.10001" id="existing-slot">${EXISTING_COMMENT}</div><div data-testid="issue-comment-base.ui.comment.ak-comment.10002">${IMAGE_COMMENT}</div></div>
  </section>
</main></div>
<script>
  // Jira(React) 흉내: 루트에 위임된 click 이 설명을 편집 상태로 바꾼다
  window.__editCount = 0; window.__saved = 0; window.__commentSaved = 0; window.__viewerCount = 0;
  const READ = ${JSON.stringify(read)}, EDITOR = ${JSON.stringify(EDITOR)};
  const COMMENT = { composer: [${JSON.stringify(COMMENT_PLACEHOLDER)}, ${JSON.stringify(COMMENT_EDITOR('composer'))}], existing: [${JSON.stringify(EXISTING_COMMENT)}, ${JSON.stringify(COMMENT_EDITOR('existing'))}] };
  const commentSlot = (who) => document.getElementById(who === 'composer' ? 'composer-slot' : 'existing-slot');
  const slot = document.getElementById('desc-slot');
  // 실제 Jira 처럼 **앞선 mousedown 이 있어야** 클릭을 편집으로 받는다. click() 만 보내면 안 열린다(실측)
  let downInField = false;
  document.getElementById('jira-root').addEventListener('mousedown', (e) => {
    downInField = !!e.target.closest('[data-testid="issue.views.field.rich-text.description"] [data-edit-area]');
  });
  document.getElementById('jira-root').addEventListener('click', (e) => {
    // 댓글: 열기 · 편집 · 저장 · 취소
    if (e.target.closest('#comment-open')) { commentSlot('composer').innerHTML = COMMENT.composer[1]; return; }
    if (e.target.closest('#comment-edit')) { commentSlot('existing').innerHTML = COMMENT.existing[1]; return; }
    const commentDone = e.target.closest('[data-comment-save], [data-comment-cancel]');
    if (commentDone) {
      const who = commentDone.dataset.commentSave ?? commentDone.dataset.commentCancel;
      if (commentDone.dataset.commentSave) window.__commentSaved++;
      commentSlot(who).innerHTML = COMMENT[who][0];
      return;
    }
    if (e.target.closest('#native-cancel')) { slot.innerHTML = READ; return; }
    if (e.target.closest('#native-save')) { window.__saved++; slot.innerHTML = READ; return; }
    // Jira 자체 편집 버튼 — click() 한 번으로 편집이 열린다(실측). mousedown 은 필요 없다
    if (e.target.closest('[data-testid="issue.views.field.rich-text.description"] button[aria-label$="edit"]')) {
      window.__editCount++; slot.innerHTML = EDITOR; return;
    }
    // 첨부 이미지 카드: 이미지 뷰어를 열고 편집으로는 넘어가지 않는다(실측 2026-10-15, NPT-670)
    if (e.target.closest('[data-testid="media-card-view"]')) { window.__viewerCount++; return; }
    const field = e.target.closest('[data-testid="issue.views.field.rich-text.description"] [data-edit-area]');
    if (!field || e.target.closest('a')) return;
    if (!downInField) return;
    downInField = false;
    window.__editCount++; slot.innerHTML = EDITOR;
  });
</script>`);

export const jiraIssue = issuePage('NPT-143', READ);
export const jiraIssueEmpty = issuePage('NPT-170', READ_EMPTY);

// ---------------------------------------------------------------- Jira 보드
const today = new Date();
const iso = (d) => d.toISOString();
const addDays = (n) => new Date(today.getTime() + n * 86400000);
// 실측(2026-10-16) 모양: 스크럼은 `type: 'SCRUM'` · `SPRINTS.enabled: true`, Kanban 은 `KANBAN` · `false` 에 `sprints` 가 없다
export const SPA_STATE = {
  UIF_BOARD: { 'uif-board::rapidboard-board::2146': { data: { result: { type: 'SCRUM', capabilities: { SPRINTS: { name: 'SPRINTS', enabled: true } }, sprints: [
    { id: 301, name: 'Jazz-v1.0-Sprint2', state: 'ACTIVE', goal: 'SSO 연동 마무리', isoStartDate: iso(addDays(-3)), isoEndDate: iso(addDays(9)), daysRemaining: 9 },
  ] } } } },
};
const KANBAN_SPA_STATE = {
  UIF_BOARD: { 'uif-board::rapidboard-board::2147': { data: { result: { type: 'KANBAN', capabilities: { SPRINTS: { name: 'SPRINTS', enabled: false } } } } } },
};
const DIALOG = `<div data-testid="issue.views.issue-details.issue-modal.modal-dialog--positioner" style="position:fixed;inset:40px 120px;background:#fff;border:1px solid #ccc;padding:16px">
 <div role="dialog" data-testid="issue.views.issue-details.issue-modal.modal-dialog">
  <div style="display:flex;justify-content:space-between;align-items:center">
   <nav><a data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item" href="/browse/NPT-150">NPT-150</a></nav>
   <div style="display:flex;gap:6px"><button data-testid="issue-view-foundation.header.minimise-button.modal-minimise-button">⌄</button><button>✕</button></div>
  </div>
  <h1 data-testid="issue.views.issue-base.foundation.summary.heading">모달 속 업무</h1>
 </div></div>`;
const BOARD_BODY = `
<header style="border-bottom:1px solid #ddd;padding:8px">Jira</header>
<div data-testid="software-board.header.controls-bar" style="display:flex;gap:8px;padding:8px;border-bottom:1px solid #eee"><input placeholder="보드 검색"><button>빠른 필터</button></div>
<div data-testid="software-board.board-area" style="position:relative;min-height:420px;display:flex;gap:12px;padding:12px">
  <div style="width:240px;background:#f4f5f7;padding:8px">할 일<div style="background:#fff;margin-top:8px;padding:8px">NPT-150 카드</div></div>
  <div style="width:240px;background:#f4f5f7;padding:8px">진행 중</div>
</div>
`;
export const jiraBoard = (withDialog) => doc('보드 2146', `${BOARD_BODY}
${withDialog ? DIALOG : ''}
<script>window.SPA_STATE = ${JSON.stringify(SPA_STATE)};</script>`);
export const jiraKanbanBoard = doc('보드 2147', `${BOARD_BODY}
<script>window.SPA_STATE = ${JSON.stringify(KANBAN_SPA_STATE)};</script>`);

// 새 보드(2026-11). 주소에 `c/` 가 없고 컨트롤 바 · board-area · SPA_STATE 가 없다.
// 실측(2026-11-03) 모양: 보드 grid(`header` · `content` · `sidebar` 칸)의 header 칸이 `flex-wrap: wrap`,
// 그 안 왼쪽 묶음에 검색칸(`filter-refinement.ui.search-field-container`)이 있다. 본문은 `board.content.board-wrapper`.
const NEW_BOARD_BODY = `
<div data-testid="page-layout.root" style="display:grid;grid-template-areas:'main'">
 <div data-testid="page-layout.main" style="grid-area:main">
  <div style="display:grid;grid-template-areas:'header sidebar' 'content sidebar';grid-template-columns:1fr auto">
   <div style="grid-area:header;display:flex;flex-wrap:wrap;justify-content:space-between;padding:8px 0">
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
     <div data-testid="filter-refinement.ui.search-field-container" style="display:flex"><input placeholder="보드 검색"></div>
     <button>필터</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center"><button aria-label="스프린트 세부 정보">i</button><button>스프린트 완료</button></div>
   </div>
   <div style="grid-area:content">
    <div data-testid="board.content.board-wrapper" style="position:relative;min-height:420px;display:flex;gap:12px;padding:12px">
     <div style="width:240px;background:#f4f5f7;padding:8px">할 일<div style="background:#fff;margin-top:8px;padding:8px">NPT-150 카드</div></div>
     <div style="width:240px;background:#f4f5f7;padding:8px">진행 중</div>
    </div>
   </div>
   <div style="grid-area:sidebar"></div>
  </div>
 </div>
</div>
`;
// 새 보드는 SPA_STATE 대신 Relay 저장소를 들고 있다. React fiber 를 따라 올라가 environment 를 찾는다(실측 2026-11-03).
// 모양: JiraBoardView → board(JiraBoard: boardId · boardType) · sprints(연결 → edges → node: JiraSprint id(ARI) · name)
const relayScript = (boardId, boardType) => `<script>(() => {
  const records = {
    'client:view': { __typename: 'JiraBoardView', board: { __ref: 'ari:board' }, sprints: ${boardType === 'SCRUM' ? "{ __ref: 'client:conn' }" : 'null'} },
    'ari:board': { __typename: 'JiraBoard', boardId: ${boardId}, boardType: '${boardType}' },
    'client:conn': { __typename: 'JiraSprintConnection', edges: { __refs: ['client:edge'] }, totalCount: 1 },
    'client:edge': { __typename: 'JiraSprintEdge', node: { __ref: 'ari:sprint' } },
    'ari:sprint': { __typename: 'JiraSprint', id: 'ari:cloud:jira:site:sprint/activation/x/301', name: 'Jazz-v1.0-Sprint2' },
  };
  const source = { getRecordIDs: () => Object.keys(records), get: (id) => records[id] };
  const environment = { getStore() { return { getSource: () => source }; } };
  document.querySelector('[data-testid="page-layout.main"]')['__reactFiber$e2e'] =
    { memoizedProps: {}, return: { memoizedProps: {}, return: { memoizedProps: { environment }, return: null } } };
})();</script>`;
export const jiraNewBoard = (withDialog) => doc('보드 2148', `${NEW_BOARD_BODY}
${withDialog ? DIALOG : ''}
${relayScript(2148, 'SCRUM')}`);
export const jiraNewKanbanBoard = doc('보드 2149', `${NEW_BOARD_BODY}
${relayScript(2149, 'KANBAN')}`);

export const jiraApi = (url) => {
  const u = new URL(url);
  if (/\/rest\/agile\/1\.0\/board\/(?:2146|2148)\/sprint$/.test(u.pathname)) {
    return { isLast: true, values: [
      { id: 301, name: 'Jazz-v1.0-Sprint2', state: 'active', startDate: iso(addDays(-3)), endDate: iso(addDays(9)) },
      { id: 290, name: 'Jazz-v1.0-Sprint1', state: 'closed', startDate: iso(addDays(-17)), endDate: iso(addDays(-4)) },
    ] };
  }
  // Jira 가 센 남은 작업일(실측 2026-11-03 모양: {"days":3})
  if (u.pathname === '/rest/greenhopper/1.0/gadgets/sprints/remainingdays' && u.searchParams.get('sprintId') === '301') {
    return { days: 9 };
  }
  if (/\/rest\/agile\/1\.0\/sprint\/290\/issue$/.test(u.pathname)) {
    const issue = (key, summary, status, cat, who) => ({ key, fields: { summary,
      status: { name: status, statusCategory: { key: cat } }, issuetype: { name: '작업', iconUrl: '' },
      assignee: who ? { displayName: who, avatarUrls: { '24x24': '' } } : null, parent: null } });
    return { total: 3, issues: [
      issue('NPT-120', 'SSO 설정 조사', '완료', 'done', '정재원'),
      issue('NPT-121', '토큰 갱신 버그', '진행 중', 'indeterminate', '이강민'),
      issue('NPT-122', '문서 정리', '할 일', 'new', null),
    ] };
  }
  return null;
};

// ---------------------------------------------------------------- Jira 백로그
export const jiraBacklog = doc('백로그', `
<div data-testid="software-backlog.card-list.container.backlog" style="padding:12px;border:1px solid #ddd">
  <div>NPT-160 기존 업무</div>
  <input aria-label="Work item summary" style="width:420px;padding:6px" placeholder="무엇을 해야 하나요?">
</div>`);

// ---------------------------------------------------------------- Jira 업무 생성 모달
export const jiraCreate = doc('업무 생성', `
<button id="open-create">만들기</button>
<div id="modal-slot"></div>
<script>
const KO = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
const FIELD = (id, label, inner='') => '<div data-testid="issue-create-modernised.field-renderer.field.' + id + '">' + inner + '</div>';
function dateField(id, label) {
  return FIELD(id, label, '<label>' + label + '</label><div role="button" data-trigger style="padding:4px;border:1px solid #ccc">없음</div><div data-cal></div>');
}
function modal() {
  return '<div data-testid="minimizable-modal.ui.modal-container.modal" role="dialog" style="border:1px solid #ccc;padding:16px;width:640px">'
   + '<div style="display:flex;justify-content:space-between"><h1 style="font-size:16px;margin:0">NPT | 작업</h1>'
   + '<button data-testid="issue-create-modernised.ui.header.toggle-expand-button" id="expand">더 보기</button></div>'
   + '<div data-testid="minimizable-modal.ui.modal-container.modal--scrollable" style="max-height:600px;overflow:auto">'
   + FIELD('summary', '요약', '<input placeholder="요약" style="width:95%">')
   + FIELD('description', '설명', '<div class="ProseMirror" contenteditable="true" role="textbox" style="min-height:70px;border:1px solid #ddd;padding:6px"></div>')
   + FIELD('customfield_10015', '시작 날짜') + FIELD('duedate', '기한')
   + '<div id="more"></div></div></div>';
}
function renderCalendar(field, y, m) {
  const cal = field.querySelector('[data-cal]');
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const prev = new Date(y, m - 1, 1), next = new Date(y, m + 1, 1);
  let html = '<button type="button" data-prev>Previous month, ' + (prev.getMonth()+1) + '월 ' + prev.getFullYear() + '</button>'
    + '<button type="button" data-next>Next month, ' + (next.getMonth()+1) + '월 ' + next.getFullYear() + '</button><div role="grid">';
  for (let d = 1; d <= last.getDate(); d++) {
    const dt = new Date(y, m, d);
    html += '<button type="button" role="gridcell" aria-label="' + d + ', ' + KO[dt.getDay()] + ' ' + (m+1) + '월 ' + y + '" data-d="' + d + '">' + d + '</button>';
  }
  cal.innerHTML = html + '</div>';
  cal.querySelector('[data-prev]').onclick = () => renderCalendar(field, prev.getFullYear(), prev.getMonth());
  cal.querySelector('[data-next]').onclick = () => renderCalendar(field, next.getFullYear(), next.getMonth());
  cal.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => {
    field.querySelector('[data-trigger]').textContent = y + '년 ' + (m+1) + '월 ' + b.dataset.d + '일';
    cal.innerHTML = '';
  });
}
document.getElementById('open-create').onclick = () => {
  const slot = document.getElementById('modal-slot');
  slot.innerHTML = modal();
  // 접힌 상태에서는 날짜 필드가 빈 껍데기다(실측: innerHTML 29자)
  const shells = { customfield_10015: '시작 날짜', duedate: '기한' };
  for (const id of Object.keys(shells)) slot.querySelector('[data-testid$="field.' + id + '"]').innerHTML = '';
  document.getElementById('expand').onclick = () => {
    document.getElementById('more').innerHTML = '<button data-testid="issue-create.ui.modal.create-form.layout-renderer.fields-container.collapsible-area-header.collapsible-area-header" id="acc">추가 필드(6개)</button>';
    document.getElementById('acc').onclick = () => {
      for (const [id, label] of Object.entries(shells)) {
        const el = slot.querySelector('[data-testid$="field.' + id + '"]');
        el.outerHTML = dateField(id, label);
      }
      slot.querySelectorAll('[data-trigger]').forEach((t) => t.onclick = () => {
        const f = t.closest('[data-testid^="issue-create-modernised.field-renderer.field."]');
        const now = new Date(); renderCalendar(f, now.getFullYear(), now.getMonth());
      });
    };
  };
  // Atlassian 편집기 흉내: text/html 이 실린 붙여넣기를 서식으로 받는다
  const pm = slot.querySelector('.ProseMirror');
  pm.addEventListener('paste', (e) => {
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    if (!html) return;
    e.preventDefault(); pm.innerHTML = html; pm.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
</script>`);

// ---------------------------------------------------------------- Confluence
export const confluencePage = doc('DevOpsit CCP - Confluence', `
<div data-testid="page-content-header"><div style="display:flex;gap:8px;align-items:center"><button>편집</button><button aria-label="링크 복사">링크 복사</button><button>공유</button></div></div>
<div data-testid="title-wrapper"><h1>DevOpsit CCP</h1></div>
<div data-testid="page-content-only">${RENDERER}</div>`);

export const confluenceEdit = doc('편집 - Confluence', `
<div data-testid="editor-primary-toolbar" style="display:flex;gap:6px;align-items:center;border-bottom:1px solid #ddd;padding:4px"><button>B</button><button>I</button></div>
<div data-testid="editor-wrapper"><div class="ProseMirror" contenteditable="true" role="textbox" style="min-height:80px;padding:8px"><p data-prosemirror-node-name="paragraph">일반 문단</p></div></div>`);

// ---------------------------------------------------------------- 아마란스
const noti = (source, title, body, time) => `<li class="h-box unread"><div class="list_con flex-1">
 <div class="topline h-box"><dl class="h-box"><dt>${source}</dt><dd class="name flex-1">${title}</dd></dl></div>
 <div class="botline v-box"><div class="h-box"><div class="text flex-1">보낸사람 : test@innogrid.com</div></div>
 <div class="flex-1 v-box"><span class="text">내용 : ${body}</span></div></div></div><div class="time fold">${time}</div></li>`;
export const amaranthMain = doc('아마란스', `
<div class="worktime"><ul class="btns"><li class="active"><a>출근</a></li><li><a>퇴근</a></li></ul></div>
<div class="noti-details" style="border:1px solid #ddd;padding:8px">알림 요약</div>
<div class="myWorkTime"></div>
<div id="intergratedNotificationBtn" style="width:420px"><div class="commonPopup integratedNotification v-box alert"><div class="tabCon">
 <div class="categoryFn h-box"><div class="item on">전체</div><div class="item false">메일</div></div>
 <div class="dayline">오늘<span class="today">2026.09.28</span></div>
 <ul>${noti('[메일]', 'AuthCode: 039911', 'Your authentication token code is 039911.', '17:11')}${noti('[메일]', '[WBlock] 메일 리스트', '일반 메일입니다.', '09:01')}</ul>
</div></div></div>`);

// 근태신청서 상신정보 단계. 왼쪽 양식 카드 중 선택된 것에만 .selectedList 가 붙는다(실측 2026-10-01).
const card = (name, selected = false) => `<li class="OBTCardList_li_x"><div class="${selected ? 'selectedList' : ''}"><div data-orbit-component="OBTTooltip"><div class="tbl-tdl ico"><div>${name}</div></div></div></div></li>`;
export const amaranthForm = doc('근태신청', `
<div data-orbit-component="OBTCardList" style="float:left;width:200px"><ul>
${card('근태일정')}${card('연차휴가신청서', true)}${card('외근신청서')}${card('출장신청서')}
</ul></div>
<table><tbody><tr><th scope="row"><div>제목</div></th>
<td><div id="text4" data-orbit-component="OBTTextField"><input type="text" value="" style="width:360px"></div></td></tr></tbody></table>`);
