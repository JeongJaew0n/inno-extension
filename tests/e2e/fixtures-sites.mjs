// 사이트 구조를 흉내 낸 픽스처. testid·클래스는 저장소 selectors.ts 와 실측 기록을 따른다.
// 사이트의 "반응"(클릭 편집, 달력, 붙여넣기)은 작은 스크립트로 흉내 낸다.
const doc = (title, body, head = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;margin:24px;color:#172b4d}
[role=button]{cursor:pointer}.ak-renderer-document table{border-collapse:collapse}.ak-renderer-document td,.ak-renderer-document th{border:1px solid #ccc;padding:2px 6px}</style>${head}</head><body>${body}</body></html>`;

const RENDERER = `<div class="ak-renderer-document">
  <h2>목표</h2>
  <p>CD 트리거 배선을 고쳐 형상 태그가 자동 갱신되도록 한다. <a href="https://example.com/doc">설계 문서</a></p>
  <ul><li>파이프라인 수정</li><li>레지스트리 프로필 추가</li></ul>
  <table><tbody><tr><th>이름</th><th>값</th></tr><tr><td>STREAM</td><td>dev-001</td></tr></tbody></table>
</div>`;

// ---------------------------------------------------------------- Jira 업무 상세
const EDITOR = `<div data-testid="issue.views.field.rich-text.editor-container">
  <div data-testid="editor-primary-toolbar" style="display:flex;gap:6px;align-items:center;border-bottom:1px solid #ddd;padding:4px"><button>B</button><button>I</button></div>
  <div class="ProseMirror" contenteditable="true" role="textbox" style="min-height:60px;padding:8px">목표 문단</div>
  <div style="display:flex;gap:8px;margin-top:8px"><button data-testid="comment-save-button" id="native-save">저장</button><button data-testid="comment-cancel-button" id="native-cancel">취소</button></div>
</div>`;
const READ = `<div data-testid="issue.views.field.rich-text.description" role="button" style="padding:8px;border:1px solid transparent">${RENDERER}</div>`;

export const jiraIssue = doc('[NPT-143] Jira', `
<div id="jira-root"><main>
  <nav><a data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item" href="/browse/NPT-143">NPT-143</a></nav>
  <h1 data-testid="issue.views.issue-base.foundation.summary.heading">[공통] 사내 Gitlab CI 연계 분석</h1>
  <div data-testid="issue.views.issue-base.common.description.label"><div style="display:flex;align-items:center;gap:8px"><h2 style="margin:0">설명</h2></div></div>
  <div id="desc-slot">${READ}</div>
  <section id="comments"><h3>댓글</h3><div class="ak-renderer-document"><p>댓글 본문은 복사되면 안 된다</p></div></section>
</main></div>
<script>
  // Jira(React) 흉내: 루트에 위임된 click 이 설명을 편집 상태로 바꾼다
  window.__editCount = 0; window.__saved = 0;
  const READ = ${JSON.stringify(READ)}, EDITOR = ${JSON.stringify(EDITOR)};
  const slot = document.getElementById('desc-slot');
  document.getElementById('jira-root').addEventListener('click', (e) => {
    if (e.target.closest('#native-cancel')) { slot.innerHTML = READ; return; }
    if (e.target.closest('#native-save')) { window.__saved++; slot.innerHTML = READ; return; }
    const field = e.target.closest('[data-testid="issue.views.field.rich-text.description"]');
    if (!field || e.target.closest('a')) return;
    window.__editCount++; slot.innerHTML = EDITOR;
  });
</script>`);

// ---------------------------------------------------------------- Jira 보드
const today = new Date();
const iso = (d) => d.toISOString();
const addDays = (n) => new Date(today.getTime() + n * 86400000);
export const SPA_STATE = {
  UIF_BOARD: { 'uif-board::rapidboard-board::2146': { data: { result: { sprints: [
    { id: 301, name: 'Jazz-v1.0-Sprint2', state: 'ACTIVE', goal: 'SSO 연동 마무리', isoStartDate: iso(addDays(-3)), isoEndDate: iso(addDays(9)), daysRemaining: 9 },
  ] } } } },
};
const DIALOG = `<div data-testid="issue.views.issue-details.issue-modal.modal-dialog--positioner" style="position:fixed;inset:40px 120px;background:#fff;border:1px solid #ccc;padding:16px">
 <div role="dialog" data-testid="issue.views.issue-details.issue-modal.modal-dialog">
  <div style="display:flex;justify-content:space-between;align-items:center">
   <nav><a data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item" href="/browse/NPT-150">NPT-150</a></nav>
   <div style="display:flex;gap:6px"><button data-testid="issue-view-foundation.header.minimise-button.modal-minimise-button">⌄</button><button>✕</button></div>
  </div>
  <h1 data-testid="issue.views.issue-base.foundation.summary.heading">모달 속 업무</h1>
 </div></div>`;
export const jiraBoard = (withDialog) => doc('보드 2146', `
<header style="border-bottom:1px solid #ddd;padding:8px">Jira</header>
<div data-testid="software-board.header.controls-bar" style="display:flex;gap:8px;padding:8px;border-bottom:1px solid #eee"><input placeholder="보드 검색"><button>빠른 필터</button></div>
<div data-testid="software-board.board-area" style="position:relative;min-height:420px;display:flex;gap:12px;padding:12px">
  <div style="width:240px;background:#f4f5f7;padding:8px">할 일<div style="background:#fff;margin-top:8px;padding:8px">NPT-150 카드</div></div>
  <div style="width:240px;background:#f4f5f7;padding:8px">진행 중</div>
</div>
${withDialog ? DIALOG : ''}
<script>window.SPA_STATE = ${JSON.stringify(SPA_STATE)};</script>`);

export const jiraApi = (url) => {
  const u = new URL(url);
  if (/\/rest\/agile\/1\.0\/board\/2146\/sprint$/.test(u.pathname)) {
    return { isLast: true, values: [
      { id: 301, name: 'Jazz-v1.0-Sprint2', state: 'active', startDate: iso(addDays(-3)), endDate: iso(addDays(9)) },
      { id: 290, name: 'Jazz-v1.0-Sprint1', state: 'closed', startDate: iso(addDays(-17)), endDate: iso(addDays(-4)) },
    ] };
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

export const amaranthForm = doc('근태신청', `
<table><tbody><tr><th scope="row"><div>제목</div></th>
<td><div id="text4" data-orbit-component="OBTTextField"><input type="text" value="" style="width:360px"></div></td></tr></tbody></table>`);
