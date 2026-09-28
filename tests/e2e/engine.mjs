// 빌드된 확장을 헤드리스 Chrome 에 설치하고, 사내 사이트 요청을 가로채 픽스처를 돌려준다.
// 로그인 없이 실제 content script 가 주소 매칭 → 설정 읽기 → 주입까지 전 과정을 탄다.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../../dist');
// 프로필은 매번 지우고 새로 만든다. 저장소 밖(임시 폴더)에 둔다
const SP = join(tmpdir(), 'inno-extension-e2e');
mkdirSync(SP, { recursive: true });
/** Chrome 위치. 다른 곳에 설치했으면 CHROME_PATH 로 넘긴다 */
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); return; }
      for (const h of this.handlers) h(d);
    });
  }
  send(method, params = {}, sessionId) {
    return new Promise((r) => {
      const i = ++this.id; this.pending.set(i, r);
      this.ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(h) { this.handlers.push(h); }
}

export async function launch({ port = 9340, width = 1400, height = 900 } = {}) {
  const profile = `${SP}/profile-${port}`;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  let version;
  for (let i = 0; i < 60; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch {}
    await sleep(200);
  }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new Cdp(ws);
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  // 최신 Chrome 은 --load-extension 을 막았다. CDP 로 압축해제 확장을 설치한다
  const loaded = await cdp.send('Extensions.loadUnpacked', { path: DIST });
  const loadedId = loaded.result?.id ?? null;
  if (!loadedId) console.error('확장 설치 실패:', JSON.stringify(loaded.error ?? loaded));

  // 확장 ID 는 service worker 대상의 주소에서 읽는다
  let extId = null; let swTarget = null;
  for (let i = 0; i < 50 && !extId; i++) {
    const { result } = await cdp.send('Target.getTargets');
    swTarget = result.targetInfos.find((t) => t.type === 'service_worker' && loadedId && t.url.startsWith(`chrome-extension://${loadedId}/`));
    if (swTarget) extId = new URL(swTarget.url).host;
    else await sleep(200);
  }

  const errors = [];
  cdp.on((d) => {
    const where = d.sessionId ? `[${sessions.get(d.sessionId) ?? '?'}]` : '';
    if (d.method === 'Runtime.exceptionThrown') {
      const e = d.params.exceptionDetails;
      errors.push(`${where} 예외: ${e.exception?.description ?? e.text} @ ${e.url ?? ''}:${e.lineNumber}`);
    }
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'assert')) {
      errors.push(`${where} console.${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon|net::ERR/.test(d.params.entry.text + (d.params.entry.url ?? ''))) {
      errors.push(`${where} log: ${d.params.entry.text} ${d.params.entry.url ?? ''}`);
    }
  });
  const sessions = new Map();

  if (swTarget) {
    const { result } = await cdp.send('Target.attachToTarget', { targetId: swTarget.targetId, flatten: true });
    sessions.set(result.sessionId, 'service-worker');
    await cdp.send('Runtime.enable', {}, result.sessionId);
  }

  async function newPage(label, fixtures) {
    const { result: t } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { result: a } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    const s = a.sessionId; sessions.set(s, label);
    await cdp.send('Runtime.enable', {}, s);
    await cdp.send('Log.enable', {}, s);
    await cdp.send('Page.enable', {}, s);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, s);
    await cdp.send('Fetch.enable', { patterns: [
      { urlPattern: 'https://pms-innogrid.atlassian.net/*' }, { urlPattern: 'https://gw.innogrid.com/*' },
      { urlPattern: 'https://github.nhnent.com/*' }, { urlPattern: 'https://rnd-app.innogrid.com/*' },
    ] }, s);
    cdp.on(async (d) => {
      if (d.sessionId !== s || d.method !== 'Fetch.requestPaused') return;
      const { requestId, request, resourceType } = d.params;
      const html = resourceType === 'Document' ? fixtures(request.url) : null;
      if (html == null) {
        // API 호출(지난 스프린트 보기)은 픽스처 JSON 으로 답한다
        const json = fixtures.api?.(request.url);
        if (json != null) {
          await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
            body: Buffer.from(JSON.stringify(json)).toString('base64') }, s);
          return;
        }
        await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 404, body: '' }, s);
        return;
      }
      await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
        body: Buffer.from(html).toString('base64') }, s);
    });
    await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });

    const page = {
      session: s,
      async goto(url, wait = 1800) { await cdp.send('Page.navigate', { url }, s); await sleep(wait); },
      async ev(expr) {
        const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }, s);
        if (r.result?.exceptionDetails) throw new Error(`${label} 평가 실패: ${r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text}`);
        return r.result?.result?.value;
      },
      async click(x, y) {
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
          await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, s);
        }
        await sleep(250);
      },
      async clickEl(expr) {
        const c = await page.ev(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({block:'center'}); const b = el.getBoundingClientRect(); return [b.x + b.width/2, b.y + b.height/2, b.width, b.height]; })()`);
        if (!c || !c[2]) throw new Error(`${label}: 누를 요소 없음 → ${expr}`);
        await page.click(c[0], c[1]);
      },
      async type(text) { for (const ch of text) { await cdp.send('Input.insertText', { text: ch }, s); await sleep(60); } },
      async key(key, code, keyCode) {
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode }, s);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }, s);
        await sleep(150);
      },
      async shot(file) {
        const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, s);
        writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      },
      async clipboard() { return page.ev(`navigator.clipboard.readText().catch(e => 'ERR:' + e.message)`); },
    };
    return page;
  }

  return { cdp, extId, errors, newPage, close: () => { ws.close(); chrome.kill(); } };
}

// 결과 모음
export function reporter() {
  const rows = [];
  return {
    rows,
    check(area, name, ok, detail = '') { rows.push({ area, name, ok: !!ok, detail: String(detail).slice(0, 160) }); },
    print() {
      for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.area} | ${r.name} | ${r.detail}`);
      const fail = rows.filter((r) => !r.ok).length;
      console.log(`\n합계 ${rows.length} · 실패 ${fail}`);
      return fail;
    },
  };
}
