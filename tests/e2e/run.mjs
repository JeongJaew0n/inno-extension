// 전 기능 e2e.
//
// 빌드된 확장(dist)을 헤드리스 Chrome 에 설치하고, 사내 사이트 주소로 가는 요청을 CDP 로 가로채
// 사이트 구조를 흉내 낸 픽스처를 돌려준다. 로그인 없이 실제 content script 가 주소 매칭 → 설정
// 읽기 → 주입까지 전 과정을 탄다. 클릭은 CDP 입력이라 브라우저가 만든 진짜(isTrusted) 클릭이다.
//
//   npm run test:e2e          전체
//   node tests/e2e/run.mjs jiraIssue   스위트 하나
//
// 한계: 픽스처는 실제 사이트가 아니다. 선택자·구조는 저장소 selectors.ts 와 실측 기록을 따랐지만
// 사이트가 바뀌면 여기가 먼저 거짓말을 한다. 편집기 Markdown 변환은 진짜 ProseMirror 가 없어
// 버튼 주입과 "눌러도 예외 없음" 까지만 본다.
import { launch, reporter, sleep } from './engine.mjs';
import * as git from './fixtures-git.mjs';
import * as site from './fixtures-sites.mjs';

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 스크린샷은 여기 남는다. .gitignore 대상이다
const SP = resolve(dirname(fileURLToPath(import.meta.url)), '.out');
mkdirSync(SP, { recursive: true });
const only = process.argv[2];
const R = reporter();
const b = await launch();
R.check('확장', '설치·service worker 기동', b.extId, b.extId ?? '확장 ID 못 찾음');

const hosts = (page, root) => page.ev(`[...document.querySelectorAll('[data-inno-extension-feature="${root}"]')].length`);
const shadowBtns = (root) => `[...document.querySelectorAll('[data-inno-extension-feature="${root}"]')].flatMap(h => [...h.shadowRoot.querySelectorAll('button')])`;

const wait = sleep;
const storage = (page) => page.ev(`chrome.storage.sync.get('extensionSettings').then(r => r.extensionSettings)`);
const sroot = (root) => `document.querySelector('[data-inno-extension-feature="${root}"]')`;

async function cssIntegrity(p, area) {
  const r = await p.ev(`(() => {
    const styles = [];
    for (const h of document.querySelectorAll('[data-inno-extension-feature]')) {
      for (const s of h.shadowRoot?.querySelectorAll('style') ?? []) styles.push([h.getAttribute('data-inno-extension-feature'), s]);
    }
    for (const s of document.querySelectorAll('style[id^="inno-"]')) styles.push([s.id, s]);
    const bad = styles.filter(([, s]) => (s.textContent.match(/\\/\\*/g) || []).length !== (s.textContent.match(/\\*\\//g) || []).length).map(([n]) => n);
    return { n: styles.length, bad };
  })()`);
  R.check(area, `주입 스타일 ${r.n}개 모두 주석 짝이 맞음`, r.bad.length === 0, r.bad.join(',') || 'OK');
}

