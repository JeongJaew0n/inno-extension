const SHA1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const SHA2 = 'ffeeddccbbaa99887766554433221100aabbccdd';
const page = (title, body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;margin:24px;color:#1f2328}h1{display:flex;align-items:center;gap:8px}</style></head><body>${body}</body></html>`;

export const gitlabMrDetail = page('MR !15', `
<div class="merge-request"><div style="display:flex;align-items:center;gap:12px">
<h1 class="title gl-heading-1" data-testid="title-content">[NPT-253] dev/001 이미지 CD 를 오버레이로 전환</h1></div>
<ul class="notes">
 <li class="note system-note"><div class="note-text">added 2 commits
  <ul><li><a class="gfm gfm-commit" data-commit="${SHA1}" href="/g/p/-/commit/${SHA1}">a1b2c3d4</a> - CD 트리거 추가</li>
  <li><a class="gfm gfm-commit" data-commit="${SHA2}" href="/g/p/-/commit/${SHA2}">ffeeddcc</a> - 레지스트리 프로필</li></ul></div></li>
 <li class="note"><div class="note-text">사용자 댓글 <a class="gfm gfm-commit" data-commit="${SHA1}" href="#">a1b2c3d4</a></div></li>
</ul></div>`);

export const gitlabMrList = page('MR 목록', `
<ul class="issuable-list">
 <li><a data-testid="issuable-title-link" href="/g/p/-/merge_requests/15">[NPT-253] dev/001 이미지 CD</a></li>
 <li><a data-testid="issuable-title-link" href="/g/p/-/merge_requests/14">[NPT-246] 알람 규칙 조회</a></li>
</ul>`);

export const githubPrDetail = page('PR #7', `
<h1 class="gh-header-title"><bdi class="js-issue-title markdown-title">Jazz 통합 포털 SSO 연동</bdi> <span>#7</span></h1>
<div class="TimelineItem"><div class="TimelineItem-body">커밋
  <div class="text-right"><code><a href="/o/r/pull/7/commits/${SHA1}">a1b2c3d</a></code></div></div></div>
<div class="TimelineItem"><div class="TimelineItem-body">커밋
  <div class="text-right"><code><a href="/o/r/pull/7/commits/${SHA2}">ffeeddc</a></code></div></div></div>`);

export const githubPrList = page('PR 목록', `
<div class="js-issue-row"><a data-hovercard-type="pull_request" href="/o/r/pull/7">Jazz 통합 포털 SSO 연동</a></div>
<div class="js-issue-row"><a data-hovercard-type="pull_request" href="/o/r/pull/6">[BE] 토큰 갱신 수정</a></div>`);

export const SHAS = { SHA1, SHA2 };

// GitLab fine-grained 토큰 생성 화면 대역.
// 실측(2026-09-30)한 모양을 흉내 낸다 — Vue 2 인스턴스가 `__vue__` 로 붙어 있고, 선택기는
// 체크박스의 조상이다. 권한 목록은 조금 늦게 채워진다(화면이 불러오는 동안).
// 폼 제출은 기록만 한다. 확장이 제출하면 e2e 가 잡는다.
export const gitlabTokenNew = page('Generate fine-grained token', `
<main id="content-body">
  <div data-testid="page-heading"><h1>Generate fine-grained token</h1><p>Fine-grained personal access tokens</p></div>
  <form id="token-form" onsubmit="window.__submitted = (window.__submitted || 0) + 1; return false;">
    <h2>Group and project access</h2>
    <label><input type="radio" name="scope" value="personal"> Only my personal projects</label>
    <label><input type="radio" name="scope" value="all"> All groups and projects that I'm a member of</label>
    <label><input type="radio" name="scope" value="specific"> Only specific groups or projects that I'm a member of</label>
    <h2>Add resource permissions</h2>
    <section id="selector"><label><input type="checkbox"> CI/CD</label>
      <button type="button" aria-haspopup="true">Select permissions</button>
      <button type="button" aria-haspopup="true">Select permissions</button>
    </section>
    <button type="submit">Generate token</button>
  </form>
</main>
<script>
  const e = (name, resource, categoryName) => ({ name, resource, categoryName });
  const selector = {
    $options: { name: 'PersonalAccessTokenPermissionsSelector' }, $parent: null, $children: [],
    permissionsByBoundary: { namespace: [], user: [], instance: [] },
    emitInput(value) { window.__emitted = value; },
    syncSelectedResources() {
      window.__synced = true;
      document.querySelectorAll('#selector button[aria-haspopup]').forEach((b) => { b.textContent = '2 permissions'; });
    },
  };
  document.getElementById('selector').__vue__ = selector;
  setTimeout(() => {
    selector.permissionsByBoundary = {
      namespace: [e('read_pipeline', 'pipeline', 'CI/CD'), e('update_pipeline', 'pipeline', 'CI/CD'),
        e('read_wiki', 'wiki', 'Wiki'), e('use_duo', 'duo', 'Duo')],
      user: [e('read_user', 'user', 'System Access'), e('read_notification', 'notification', 'Notifications')],
      instance: [e('read_project', 'project', 'Projects')],
    };
  }, 400);
</script>`);

export const gitlabTokenList = page('Personal access tokens', `
<main id="content-body"><div data-testid="page-heading"><h1>Personal access tokens</h1></div></main>`);
