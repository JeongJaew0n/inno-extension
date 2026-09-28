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