const suites = {
  // Popup 은 확장 페이지라 실제 chrome.storage 를 쓴다. 여기서 켠 설정이 뒤 스위트의 사이트 탭까지 전파된다
  async popup() {
    const p = await b.newPage('popup', () => null);
    await p.goto(`chrome-extension://${b.extId}/src/popup/index.html`, 1500);
    const sites = await p.ev(`document.querySelectorAll('.site-card').length`);
    R.check('Popup', '사이트 목록 5개', sites === 5, `${sites}개`);
    const header = await p.ev(`getComputedStyle(document.querySelector('.brand-header, .page-header')).backgroundImage`);
    R.check('Popup', '머리말이 요트 클럽 청록 그라데이션', /36, 95, 115|rgb\(36, 95, 115\)/.test(header) || header.includes('36, 95, 115'), header.slice(0, 90));

    // 모든 사이트·기능 상세를 한 번씩 연다. 렌더 오류가 있으면 오류 수집기에 잡힌다
    const siteIds = ['amaranth', 'jira', 'confluence', 'githubEnterprise', 'gitlab'];
    let opened = 0;
    for (const id of siteIds) {
      await p.ev(`location.hash = '#/sites/${id}'`); await wait(250);
      const feats = await p.ev(`[...document.querySelectorAll('[data-feature-toggle]')].map(e => e.dataset.featureId)`);
      for (const f of feats) {
        await p.ev(`location.hash = '#/sites/${id}/features/${f}'`); await wait(200);
        const ok = await p.ev(`!!document.querySelector('.feature-detail')`);
        if (ok) opened++; else R.check('Popup', `상세 화면 ${id}.${f}`, false, '렌더 안 됨');
      }
    }
    R.check('Popup', '모든 기능 상세 화면이 열린다', opened >= 20, `${opened}개 열림`);

    // 기본이 꺼진 두 기능을 Popup 스위치로 켠다
    for (const [id, f] of [['jira', 'issueModalWidth'], ['confluence', 'pageMarkdownAppend']]) {
      await p.ev(`location.hash = '#/sites/${id}/features/${f}'`); await wait(300);
      await p.clickEl(`document.querySelector('[data-feature-toggle][data-feature-id="${f}"]').closest('label')`);
      await wait(400);
      const st = await storage(p);
      R.check('Popup', `스위치로 ${f} 켜기 → 저장소 반영`, st?.sites?.[id]?.features?.[f]?.enabled === true, JSON.stringify(st?.sites?.[id]?.features?.[f]));
    }

    // 아마란스 제목 자동채움 문구 저장
    await p.ev(`location.hash = '#/sites/amaranth/features/titleAutofill'`); await wait(300);
    await p.clickEl(`document.querySelector('[data-option="titleText"]')`);
    await p.type('연차휴가 신청');
    await p.clickEl(`document.querySelector('[data-save-feature-options]')`);
    await wait(500);
    const st = await storage(p);
    R.check('Popup', '제목 자동채움 문구 저장', st?.sites?.amaranth?.features?.titleAutofill?.options?.titleText === '연차휴가 신청', st?.sites?.amaranth?.features?.titleAutofill?.options?.titleText);

    // prefix 태그 추가
    await p.ev(`location.hash = '#/sites/jira/features/backlogSlashTemplate'`); await wait(300);
    const before = await p.ev(`document.querySelectorAll('.prefix-tag-table tbody tr').length`);
    await p.clickEl(`document.querySelector('[data-prefix-tag-new]')`);
    await p.type('[E2E]');
    await p.clickEl(`document.querySelector('[data-prefix-tag-add]')`);
    await wait(400);
    const after = await p.ev(`document.querySelectorAll('.prefix-tag-table tbody tr').length`);
    R.check('Popup', 'prefix 태그 추가', after === before + 1, `${before} → ${after}`);
    await wait(600);
    R.check('Popup', '추가 뒤 입력칸이 비워짐', (await p.ev(`document.querySelector('[data-prefix-tag-new]').value`)) === '', '');
    // 입력하는 중에 저장소가 바뀌어도(다른 탭의 변경) 치던 글자가 남아야 한다
    await p.clickEl(`document.querySelector('[data-prefix-tag-new]')`);
    await p.type('[초안]');
    await p.ev(`chrome.storage.sync.get('extensionSettings').then(r => { const s = r.extensionSettings; s.sites.gitlab.features.commitShaCopy.enabled = true; s.__touch = Date.now(); return chrome.storage.sync.set({ extensionSettings: s }); })`);
    await wait(800);
    const draft = await p.ev(`document.querySelector('[data-prefix-tag-new]').value`);
    R.check('Popup', '입력 중 다른 탭에서 설정이 바뀌어도 입력값 유지', draft === '[초안]', JSON.stringify(draft));
    await p.ev(`document.querySelector('[data-prefix-tag-new]').value = ''`);
    await p.shot(`${SP}/popup-prefix.png`);

    // 클릭 편집 방지 Popup 스위치
    await p.ev(`location.hash = '#/sites/jira/features/descriptionEditLock'`); await wait(300);
    const lockSwitch = await p.ev(`!!document.querySelector('[data-edit-lock-toggle]')`);
    R.check('Popup', '클릭 편집 방지 상세에 스위치', lockSwitch, '');
    await p.ev(`location.hash = '#/'`); await wait(300);
    await p.shot(`${SP}/popup-home.png`);
    b.popup = p;
  },

  async jiraIssue() {
    const p = await b.newPage('jira-issue', (url) => (new URL(url).pathname.startsWith('/browse/') ? site.jiraIssue : null));
    await p.goto('https://pms-innogrid.atlassian.net/browse/NPT-143', 3000);
    for (const [root, n] of [['jira-issue-link-copy', 1], ['jira-description-markdown-copy', 1], ['jira-description-edit-lock', 1]]) {
      const c = await hosts(p, root);
      R.check('Jira 업무', `${root} 주입`, c === n, `${c}개`);
    }
    const order = await p.ev(`[...${sroot('jira-description-edit-lock')}.parentElement.children].map(c => c.getAttribute('data-inno-extension-feature') || c.tagName).join(' > ')`);
    R.check('Jira 업무', '클릭 편집 방지가 Markdown 복사 왼쪽', /edit-lock > jira-description-markdown-copy/.test(order), order);
    const gapPx = await p.ev(`(() => { const a = ${sroot('jira-description-edit-lock')}.getBoundingClientRect(); const b = ${sroot('jira-description-markdown-copy')}.getBoundingClientRect(); return Math.round(b.left - a.right); })()`);
    R.check('Jira 업무', '클릭 편집 방지가 Markdown 복사에 붙어 있음(줄 가운데로 뜨지 않음)', gapPx >= 0 && gapPx <= 16, `${gapPx}px`);

    await p.clickEl(`${sroot('jira-description-markdown-copy')}.shadowRoot.querySelector('button')`);
    const md = await p.clipboard();
    R.check('Jira 업무', '설명 Markdown 복사 — 제목·표·링크', md.includes('## 목표') && md.includes('| 이름 | 값 |') && md.includes('[설계 문서](https://example.com/doc)'), md.replace(/\n/g, '⏎').slice(0, 120));
    R.check('Jira 업무', '설명 Markdown 복사 — 댓글 제외', !md.includes('댓글 본문'), '');

    await p.clickEl(`${sroot('jira-issue-link-copy')}.shadowRoot.querySelectorAll('button')[1]`);
    const link = await p.clipboard();
    R.check('Jira 업무', '업무 링크 복사(제목포함)', link.includes('NPT-143') && link.includes('사내 Gitlab CI 연계 분석'), link);

    // 클릭 편집 방지 꺼짐(기본): 본문 클릭 → 편집
    const look = await p.ev(`(() => { const r = ${sroot('jira-description-edit-lock')}.shadowRoot; return [getComputedStyle(r.querySelector('[data-lock]')).opacity, getComputedStyle(r.querySelector('.inno-switch__track')).width, getComputedStyle(r.querySelector('[data-edit]')).display]; })()`);
    R.check('Jira 업무', '클릭 편집 방지가 스위치로 그려짐(체크박스 숨김)', look[0] === '0' && look[1] === '36px', look.slice(0, 2).join(' / '));
    R.check('Jira 업무', '숨긴 편집 버튼이 실제로 안 보임', look[2] === 'none', `display=${look[2]}`);
    await cssIntegrity(p, 'Jira 업무');
    const editHidden = await p.ev(`${sroot('jira-description-edit-lock')}.shadowRoot.querySelector('[data-edit]').hidden`);
    R.check('Jira 업무', '방지 꺼짐 — 편집 버튼 숨김', editHidden === true, `hidden=${editHidden}`);
    await p.clickEl(`document.querySelector('[data-testid="issue.views.field.rich-text.description"] p')`);
    R.check('Jira 업무', '방지 꺼짐 — 본문 클릭 → 편집 진입', await p.ev('__editCount') === 1, `editCount=${await p.ev('__editCount')}`);
    await wait(600);
    const actions = await p.ev(`${sroot('jira-description-edit-actions')}?.shadowRoot.querySelectorAll('button').length ?? 0`);
    R.check('Jira 업무', '편집 중 — 저장·취소 버튼 주입', actions === 2, `${actions}개`);
    const conv = await hosts(p, 'jira-editor-markdown-to-adf');
    R.check('Jira 업무', '편집 중 — Markdown 변환 버튼 주입', conv === 1, `${conv}개`);
    const convInToolbar = await p.ev(`!!document.querySelector('[data-testid="editor-primary-toolbar"] [data-inno-extension-feature="jira-editor-markdown-to-adf"]')`);
    R.check('Jira 업무', 'Markdown 변환 버튼이 편집기 툴바 안', convInToolbar, '');
    R.check('Jira 업무', '편집 중 — 편집 버튼 숨김', (await p.ev(`getComputedStyle(${sroot('jira-description-edit-lock')}.shadowRoot.querySelector('[data-edit]')).display`)) === 'none', '');
    const rowGap = await p.ev(`getComputedStyle(${sroot('jira-description-edit-actions')}.shadowRoot.querySelector('.row')).display`);
    // 부모 호스트가 flex 라 inline-flex 가 flex 로 블록화된다. 둘 다 규칙이 먹은 것이다
    R.check('Jira 업무', '저장·취소 줄 배치 규칙이 먹음', rowGap === 'inline-flex' || rowGap === 'flex', rowGap);
    await p.shot(`${SP}/jira-edit.png`);
    await p.clickEl(`${sroot('jira-description-edit-actions')}.shadowRoot.querySelector('[data-action="cancel"]')`);
    await wait(600);
    R.check('Jira 업무', '우리 취소 → Jira 취소 버튼을 대신 누름', await p.ev(`!!document.querySelector('[data-testid="issue.views.field.rich-text.description"]')`), '읽기 상태로 복귀');

    // 클릭 편집 방지 켜기 (페이지 스위치 → 실제 chrome.storage → 다시 그려짐)
    await p.clickEl(`${sroot('jira-description-edit-lock')}.shadowRoot.querySelector('.inno-switch')`);
    await wait(900);
    const shown = await p.ev(`${sroot('jira-description-edit-lock')}.shadowRoot.querySelector('[data-edit]').hidden === false`);
    R.check('Jira 업무', '방지 켜짐 — 편집 버튼 나타남', shown, '');
    await p.clickEl(`document.querySelector('[data-testid="issue.views.field.rich-text.description"] p')`);
    R.check('Jira 업무', '방지 켜짐 — 본문 클릭해도 편집 안 됨', await p.ev('__editCount') === 1, `editCount=${await p.ev('__editCount')}`);
    await p.clickEl(`${sroot('jira-description-edit-lock')}.shadowRoot.querySelector('[data-edit]')`);
    R.check('Jira 업무', '방지 켜짐 — 편집 버튼으로 진입', await p.ev('__editCount') === 2, `editCount=${await p.ev('__editCount')}`);
    await wait(500);
    if (b.popup) {
      await b.popup.ev(`location.hash = '#/sites/jira/features/descriptionEditLock'`); await wait(500);
      const popupSees = await b.popup.ev(`document.querySelector('[data-edit-lock-toggle]').checked`);
      R.check('Jira 업무', '화면 스위치 → Popup 스위치도 켜짐(전역 공유)', popupSees === true, `popup checked=${popupSees}`);
    }
    await p.shot(`${SP}/jira-issue.png`);
  },

  async jiraBoard() {
    const map = (url) => (/\/boards\/2146/.test(new URL(url).pathname) ? site.jiraBoard(new URL(url).searchParams.has('selectedIssue')) : null);
    map.api = site.jiraApi;
    const p = await b.newPage('jira-board', map);
    await p.goto('https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146', 3500);
    const row = await p.ev(`!!document.querySelector('[data-inno-extension-feature="jira-board-tool-row"]')`);
    R.check('Jira 보드', '우리 도구 줄이 컨트롤 바 아래', row && await p.ev(`document.querySelector('[data-testid="software-board.header.controls-bar"]').nextElementSibling?.getAttribute('data-inno-extension-feature') === 'jira-board-tool-row'`), '');
    const chip = await p.ev(`${sroot('jira-board-sprint-info')}?.shadowRoot.querySelector('[data-sprint-text]')?.textContent ?? null`);
    R.check('Jira 보드', '활성 스프린트 칩 (SPA_STATE → MAIN 브리지)', chip && /Jazz-v1\\.0-Sprint2|~/.test(chip), chip);
    const trig = await hosts(p, 'jira-past-sprint-view');
    R.check('Jira 보드', '지난 스프린트 선택 주입', trig === 1, `${trig}개`);
    await p.clickEl(`${sroot('jira-past-sprint-view')}.shadowRoot.querySelector('[data-trigger]')`);
    await wait(900);
    const rows = await p.ev(`[...${sroot('jira-past-sprint-view')}.shadowRoot.querySelectorAll('[data-sprint-id]')].map(r => r.textContent.trim().replace(/\\s+/g,' '))`);
    R.check('Jira 보드', '스프린트 목록 (GET /rest/agile/1.0/board/2146/sprint)', rows.length === 2, rows.join(' | '));
    await p.clickEl(`${sroot('jira-past-sprint-view')}.shadowRoot.querySelector('[data-sprint-id="290"]')`);
    await wait(1200);
    const cards = await p.ev(`${sroot('jira-past-sprint-panel')}?.shadowRoot.querySelectorAll('[data-issue-key]').length ?? 0`);
    R.check('Jira 보드', '지난 스프린트 패널 — 카드 3장', cards === 3, `${cards}장`);
    const card = await p.ev(`(() => { const c = ${sroot('jira-past-sprint-panel')}.shadowRoot.querySelector('.inno-card'); const s = getComputedStyle(c); return [s.borderTopStyle, s.borderTopLeftRadius, s.backgroundColor]; })()`);
    R.check('Jira 보드', '카드가 디자인 시스템 모양(기본 버튼 아님)', card[0] === 'none' && card[1] !== '0px', card.join(' / '));
    await cssIntegrity(p, 'Jira 보드');
    await p.shot(`${SP}/jira-past-sprint.png`);
    await p.ev(`(() => { const s = ${sroot('jira-past-sprint-panel')}.shadowRoot.querySelector('[data-panel-group]'); s.value = 'assignee'; s.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await wait(500);
    const groups = await p.ev(`${sroot('jira-past-sprint-panel')}.shadowRoot.querySelectorAll('.inno-group').length`);
    R.check('Jira 보드', '담당자별 보기 — 묶음 3개', groups === 3, `${groups}개`);
    await p.clickEl(`${sroot('jira-past-sprint-panel')}.shadowRoot.querySelector('[data-panel-close]')`);
    await wait(400);
    R.check('Jira 보드', '패널 닫기', !(await p.ev(`!!${sroot('jira-past-sprint-panel')}`)), '');

    // 업무 모달 (Popup 에서 켠 issueModalWidth)
    await p.goto('https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146?selectedIssue=NPT-150', 3000);
    const wide = await hosts(p, 'jira-issue-modal-width');
    R.check('Jira 보드', '업무 모달 전체 폭 토글 주입 (Popup 에서 켠 설정 반영)', wide === 1, `${wide}개`);
    await p.clickEl(`${sroot('jira-issue-modal-width')}.shadowRoot.querySelector('button')`);
    await wait(300);
    R.check('Jira 보드', '전체 폭 토글 → html 속성', await p.ev(`document.documentElement.hasAttribute('data-inno-jira-wide')`), '');
    const lc = await hosts(p, 'jira-issue-link-copy');
    R.check('Jira 보드', '모달 속 업무 링크 복사', lc === 1, `${lc}개`);
  },

  async jiraBacklog() {
    const p = await b.newPage('jira-backlog', (url) => (/\/backlog$/.test(new URL(url).pathname) ? site.jiraBacklog : null));
    await p.goto('https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146/backlog', 2500);
    await p.clickEl(`document.querySelector('input[aria-label="Work item summary"]')`);
    await p.type('/');
    await wait(500);
    const items = await p.ev(`[...(${sroot('jira-backlog-slash-template')}?.shadowRoot.querySelectorAll('li') ?? [])].map(l => l.textContent)`);
    R.check('Jira 백로그', '/ → prefix 태그 목록 (Popup 에서 추가한 [E2E] 포함)', items.length >= 10 && items.includes('[E2E]'), `${items.length}개: ${items.slice(0, 4).join(' ')} … ${items.slice(-1)}`);
    await cssIntegrity(p, 'Jira 백로그');
    const bfoot = await p.ev(`getComputedStyle(${sroot('jira-backlog-slash-template')}.shadowRoot.querySelector('.inno-listbox__footer')).backgroundColor`);
    R.check('Jira 백로그', '목록 바닥 줄 배경이 불투명', bfoot !== 'rgba(0, 0, 0, 0)', bfoot);
    await p.shot(`${SP}/jira-backlog-list.png`);
    await p.type('git');
    await wait(300);
    const filtered = await p.ev(`[...${sroot('jira-backlog-slash-template')}.shadowRoot.querySelectorAll('li')].map(l => l.textContent)`);
    R.check('Jira 백로그', '/git → [GitOps] 로 걸러짐', filtered.join(',') === '[GitOps]', filtered.join(','));
    await p.key('Enter', 'Enter', 13);
    const val = await p.ev(`document.querySelector('input[aria-label="Work item summary"]').value`);
    R.check('Jira 백로그', 'Enter → 입력값이 태그로 치환', val === '[GitOps] ', JSON.stringify(val));
    await p.shot(`${SP}/jira-backlog.png`);
  },

  async jiraCreate() {
    const p = await b.newPage('jira-create', (url) => (/\/jira\/create/.test(new URL(url).pathname) ? site.jiraCreate : null));
    await p.goto('https://pms-innogrid.atlassian.net/jira/create', 2000);
    await p.clickEl(`document.getElementById('open-create')`);
    await wait(900);
    const btn = await hosts(p, 'jira-create-quick-dates');
    R.check('Jira 업무 생성', '오늘부터 시작 버튼 주입', btn === 1, `${btn}개`);
    const placed = await p.ev(`${sroot('jira-create-quick-dates')}.nextElementSibling?.getAttribute('data-testid')`);
    R.check('Jira 업무 생성', '버튼이 요약 필드 바로 위', placed === 'issue-create-modernised.field-renderer.field.summary', placed);
    await p.clickEl(`${sroot('jira-create-quick-dates')}.shadowRoot.querySelector('button')`);
    await wait(4500);
    const expect = await p.ev(`(() => { const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 3);
      const f = (x) => x.getFullYear() + '년 ' + (x.getMonth()+1) + '월 ' + x.getDate() + '일'; return [f(t), f(d)]; })()`);
    const got = await p.ev(`['customfield_10015','duedate'].map(id => document.querySelector('[data-testid="issue-create-modernised.field-renderer.field.' + id + '"] [data-trigger]')?.textContent)`);
    R.check('Jira 업무 생성', '접힌 모달에서 두 단계 펼친 뒤 시작=오늘', got[0] === expect[0], `${got[0]} (기대 ${expect[0]})`);
    R.check('Jira 업무 생성', '기한=오늘+3일 (달 넘김 포함)', got[1] === expect[1], `${got[1]} (기대 ${expect[1]})`);
    // 멱등: 펼쳐진 상태에서 다시 눌러도 같은 결과
    await wait(1800);
    await p.clickEl(`${sroot('jira-create-quick-dates')}.shadowRoot.querySelector('button')`);
    await wait(4000);
    const got2 = await p.ev(`['customfield_10015','duedate'].map(id => document.querySelector('[data-testid="issue-create-modernised.field-renderer.field.' + id + '"] [data-trigger]')?.textContent)`);
    R.check('Jira 업무 생성', '펼쳐진 상태에서 다시 눌러도 같은 결과(멱등)', got2.join() === expect.join(), got2.join(' / '));

    // $ 템플릿
    await p.clickEl(`document.querySelector('[data-testid$="field.description"] .ProseMirror')`);
    await p.type('$');
    await wait(700);
    const list = await p.ev(`[...(${sroot('jira-create-template-insert')}?.shadowRoot.querySelectorAll('li') ?? [])].map(l => l.textContent)`);
    R.check('Jira 업무 생성', '$ → 템플릿 목록 5종', list.join(',') === '작업,버그,에픽,하위 작업,문서', list.join(','));
    const dollar = await p.ev(`document.querySelector('[data-testid$="field.description"] .ProseMirror').textContent`);
    R.check('Jira 업무 생성', '$ 는 문서에 남지 않는다', !dollar.includes('$'), JSON.stringify(dollar));
    const gap = await p.ev(`(() => { const l = ${sroot('jira-create-template-insert')}.getBoundingClientRect(); const e = document.querySelector('[data-testid$="field.description"] .ProseMirror').getBoundingClientRect(); return Math.round(l.top - e.top); })()`);
    R.check('Jira 업무 생성', '목록이 편집기 첫 줄 가까이(한참 밑 아님)', gap < 60, `편집기 위에서 ${gap}px`);
    const footer = await p.ev(`getComputedStyle(${sroot('jira-create-template-insert')}.shadowRoot.querySelector('.inno-listbox__footer')).backgroundColor`);
    R.check('Jira 업무 생성', '목록 바닥 줄 배경이 불투명', footer !== 'rgba(0, 0, 0, 0)' && footer !== 'transparent', footer);
    await cssIntegrity(p, 'Jira 업무 생성');
    await p.shot(`${SP}/jira-create-list.png`);
    await p.clickEl(`[...${sroot('jira-create-template-insert')}.shadowRoot.querySelectorAll('li')].find(l => l.textContent === '버그')`);
    await wait(1200);
    const heads = await p.ev(`[...document.querySelectorAll('[data-testid$="field.description"] .ProseMirror h2')].map(h => h.textContent)`);
    R.check('Jira 업무 생성', '버그 템플릿이 서식(H2)으로 삽입', heads.join(',') === 'Goal,Output,현상,조치', heads.join(','));
    await p.shot(`${SP}/jira-create.png`);
  },

  async confluence() {
    const map = (url) => {
      const u = new URL(url);
      if (/\/pages\/edit-v2\//.test(u.pathname)) return site.confluenceEdit;
      if (/\/wiki\/spaces\/[^/]+\/pages\/\d+/.test(u.pathname)) return site.confluencePage;
      return null;
    };
    const p = await b.newPage('confluence', map);
    await p.goto('https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2177630217/DevOpsit+CCP', 3000);
    const c = await hosts(p, 'confluence-page-markdown-copy');
    R.check('Confluence', '본문 Markdown 복사 주입', c === 1, `${c}개`);
    const where = await p.ev(`${sroot('confluence-page-markdown-copy')}.dataset.placement`);
    R.check('Confluence', '링크 복사 옆 툴바에 배치', where === 'toolbar', where);
    await p.clickEl(`${sroot('confluence-page-markdown-copy')}.shadowRoot.querySelector('button')`);
    const md = await p.clipboard();
    R.check('Confluence', '본문 Markdown — 제목·목록·표', md.includes('## 목표') && md.includes('- 파이프라인 수정') && md.includes('| STREAM | dev-001 |'), md.replace(/\n/g, '⏎').slice(0, 120));
    await p.shot(`${SP}/confluence-page.png`);
    await p.goto('https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/edit-v2/2177630217', 3000);
    const e = await hosts(p, 'confluence-editor-markdown-to-adf');
    R.check('Confluence', '편집기 Markdown 변환 버튼 (Popup 에서 켠 설정 반영)', e === 1, `${e}개`);
    const inBar = await p.ev(`!!document.querySelector('[data-testid="editor-primary-toolbar"] [data-inno-extension-feature="confluence-editor-markdown-to-adf"]')`);
    R.check('Confluence', '변환 버튼이 툴바 안', inBar, '');
    await cssIntegrity(p, 'Confluence');
    // 진짜 ProseMirror 가 없어 변환 자체는 못 한다. 눌렀을 때 예외 없이 안전하게 끝나는지만 본다
    const before = b.errors.length;
    await p.clickEl(`${sroot('confluence-editor-markdown-to-adf')}.shadowRoot.querySelector('button')`);
    await wait(2500);
    const label = await p.ev(`${sroot('confluence-editor-markdown-to-adf')}.shadowRoot.querySelector('button').textContent.trim().replace(/\s+/g,' ')`);
    const newErrs = b.errors.slice(before);
    const uncaught = newErrs.filter((e) => e.includes('예외:'));
    R.check('Confluence', 'Markdown 변환 클릭 — 잡히지 않은 예외 없음', uncaught.length === 0, uncaught.join(' | ') || `버튼: ${label}`);
    // 처리된 실패 로그(console.error)는 대역 한계로 기대되는 것이라 전체 오류 집계에서 뺀다
    b.errors.splice(before, newErrs.length, ...uncaught);
    R.check('Confluence', 'Markdown 변환 클릭 — 결과를 버튼에 표시', label.length > 0, label);
    await p.shot(`${SP}/confluence-edit.png`);
  },

  async amaranth() {
    const map = (url) => { const u = new URL(url); return u.hash ? site.amaranthForm : (u.pathname === '/form' ? site.amaranthForm : site.amaranthMain); };
    const p = await b.newPage('amaranth', map);
    await p.goto('https://gw.innogrid.com/', 3000);
    const att = await p.ev(`document.getElementById('inno-amaranth-attendance-header')?.querySelectorAll('button').length ?? 0`);
    R.check('아마란스', '출퇴근 헤더 버튼 주입 (누르지 않음)', att >= 2, `${att}개`);
    const active = await p.ev(`[...document.querySelectorAll('#inno-amaranth-attendance-header .is-active')].map(b => b.textContent.trim())`);
    R.check('아마란스', '출근 상태가 활성으로 표시', active.some(t => t.includes('출근')), active.join(','));
    const refresh = await p.ev(`!!document.getElementById('inno-amaranth-notification-refresh')`);
    R.check('아마란스', '알림 새로고침 버튼', refresh, '');
    const copies = await p.ev(`document.querySelectorAll('.inno-amaranth-verification-copy').length`);
    R.check('아마란스', '인증코드 알림에만 복사 버튼', copies === 1, `${copies}개`);
    await p.clickEl(`document.querySelector('.inno-amaranth-verification-copy')`);
    const code = await p.clipboard();
    R.check('아마란스', '인증코드 복사', code === '039911', code);
    const tokenScope = await p.ev(`getComputedStyle(document.querySelector('.inno-amaranth-verification-copy')).getPropertyValue('--inno-primary').trim()`);
    R.check('아마란스', '페이지 주입 스타일에도 요트 클럽 토큰', tokenScope === '#245f73', tokenScope);
    await cssIntegrity(p, '아마란스');
    await p.shot(`${SP}/amaranth-main.png`);
    await p.goto('https://gw.innogrid.com/form#/HP/HPD0110/HPD0110', 2500);
    const t = await p.ev(`!!document.getElementById('inno-amaranth-title-autofill')`);
    R.check('아마란스', '근태신청 제목 자동채움 버튼', t, '');
    await p.clickEl(`document.getElementById('inno-amaranth-title-autofill')`);
    const v = await p.ev(`document.querySelector('#text4 input').value`);
    R.check('아마란스', '누르면 Popup 에서 저장한 문구로 채움', v === '연차휴가 신청', JSON.stringify(v));
    await p.shot(`${SP}/amaranth-form.png`);
  },

  async gitlab() {
    const map = (url) => {
      const u = new URL(url);
      if (/\/-\/merge_requests\/\d+\/?$/.test(u.pathname)) return git.gitlabMrDetail;
      if (/\/-\/merge_requests\/?$/.test(u.pathname)) return git.gitlabMrList;
      if (/personal_access_tokens\/granular\/new\/?$/.test(u.pathname)) return git.gitlabTokenNew;
      if (/personal_access_tokens\/?$/.test(u.pathname)) return git.gitlabTokenList;
      return null;
    };
    const p = await b.newPage('gitlab', map);
    await p.goto('https://rnd-app.innogrid.com/g/p/-/merge_requests/15', 2500);
    const commit = await hosts(p, 'gitlab-commit-sha-copy');
    R.check('GitLab', '커밋 번호 복사 — 시스템 노트의 커밋에만 주입', commit === 2, `호스트 ${commit}개 (시스템 노트 2, 댓글 1 은 제외돼야 함)`);
    const title = await hosts(p, 'gitlab-merge-request-title-copy');
    R.check('GitLab', 'MR 제목 복사 — 상세', title === 1, `호스트 ${title}개`);
    await p.clickEl(`${shadowBtns('gitlab-commit-sha-copy')}[0]`);
    const clip = await p.clipboard();
    R.check('GitLab', '커밋 번호 복사 — 전체 SHA 가 클립보드에', clip === git.SHAS.SHA1, clip);
    await p.clickEl(`${shadowBtns('gitlab-merge-request-title-copy')}[0]`);
    const clip2 = await p.clipboard();
    R.check('GitLab', 'MR 제목 복사 — Markdown 링크', /^\[\\\[NPT-253\\\].*\]\(https:\/\/rnd-app\.innogrid\.com\/g\/p\/-\/merge_requests\/15\)$/.test(clip2), clip2);
    const size = await p.ev(`(() => { const b = ${shadowBtns('gitlab-commit-sha-copy')}[0].getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; })()`);
    R.check('GitLab', '아이콘 버튼 24×24', size[0] === 24 && size[1] === 24, size.join('×'));
    const color = await p.ev(`getComputedStyle(${shadowBtns('gitlab-merge-request-title-copy')}[0]).getPropertyValue('--inno-primary').trim()`);
    R.check('GitLab', '요트 클럽 토큰 적용', color === '#245f73', color);
    await cssIntegrity(p, 'GitLab');
    await p.shot(`${SP}/gitlab-detail.png`);
    await p.goto('https://rnd-app.innogrid.com/g/p/-/merge_requests', 2500);
    const list = await hosts(p, 'gitlab-merge-request-title-copy');
    R.check('GitLab', 'MR 제목 복사 — 목록 행마다', list === 2, `호스트 ${list}개`);

    // 토큰 권한 프리셋 — 선택만 하고 제출하지 않는다
    await p.goto('https://rnd-app.innogrid.com/-/user_settings/personal_access_tokens', 2500);
    R.check('GitLab', '토큰 프리셋 — 토큰 목록 화면에는 없다', await hosts(p, 'gitlab-token-permission-preset') === 0);
    await p.goto('https://rnd-app.innogrid.com/-/user_settings/personal_access_tokens/granular/new', 2500);
    const presetHosts = await hosts(p, 'gitlab-token-permission-preset');
    R.check('GitLab', '토큰 프리셋 — 생성 화면 제목 아래에 버튼 하나', presetHosts === 1
      && await p.ev(`document.querySelector('[data-testid="page-heading"]').nextElementSibling?.getAttribute('data-inno-extension-feature')`) === 'gitlab-token-permission-preset', `호스트 ${presetHosts}개`);
    const untouched = await p.ev(`({ emitted: window.__emitted ?? null, scope: document.querySelector('input[value="all"]').checked })`);
    R.check('GitLab', '토큰 프리셋 — 누르기 전에는 아무것도 바꾸지 않는다', untouched.emitted === null && untouched.scope === false, JSON.stringify(untouched));
    await p.clickEl(`${shadowBtns('gitlab-token-permission-preset')}[0]`);
    await wait(2500);
    const after = await p.ev(`({ emitted: window.__emitted ?? null, synced: !!window.__synced, submitted: window.__submitted ?? 0,
      scope: document.querySelector('input[value="all"]').checked,
      result: ${sroot('gitlab-token-permission-preset')}.shadowRoot.querySelector('.result').innerText,
      tone: ${sroot('gitlab-token-permission-preset')}.shadowRoot.querySelector('.result').dataset.tone })`);
    R.check('GitLab', '토큰 프리셋 — 프리셋 카테고리 권한만 선택기에 넘긴다', JSON.stringify(after.emitted) === JSON.stringify({
      namespace: ['read_pipeline', 'update_pipeline', 'read_wiki'], user: ['read_user'], instance: ['read_project'] }) && after.synced, JSON.stringify(after.emitted));
    R.check('GitLab', '토큰 프리셋 — 접근 범위를 All groups and projects 로 고른다', after.scope === true);
    R.check('GitLab', '토큰 프리셋 — 폼을 제출하지 않는다', after.submitted === 0, `submit ${after.submitted}회`);
    R.check('GitLab', '토큰 프리셋 — 결과 문구 (없는 카테고리 경고 포함)', /권한 5개 선택/.test(after.result) && /화면에 없는 카테고리/.test(after.result) && after.tone === 'warn', after.result.replace(/\n/g, ' / '));
    await p.shot(`${SP}/gitlab-token-preset.png`);
  },

  async github() {
    const map = (url) => {
      const u = new URL(url);
      if (/\/pull\/\d+\/?$/.test(u.pathname)) return git.githubPrDetail;
      if (/\/pulls\/?$/.test(u.pathname)) return git.githubPrList;
      return null;
    };
    const p = await b.newPage('github', map);
    await p.goto('https://github.nhnent.com/o/r/pull/7', 2500);
    const commit = await hosts(p, 'github-commit-sha-copy');
    R.check('GitHub', '커밋 번호 복사 — 타임라인 커밋마다', commit === 2, `호스트 ${commit}개`);
    const title = await hosts(p, 'github-pull-request-title-copy');
    R.check('GitHub', 'PR 제목 복사 — 상세', title === 1, `호스트 ${title}개`);
    await p.clickEl(`${shadowBtns('github-commit-sha-copy')}[1]`);
    const clip = await p.clipboard();
    R.check('GitHub', '커밋 번호 복사 — 전체 SHA', clip === git.SHAS.SHA2, clip);
    await p.clickEl(`${shadowBtns('github-pull-request-title-copy')}[1]`);
    const clip2 = await p.clipboard();
    R.check('GitHub', 'PR 제목만 복사 — 평문', clip2 === 'Jazz 통합 포털 SSO 연동', clip2);
    await cssIntegrity(p, 'GitHub');
    await p.shot(`${SP}/github-detail.png`);
    await p.goto('https://github.nhnent.com/o/r/pulls', 2500);
    const list = await hosts(p, 'github-pull-request-title-copy');
    R.check('GitHub', 'PR 제목 복사 — 목록 행마다', list === 2, `호스트 ${list}개`);
  },
};

for (const [name, fn] of Object.entries(suites)) {
  if (only && only !== name) continue;
  try { await fn(); } catch (e) { R.check(name, '스위트 실행', false, e.message); }
}
await sleep(500);
R.check('전체', '페이지·content script·service worker 오류 없음', b.errors.length === 0, b.errors.join(' || ') || '0건');
const fail = R.print();
b.close();
process.exit(fail ? 1 : 0);
