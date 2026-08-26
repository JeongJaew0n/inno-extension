import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { findFeatureDescriptor, SITES } from '../src/catalog/sites';
import { createUpdateScheduler } from '../src/platform/runtime/updateScheduler';
import { createDefaultSettings } from '../src/platform/settings/defaults';
import { getSettings, saveSettings } from '../src/platform/settings/repository';
import { isFeatureEffectivelyEnabled, normalizeSettings } from '../src/platform/settings/schema';
import {
  isTitleAutofillRoute,
  normalizeTitleAutofillText,
  TITLE_AUTOFILL_MAX_LENGTH,
} from '../src/sites/amaranth/features/titleAutofill/contracts';
import {
  parseAttendanceTimeText,
  readTodayCheckinTime,
} from '../src/sites/amaranth/features/attendanceHeader/checkinTime';
import { formatCheckinGreeting } from '../src/sites/amaranth/features/attendanceHeader/greeting';
import {
  extractVerificationCode,
  findVerificationCodeInNotification,
} from '../src/sites/amaranth/features/notificationTools/contracts';
import {
  escapeMarkdownText,
  isRedundantHeaderOnlyTable,
} from '../src/sites/confluence/features/pageMarkdownCopy/markdown';
import {
  parseConfluenceEditPageUrl,
  parseConfluencePageUrl,
} from '../src/sites/confluence/routes';
import {
  mayBeMermaidCodeBlock,
  readCodeBlockSources,
  summarizeConversionFailure,
} from '../src/sites/confluence/features/editorMarkdownToAdf/runtime';
import { adfDocumentToEditorHtml } from '../src/sites/confluence/features/editorMarkdownToAdf/adf-to-editor-html';
import { codeBlockMarkdownToAdfPayload } from '../src/sites/confluence/features/editorMarkdownToAdf/code-block-to-adf';
import {
  buildCollapsedMermaidSourceHtml,
  buildConfluenceMermaidExtensionHtml,
  buildConfluenceMermaidReplacementHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  isMermaidCodeBlockSource,
} from '../src/sites/confluence/features/editorMarkdownToAdf/mermaid';
import { buildIssueClipboardContent } from '../src/sites/jira/features/issueLinkCopy/clipboard';
import type { IssueViewTarget } from '../src/sites/jira/features/issueLinkCopy/runtime';
import {
  findBoardIssueScope,
  isIssueHostCurrent,
} from '../src/sites/jira/features/issueLinkCopy/runtime';
import {
  extractIssueKeyFromHref,
  isJiraBoardRoute,
  parseJiraBoardUrl,
  parseJiraIssueUrl,
} from '../src/sites/jira/routes';
import {
  CURRENT_ISSUE_LINK,
  ISSUE_DIALOG,
  ISSUE_PREVIEW_PANEL,
} from '../src/sites/jira/selectors';
import './confluence-adf.test';

function createFakeIssueLink(href: string): HTMLAnchorElement {
  return {
    getAttribute(name: string) {
      return name === 'href' ? href : null;
    },
  } as HTMLAnchorElement;
}

function createFakeIssueScope(hrefs: string[]): ParentNode {
  const links = hrefs.map(createFakeIssueLink);
  return {
    querySelector(selector: string) {
      return selector === CURRENT_ISSUE_LINK ? (links[0] ?? null) : null;
    },
    querySelectorAll(selector: string) {
      return selector === 'a[href]' ? links : [];
    },
  } as unknown as ParentNode;
}

/**
 * breadcrumb이 아직 렌더되지 않은 preview panel을 흉내낸다.
 * 이 상태에서는 헤더의 `Open in new tab` 앵커만 업무 번호를 가리킨다.
 */
function createFakeScopeWithoutBreadcrumb(hrefs: string[]): ParentNode {
  const links = hrefs.map(createFakeIssueLink);
  return {
    querySelector() {
      return null;
    },
    querySelectorAll(selector: string) {
      return selector === 'a[href]' ? links : [];
    },
  } as unknown as ParentNode;
}

function createFakeIssueDocument(options: {
  dialog?: ParentNode | null;
  panel?: ParentNode | null;
  dialogs?: ParentNode[];
}): Document {
  return {
    querySelector(selector: string) {
      if (selector === ISSUE_DIALOG) return options.dialog ?? null;
      if (selector === ISSUE_PREVIEW_PANEL) return options.panel ?? null;
      return null;
    },
    querySelectorAll(selector: string) {
      return selector === '[role="dialog"]' ? (options.dialogs ?? []) : [];
    },
  } as unknown as Document;
}

test('catalog의 사이트와 기능 ID는 중복되지 않고 기본 설정이 존재한다', () => {
  const defaults = createDefaultSettings();
  assert.equal(new Set(SITES.map((site) => site.id)).size, SITES.length);

  for (const site of SITES) {
    assert.ok(defaults.sites[site.id]);
    assert.equal(new Set(site.features.map((feature) => feature.id)).size, site.features.length);
    for (const feature of site.features) {
      assert.equal(
        defaults.sites[site.id].features[feature.id]?.enabled,
        feature.defaultEnabled,
      );
    }
  }
});

test('Manifest origin과 catalog origin이 일치한다', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8')) as {
    content_scripts: Array<{ matches: string[]; world?: string; js?: string[] }>;
    host_permissions?: string[];
    permissions?: string[];
    background?: unknown;
  };
  const manifestOrigins = Array.from(new Set(
    manifest.content_scripts.flatMap((entry) => entry.matches),
  )).sort();
  const catalogMatches = SITES.flatMap((site) => site.contentMatches).sort();
  assert.deepEqual(manifestOrigins, catalogMatches);
  assert.equal(
    manifest.content_scripts.some((entry) => (
      entry.world === 'MAIN'
      && entry.js?.includes('src/sites/confluence/main.ts')
      && entry.matches.includes('https://pms-innogrid.atlassian.net/wiki/*')
    )),
    true,
  );
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.permissions?.includes('scripting'), false);
  assert.equal(manifest.permissions?.includes('downloads'), false);
});

test('서비스 아이콘 asset은 정사각형 PNG이며 표시 크기 이상의 해상도를 가진다', async () => {
  for (const [assetPath, minimumSize] of [
    ['src/popup/assets/amaranth-favicon.png', 256],
    ['src/popup/assets/jira-favicon.png', 32],
    ['src/popup/assets/confluence-favicon.png', 128],
  ] as const) {
    const image = await readFile(assetPath);
    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);

    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(width, height);
    assert.ok(width >= minimumSize);
  }
});

test('사이트 마스터 토글은 하위 기능 값을 보존하면서 실행 여부만 차단한다', () => {
  const settings = createDefaultSettings();
  settings.sites.jira.enabled = false;

  assert.equal(settings.sites.jira.features.issueLinkCopy?.enabled, true);
  assert.equal(isFeatureEffectivelyEnabled(settings, 'jira', 'issueLinkCopy'), false);

  settings.sites.jira.enabled = true;
  assert.equal(isFeatureEffectivelyEnabled(settings, 'jira', 'issueLinkCopy'), true);
});

test('부분 설정을 기본값과 병합하고 알 수 없는 값을 무시한다', () => {
  const settings = normalizeSettings({
    schemaVersion: 1,
    sites: {
      jira: {
        enabled: false,
        features: {
          issueLinkCopy: { enabled: false, options: { ignored: true } },
        },
      },
    },
  });

  assert.equal(settings.sites.jira.enabled, false);
  assert.equal(settings.sites.jira.features.issueLinkCopy?.enabled, false);
  assert.equal(
    'boardInspector' in settings.sites.jira.features,
    false,
    '제거된 기능은 정규화 결과에 남지 않는다',
  );
  assert.equal(settings.sites.amaranth.features.attendanceHeader?.enabled, true);
  assert.equal(settings.sites.confluence.features.pageMarkdownCopy?.enabled, true);
  assert.equal(settings.sites.confluence.features.pageMarkdownAppend?.enabled, false);
});

test('제거된 기능이 저장된 설정에 남아 있어도 무시하고 정규화한다', () => {
  const settings = normalizeSettings({
    schemaVersion: 1,
    sites: {
      jira: {
        enabled: true,
        features: {
          issueLinkCopy: { enabled: true, options: {} },
          boardInspector: { enabled: true, options: { supportedBoardIds: ['2146'] } },
        },
      },
    },
  });

  assert.equal('boardInspector' in settings.sites.jira.features, false);
  assert.equal(settings.sites.jira.features.issueLinkCopy?.enabled, true);
});

test('아마란스 신청서 제목 자동채움은 대상 화면과 입력 길이를 제한한다', () => {
  const targetUrl = new URL(
    'https://gw.innogrid.com/#/HP/HPD0110/HPD0110?MicroModuleCode=eap&formId=36',
  );
  assert.equal(isTitleAutofillRoute(targetUrl), true);
  assert.equal(
    isTitleAutofillRoute(new URL('https://gw.innogrid.com/#/UD/UDA/UDA0000')),
    false,
  );
  assert.equal(normalizeTitleAutofillText('  연차휴가 신청  '), '연차휴가 신청');
  assert.equal(
    normalizeTitleAutofillText('가'.repeat(TITLE_AUTOFILL_MAX_LENGTH + 10)).length,
    TITLE_AUTOFILL_MAX_LENGTH,
  );
  assert.equal(normalizeTitleAutofillText(null), '');
});

test('아마란스 출근 인사말은 클릭 시각의 시와 분을 자연어로 만든다', () => {
  assert.equal(formatCheckinGreeting({ hours: 9, minutes: 5 }), '9시 5분 출근입니다.');
  assert.equal(formatCheckinGreeting({ hours: 18, minutes: 0 }), '18시 0분 출근입니다.');
  assert.equal(formatCheckinGreeting({ hours: 8, minutes: 58 }), '8시 58분 출근입니다.');
});

test('아마란스 인증번호는 독립된 4~6자리 문자열만 추출한다', () => {
  assert.equal(extractVerificationCode('인증번호 1234'), '1234');
  assert.equal(extractVerificationCode('OTP: 12345'), '12345');
  assert.equal(extractVerificationCode('AuthCode: 039911'), '039911');
  assert.equal(extractVerificationCode('123'), null);
  assert.equal(extractVerificationCode('1234567'), null);
  assert.equal(extractVerificationCode('앞1234567뒤'), null);
});

test('아마란스 메일 알림은 인증 문맥에서 제목 우선으로 번호를 찾는다', () => {
  assert.deepEqual(findVerificationCodeInNotification({
    source: '[메일]',
    title: 'AuthCode: 629528',
    body: 'Your authentication token code is 629528.',
  }), { code: '629528', location: 'title' });

  assert.deepEqual(findVerificationCodeInNotification({
    source: ' [메일] ',
    title: '로그인 확인',
    body: '인증번호는 039911 입니다.',
  }), { code: '039911', location: 'body' });
});

test('아마란스 인증번호 감지는 메일 출처와 인증 문맥을 모두 요구한다', () => {
  assert.equal(findVerificationCodeInNotification({
    source: '[업무보고]',
    title: 'OTP: 123456',
    body: '',
  }), null);

  assert.equal(findVerificationCodeInNotification({
    source: '[메일]',
    title: '[WBlock] 메일 리스트 - 2026/08/12 00:00:00',
    body: '',
  }), null);

  assert.equal(findVerificationCodeInNotification({
    source: '[메일]',
    title: 'AuthCode: 1234567',
    body: '',
  }), null);
});

test('아마란스 통합알림 도구는 기본 활성 기능으로 등록된다', () => {
  const descriptor = findFeatureDescriptor('amaranth', 'notificationTools');
  const settings = createDefaultSettings();

  assert.equal(descriptor.name, '통합알림 새로고침·인증번호 복사');
  assert.equal(descriptor.defaultEnabled, true);
  assert.equal(settings.sites.amaranth.features.notificationTools?.enabled, true);
});

test('Jira board URL과 selectedIssue를 파싱한다', () => {
  const nptBoard = parseJiraBoardUrl(
    'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147?selectedIssue=npt-38',
  );
  assert.deepEqual(nptBoard, {
    boardId: '2147',
    projectKey: 'NPT',
    selectedIssueKey: 'NPT-38',
    viewPath: '',
    url: 'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147?selectedIssue=npt-38',
  });
  assert.equal(isJiraBoardRoute(nptBoard), true);

  const otherProjectBoard = parseJiraBoardUrl(
    'https://pms-innogrid.atlassian.net/jira/software/c/projects/OTHER/boards/999?selectedIssue=other-1',
  );
  assert.equal(isJiraBoardRoute(otherProjectBoard), true);
  const backlogBoard = parseJiraBoardUrl(
    'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147/backlog?selectedIssue=NPT-38',
  );
  assert.equal(backlogBoard?.viewPath, '/backlog');
  assert.equal(backlogBoard?.selectedIssueKey, 'NPT-38');
  assert.equal(isJiraBoardRoute(backlogBoard), true);
  for (const unsupportedViewPath of ['/timeline', '/calendar', '/reports', '/backlog/extra']) {
    assert.equal(
      isJiraBoardRoute(parseJiraBoardUrl(
        `https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147${unsupportedViewPath}?selectedIssue=NPT-38`,
      )),
      false,
      `${unsupportedViewPath}는 지원 범위가 아니다`,
    );
  }
  assert.equal(parseJiraBoardUrl('https://example.com/jira/software/c/projects/NPT/boards/2146'), null);
});

test('Jira issue 링크에서 업무 번호를 추출한다', () => {
  assert.equal(extractIssueKeyFromHref('/browse/NPT-25'), 'NPT-25');
  assert.equal(extractIssueKeyFromHref('https://example.com/browse/NPT-25'), null);
});

test('Jira 직접 업무 조회 URL을 파싱한다', () => {
  assert.deepEqual(
    parseJiraIssueUrl('https://pms-innogrid.atlassian.net/browse/NPT-123'),
    {
      issueKey: 'NPT-123',
      url: 'https://pms-innogrid.atlassian.net/browse/NPT-123',
    },
  );
  assert.deepEqual(
    parseJiraIssueUrl('https://pms-innogrid.atlassian.net/issues/NPT-123'),
    {
      issueKey: 'NPT-123',
      url: 'https://pms-innogrid.atlassian.net/issues/NPT-123',
    },
  );
  assert.equal(extractIssueKeyFromHref('/issues/NPT-123'), 'NPT-123');
  assert.equal(parseJiraIssueUrl('https://example.com/browse/NPT-123'), null);
});

test('Jira 보드 업무 scope는 modal이 없으면 우측 preview panel을 사용한다', () => {
  const panel = createFakeIssueScope(['/browse/NPT-144']);
  const target = findBoardIssueScope(createFakeIssueDocument({ panel }), 'NPT-144');

  assert.equal(target?.scope, panel);
  assert.equal(target?.mountKind, 'board-panel-link');
  assert.equal(target?.issueLink.getAttribute('href'), '/browse/NPT-144');
});

test('Jira 보드 업무 scope는 modal과 panel이 함께 있으면 modal을 우선한다', () => {
  const dialog = createFakeIssueScope(['/browse/NPT-144']);
  const panel = createFakeIssueScope(['/browse/NPT-144']);
  const target = findBoardIssueScope(
    createFakeIssueDocument({ dialog, panel, dialogs: [dialog] }),
    'NPT-144',
  );

  assert.equal(target?.scope, dialog);
  assert.equal(target?.mountKind, 'board-dialog-link');
});

test('Jira 보드 업무 scope는 현재 selectedIssue와 일치하는 link만 선택한다', () => {
  const panel = createFakeIssueScope(['/browse/NPT-29', '/browse/NPT-144']);
  const unrelatedDialog = createFakeIssueScope(['/browse/NPT-999']);
  const target = findBoardIssueScope(
    createFakeIssueDocument({ panel, dialogs: [unrelatedDialog] }),
    'NPT-144',
  );

  assert.equal(target?.scope, panel);
  assert.equal(target?.issueLink.getAttribute('href'), '/browse/NPT-144');
  assert.equal(
    findBoardIssueScope(createFakeIssueDocument({ panel }), 'NPT-999'),
    null,
  );
});

test('Jira 업무 링크 복사는 제목 포함 여부에 따라 브라우저 링크 payload를 만든다', () => {
  assert.deepEqual(buildIssueClipboardContent('npt-4'), {
    plainText: 'NPT-4',
    htmlText: '<a href="https://pms-innogrid.atlassian.net/browse/NPT-4">NPT-4</a>',
    issueUrl: 'https://pms-innogrid.atlassian.net/browse/NPT-4',
  });
  assert.deepEqual(buildIssueClipboardContent('npt-4', '  [CCP-BE] <개선> & 확인  '), {
    plainText: 'NPT-4 [CCP-BE] <개선> & 확인',
    htmlText: '<a href="https://pms-innogrid.atlassian.net/browse/NPT-4">NPT-4</a> [CCP-BE] &lt;개선&gt; &amp; 확인',
    issueUrl: 'https://pms-innogrid.atlassian.net/browse/NPT-4',
  });
  assert.equal(buildIssueClipboardContent('invalid'), null);
});

test('Confluence 문서 조회 URL만 Markdown 복사 대상으로 판별한다', () => {
  assert.deepEqual(
    parseConfluencePageUrl(new URL(
      'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2166423922/20260806+-+example',
    )),
    { spaceKey: 'PAAS', pageId: '2166423922' },
  );
  assert.equal(
    parseConfluencePageUrl(new URL('https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/overview')),
    null,
  );
  assert.equal(
    parseConfluencePageUrl(new URL(
      'https://example.com/wiki/spaces/PAAS/pages/2166423922/example',
    )),
    null,
  );
});

test('Confluence edit-v2 URL만 편집기 변환 대상으로 판별한다', () => {
  assert.deepEqual(
    parseConfluenceEditPageUrl(new URL(
      'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/edit-v2/2177630217',
    )),
    { spaceKey: 'PAAS', pageId: '2177630217', mode: 'edit' },
  );
  assert.equal(
    parseConfluenceEditPageUrl(new URL(
      'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2177630217/title',
    )),
    null,
  );
  assert.equal(
    parseConfluenceEditPageUrl(new URL(
      'https://example.com/wiki/spaces/PAAS/pages/edit-v2/2177630217',
    )),
    null,
  );
});

test('Confluence 편집기 toolbar는 코드블럭 -> ADF와 Mermaid 버튼만 제공한다', async () => {
  const runtimeSource = await readFile(
    'src/sites/confluence/features/editorMarkdownToAdf/runtime.ts',
    'utf8',
  );

  assert.match(runtimeSource, /data-action="code-block-adf"/);
  assert.match(runtimeSource, /data-code-block-adf-label>코드블럭 -&gt; ADF/);
  assert.match(runtimeSource, /data-action="mermaid"/);
  assert.ok(
    runtimeSource.indexOf('data-action="mermaid"')
      < runtimeSource.indexOf('data-action="code-block-adf"'),
  );
  assert.doesNotMatch(runtimeSource, /data-action="convert"/);
  assert.doesNotMatch(runtimeSource, /data-action="unwrap"/);
});

test('ADF를 Confluence 편집기 paste용 안전한 HTML로 직렬화한다', () => {
  assert.equal(
    adfDocumentToEditorHtml({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '배포 <계획>' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '강조', marks: [{ type: 'strong' }] },
            { type: 'text', text: ' 링크', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
            { type: 'text', text: ' 차단', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
        {
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '항목' }] }],
          }],
        },
      ],
    }),
    '<h2>배포 &lt;계획&gt;</h2><p><strong>강조</strong><a href="https://example.com"> 링크</a> 차단</p><ul><li><p>항목</p></li></ul>',
  );
});

test('ADF 코드 언어와 expand를 Confluence schema HTML로 직렬화한다', () => {
  assert.equal(
    adfDocumentToEditorHtml({
      type: 'doc',
      version: 1,
      content: [{
        type: 'expand',
        attrs: { title: 'Mermaid <원본>' },
        content: [{
          type: 'codeBlock',
          attrs: { language: 'mermaid' },
          content: [{ type: 'text', text: 'flowchart LR\nA --> B' }],
        }],
      }],
    }),
    '<div data-node-type="expand" data-title="Mermaid &lt;원본&gt;" data-expanded="false"><pre data-language="mermaid"><code>flowchart LR\nA --&gt; B</code></pre></div>',
  );
});

test('Confluence 코드블럭 Markdown을 ADF paste payload로 만든다', () => {
  const payload = codeBlockMarkdownToAdfPayload([
    '## 제목',
    '',
    '| 항목 | 설명 |',
    '| --- | --- |',
    '| API | 첫째<br>둘째 |',
  ].join('\n'));

  assert.equal(payload.warnings.length, 0);
  assert.match(payload.html, /^<h2>제목<\/h2><table>/);
  assert.match(payload.html, /<td><p>첫째<br>둘째<\/p><\/td>/);
  assert.throws(() => codeBlockMarkdownToAdfPayload(''));
});

test('Mermaid 선언으로 시작하는 코드블럭만 변환 대상으로 판별한다', () => {
  assert.equal(isMermaidCodeBlockSource('flowchart LR\n  A --> B'), true);
  assert.equal(isMermaidCodeBlockSource('\n%% 초기화\n%%{init: {"theme": "dark"}}%%\nsequenceDiagram\nA->>B: ping'), true);
  assert.equal(isMermaidCodeBlockSource('stateDiagram-v2\n  [*] --> Ready'), true);
  assert.equal(isMermaidCodeBlockSource('const flowchart = "LR";'), false);
  assert.equal(isMermaidCodeBlockSource('graph data without direction'), false);
  assert.equal(isMermaidCodeBlockSource(''), false);
});

test('Mermaid 코드블럭 순번을 참조하는 Confluence extension paste HTML을 만든다', () => {
  const html = buildConfluenceMermaidExtensionHtml(8, 'local-id-&-1');

  assert.match(html, /data-node-type="extension"/);
  assert.match(html, new RegExp(`data-extension-key="${CONFLUENCE_MERMAID_EXTENSION_KEY}"`));
  assert.match(html, /data-extension-type="com\.atlassian\.ecosystem"/);
  assert.match(html, /data-local-id="local-id-&amp;-1"/);
  assert.match(html, /&quot;guestParams&quot;:\{&quot;index&quot;:8\}/);
  assert.match(html, /&quot;forgeEnvironment&quot;:&quot;PRODUCTION&quot;/);
  assert.match(html, /&quot;layout&quot;:&quot;extension&quot;/);
  assert.match(html, /&quot;localId&quot;:&quot;local-id-&amp;-1&quot;/);
  assert.match(html, /&quot;extensionId&quot;:&quot;ari:cloud:ecosystem::extension\//);
  assert.throws(() => buildConfluenceMermaidExtensionHtml(-1, 'invalid'));
});

test('Mermaid 원본 코드블럭을 접힌 Confluence source HTML로 만든다', () => {
  assert.equal(
    buildCollapsedMermaidSourceHtml('flowchart LR\r\n  A --> B\n<script>'),
    '<div data-node-type="expand" data-title="Mermaid 원본" data-expanded="false"><pre><code>flowchart LR\n  A --&gt; B\n&lt;script&gt;</code></pre></div>',
  );
});

test('Mermaid 컴포넌트와 접힌 원본을 한 번의 치환용 HTML로 만든다', () => {
  const html = buildConfluenceMermaidReplacementHtml(10, 'replacement-id', 'flowchart LR\n  A --> B');

  assert.match(html, /^<div data-node-type="extension"/);
  assert.match(html, /&quot;guestParams&quot;:\{&quot;index&quot;:10\}/);
  assert.match(html, /data-local-id="replacement-id"><\/div><div data-node-type="expand"/);
  assert.match(html, /data-title="Mermaid 원본" data-expanded="false">/);
  assert.match(html, /<pre><code>flowchart LR\n  A --&gt; B<\/code><\/pre><\/div>$/);
});

test('Confluence 본문의 Markdown 제어 문자를 이스케이프한다', () => {
  assert.equal(
    escapeMarkdownText('배포 *상태*와 [링크], `코드`, file_name'),
    '배포 \\*상태\\*와 \\[링크\\], \\`코드\\`, file\\_name',
  );
});

test('Confluence 고정 헤더용 단일행 표만 실제 표 앞에서 중복으로 판별한다', () => {
  assert.equal(
    isRedundantHeaderOnlyTable(
      [[' 프로파일 ', '핵심 특징']],
      [['프로파일', '핵심 특징'], ['공통', '기본 설정'], ['local', '로컬 설정']],
    ),
    true,
  );
  assert.equal(
    isRedundantHeaderOnlyTable(
      [['프로파일', '핵심 특징']],
      [['환경', '설명'], ['local', '로컬 설정']],
    ),
    false,
  );
  assert.equal(
    isRedundantHeaderOnlyTable(
      [['프로파일', '핵심 특징']],
      [['프로파일', '핵심 특징']],
    ),
    false,
  );
});

function createFakeTimerHost() {
  let currentTime = 0;
  let nextHandle = 1;
  const timers = new Map<number, { firesAt: number; handler: () => void }>();

  return {
    now: () => currentTime,
    setTimer(handler: () => void, delayMs: number) {
      const handle = nextHandle++;
      timers.set(handle, { firesAt: currentTime + delayMs, handler });
      return handle;
    },
    clearTimer(handle: number) {
      timers.delete(handle);
    },
    advance(ms: number) {
      const target = currentTime + ms;
      // 예약 시각 순서대로 발화시킨다.
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.firesAt <= target)
          .sort((left, right) => left[1].firesAt - right[1].firesAt)[0];
        if (!due) break;
        const [handle, timer] = due;
        timers.delete(handle);
        currentTime = timer.firesAt;
        timer.handler();
      }
      currentTime = target;
    },
    pendingCount: () => timers.size,
  };
}

function createSchedulerHarness(debounceMs: number, maxWaitMs: number) {
  const host = createFakeTimerHost();
  let runCount = 0;
  const scheduler = createUpdateScheduler({
    debounceMs,
    maxWaitMs,
    run: () => { runCount += 1; },
    now: host.now,
    setTimer: host.setTimer,
    clearTimer: host.clearTimer,
  });
  return { host, scheduler, getRunCount: () => runCount };
}

test('update scheduler는 조용해질 때까지 trailing debounce로 실행을 미룬다', () => {
  const { host, scheduler, getRunCount } = createSchedulerHarness(120, 1000);

  scheduler.schedule();
  host.advance(100);
  scheduler.schedule();
  host.advance(100);
  assert.equal(getRunCount(), 0, '연속 예약 중에는 실행되지 않는다');

  host.advance(120);
  assert.equal(getRunCount(), 1);
  assert.equal(scheduler.isPending(), false);
});

test('update scheduler는 maxWait를 넘기면 연속 mutation에도 반드시 실행된다', () => {
  const { host, scheduler, getRunCount } = createSchedulerHarness(120, 500);

  // debounce보다 짧은 간격으로 계속 예약해 trailing debounce를 굶긴다.
  scheduler.schedule();
  for (let elapsed = 0; elapsed < 2000; elapsed += 50) {
    host.advance(50);
    scheduler.schedule();
  }

  assert.ok(getRunCount() >= 1, 'maxWait 이후에는 예약된 실행이 발화한다');
  assert.ok(getRunCount() <= 5, 'maxWait 주기보다 과도하게 자주 실행되지 않는다');
});

test('update scheduler의 runNow는 예약을 취소하고 즉시 한 번만 실행한다', () => {
  const { host, scheduler, getRunCount } = createSchedulerHarness(120, 1000);

  scheduler.schedule();
  scheduler.runNow();
  assert.equal(getRunCount(), 1);
  assert.equal(scheduler.isPending(), false);

  host.advance(500);
  assert.equal(getRunCount(), 1, '취소된 debounce timer가 다시 실행되지 않는다');
});

test('update scheduler의 cancel은 예약된 실행을 없앤다', () => {
  const { host, scheduler, getRunCount } = createSchedulerHarness(120, 1000);

  scheduler.schedule();
  scheduler.cancel();
  host.advance(500);

  assert.equal(getRunCount(), 0);
  assert.equal(host.pendingCount(), 0);
});

test('Jira 보드 업무 scope는 breadcrumb link를 선택하면 current-issue-link로 보고한다', () => {
  const panel = createFakeIssueScope(['/browse/NPT-144']);
  const target = findBoardIssueScope(createFakeIssueDocument({ panel }), 'NPT-144');

  assert.equal(target?.issueLinkKind, 'current-issue-link');
});

test('Jira 보드 업무 scope는 breadcrumb이 없으면 일반 anchor를 issue-anchor로 보고한다', () => {
  // preview panel 헤더의 `Open in new tab` 링크만 존재하는 초기 렌더 상태
  const panel = createFakeScopeWithoutBreadcrumb(['/browse/NPT-144']);
  const target = findBoardIssueScope(createFakeIssueDocument({ panel }), 'NPT-144');

  assert.equal(target?.mountKind, 'board-panel-link');
  assert.equal(target?.issueLinkKind, 'issue-anchor');
  assert.equal(target?.issueLink.getAttribute('href'), '/browse/NPT-144');
});

function createFakeAnchor(name: string): Element {
  return { nodeName: name } as unknown as Element;
}

function createFakeMountedHost(
  issueKey: string,
  mountKind: string,
  previousElementSibling: Element | null,
): HTMLSpanElement {
  return {
    isConnected: true,
    dataset: { issueKey, mountKind },
    previousElementSibling,
  } as unknown as HTMLSpanElement;
}

function createFakeTarget(
  issueKey: string,
  mountKind: string,
  anchor: Element,
): IssueViewTarget {
  return {
    issueKey,
    issueTitle: null,
    mountKind,
    mountAnchorKind: 'current-issue-link',
    isMountedAt(host: HTMLSpanElement) {
      return host.previousElementSibling === anchor;
    },
    mountHost() {},
  } as unknown as IssueViewTarget;
}

test('Jira host 판정은 업무 번호와 mountKind가 같아도 기준 요소가 다르면 재마운트를 요구한다', () => {
  // 실제 재현 상황: panel 헤더 anchor에 붙은 host와 breadcrumb를 가리키는 새 target.
  // 둘 다 board-panel-link이므로 기준 요소를 비교하지 않으면 오배치가 영구히 고정된다.
  const headerAnchor = createFakeAnchor('header-new-tab-link');
  const breadcrumbAnchor = createFakeAnchor('breadcrumb-current-issue');
  const host = createFakeMountedHost('NPT-143', 'board-panel-link', headerAnchor);
  const target = createFakeTarget('NPT-143', 'board-panel-link', breadcrumbAnchor);

  assert.equal(isIssueHostCurrent(host, target), false);
});

test('Jira host 판정은 업무 번호, mountKind, 기준 요소가 모두 같으면 유지한다', () => {
  const anchor = createFakeAnchor('breadcrumb-current-issue');
  const host = createFakeMountedHost('NPT-143', 'board-panel-link', anchor);

  assert.equal(isIssueHostCurrent(host, createFakeTarget('NPT-143', 'board-panel-link', anchor)), true);
});

test('Jira host 판정은 업무 번호가 바뀌거나 host가 분리되면 재마운트를 요구한다', () => {
  const anchor = createFakeAnchor('breadcrumb-current-issue');
  const target = createFakeTarget('NPT-143', 'board-panel-link', anchor);

  assert.equal(
    isIssueHostCurrent(createFakeMountedHost('NPT-166', 'board-panel-link', anchor), target),
    false,
    '다른 업무로 전환되면 재마운트한다',
  );
  assert.equal(
    isIssueHostCurrent(createFakeMountedHost('NPT-143', 'direct-link', anchor), target),
    false,
    'mountKind가 바뀌면 재마운트한다',
  );
  assert.equal(isIssueHostCurrent(null, target), false, 'host가 없으면 재마운트한다');

  const detached = { isConnected: false, dataset: { issueKey: 'NPT-143', mountKind: 'board-panel-link' }, previousElementSibling: anchor } as unknown as HTMLSpanElement;
  assert.equal(isIssueHostCurrent(detached, target), false, '분리된 host는 재마운트한다');
});

/** `.cm-content .cm-line` 구조만 흉내낸 코드블럭. readConfluenceCodeBlockText가 이 경로를 읽는다. */
function createFakeCodeBlock(lines: string[] | null): HTMLElement {
  const lineNodes = (lines ?? []).map((text) => ({ textContent: text }));
  return {
    dataset: { localId: 'local-1' },
    querySelectorAll(selector: string) {
      return selector === '.cm-content .cm-line' ? lineNodes : [];
    },
    querySelector(selector: string) {
      return selector === '.cm-content' && lines !== null ? { innerText: lines.join('\n') } : null;
    },
  } as unknown as HTMLElement;
}

test('Mermaid 후보 사전 판정은 DOM 원문으로 확실히 아닌 코드블럭만 제외한다', () => {
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock(['flowchart TD', '  A --> B'])), true);
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock(['%% 주석', 'sequenceDiagram'])), true);
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock(['curl -X GET https://example.com'])), false);
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock(['{', '  "a": 1', '}'])), false);
});

test('Mermaid 후보 사전 판정은 DOM 원문을 읽을 수 없으면 후보로 남긴다', () => {
  // 렌더되지 않은 코드블럭을 잘못 제외하면 변환 대상이 사라진다.
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock(null)), true);
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock([])), true);
  assert.equal(mayBeMermaidCodeBlock(createFakeCodeBlock(['   ', ''])), true);
});

test('codeBlock 원문 읽기는 순차로 실행되고 개별 실패를 건너뛴다', async () => {
  const editor = {} as HTMLElement;
  const entries = [0, 1, 2, 3].map((index) => ({ codeBlock: createFakeCodeBlock(['x']), index }));
  const callOrder: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const result = await readCodeBlockSources(editor, entries, async (_editor, codeBlock) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const index = entries.findIndex((entry) => entry.codeBlock === codeBlock);
    callOrder.push(index);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight -= 1;
    if (index === 1 || index === 3) throw new Error(`원문을 읽지 못했습니다. index=${index}`);
    return `source-${index}`;
  });

  assert.equal(maxInFlight, 1, '동시 요청이 발생하지 않는다');
  assert.deepEqual(callOrder, [0, 1, 2, 3], '입력 순서대로 읽는다');
  assert.deepEqual(result.sources.map((entry) => entry.index), [0, 2]);
  assert.deepEqual(result.sources.map((entry) => entry.source), ['source-0', 'source-2']);
  assert.deepEqual(result.failures.map((entry) => entry.index), [1, 3]);
  assert.ok(result.failures[0].message.includes('원문을 읽지 못했습니다'));
});

test('codeBlock 원문 읽기는 Error가 아닌 예외도 실패로 수집한다', async () => {
  const entries = [{ codeBlock: createFakeCodeBlock(['x']), index: 0 }];
  const result = await readCodeBlockSources({} as HTMLElement, entries, async () => {
    throw 'not an error';
  });

  assert.equal(result.sources.length, 0);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].message, 'codeBlock 원문을 읽지 못했습니다.');
});

test('변환 실패 원인 요약은 각 실패 분기를 서로 다른 문구로 구분한다', () => {
  const cases: Array<[string, string | null]> = [
    ['문서 다른 위치에 Mermaid 컴포넌트 2개가 있습니다. 기존 컴포넌트를 정리한 뒤 다시 실행하세요.', '기존 컴포넌트 정리 필요'],
    ['Confluence 편집기 상태 브리지가 응답하지 않았습니다.', '편집기 응답 없음'],
    ['Mermaid 코드블럭을 원래 위치의 컴포넌트로 교체하지 못했습니다.', '교체 확인 실패'],
    ['Mermaid 변환 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Confluence 실행 취소를 한 번 눌러주세요.', '되돌리기 실패'],
    ['Confluence codeBlock 전체 원문을 읽지 못했습니다.', '원문 읽기 실패'],
    ['Confluence ProseMirror codeBlock 원문을 찾을 수 없습니다.', '원문 읽기 실패'],
    ['Confluence ProseMirror codeBlock 선택이 적용되지 않았습니다.', '블록 선택 실패'],
    ['Confluence 편집 본문을 찾을 수 없습니다.', '편집기 미발견'],
    ['Confluence ProseMirror 편집기 상태를 찾을 수 없습니다.', '편집기 미발견'],
    ['Confluence codeBlock 식별자를 찾을 수 없습니다.', '블록 식별 실패'],
    ['Confluence ProseMirror codeBlock 위치를 찾을 수 없습니다.', '블록 식별 실패'],
    ['알 수 없는 오류', null],
  ];

  for (const [message, expected] of cases) {
    assert.equal(summarizeConversionFailure(message), expected, message);
  }
});

test('아마란스 근태 시각 표기에서 확정 시각만 읽는다', () => {
  assert.deepEqual(parseAttendanceTimeText('08:58'), { hours: 8, minutes: 58 });
  assert.deepEqual(parseAttendanceTimeText(' 9:05 '), { hours: 9, minutes: 5 });
  // 지난 날짜 행은 09:56(09:56) 형태로 표시된다. 앞쪽 확정 시각을 사용한다.
  assert.deepEqual(parseAttendanceTimeText('09:56(09:56)'), { hours: 9, minutes: 56 });
  assert.deepEqual(parseAttendanceTimeText('18:00(18:58)'), { hours: 18, minutes: 0 });
  assert.deepEqual(parseAttendanceTimeText('23:59'), { hours: 23, minutes: 59 });

  assert.equal(parseAttendanceTimeText('미등록'), null);
  assert.equal(parseAttendanceTimeText(''), null);
  assert.equal(parseAttendanceTimeText(null), null);
  assert.equal(parseAttendanceTimeText(undefined), null);
  assert.equal(parseAttendanceTimeText('24:00'), null, '24시는 유효한 시각이 아니다');
  assert.equal(parseAttendanceTimeText('08:60'), null, '60분은 유효한 시각이 아니다');
});

interface FakeRow {
  badge: string | null;
  entries: Array<{ label: string; value: string }>;
}

/**
 * 근무시간 위젯을 흉내낸다.
 * readTodayCheckinTime()이 실제로 호출하는 조회만 구현한다.
 */
function createFakeWorkTimeDocument(rows: FakeRow[]): Document {
  const dateElements = rows.map((row) => {
    const entries = row.entries.map(({ label, value }) => ({
      querySelector(selector: string) {
        if (selector === 'dt') return { textContent: label };
        if (selector === 'dd') return { textContent: value };
        return null;
      },
    }));

    const rowElement = {
      querySelectorAll(selector: string) {
        return selector === '.myWork-time dl' ? entries : [];
      },
    };

    return {
      parentElement: rowElement,
      querySelector(selector: string) {
        return selector === '.badge' && row.badge !== null ? { textContent: row.badge } : null;
      },
    };
  });

  const widget = {
    querySelectorAll(selector: string) {
      return selector === '.myWork-date' ? dateElements : [];
    },
  };

  return {
    querySelector(selector: string) {
      return selector === '.myWorkTime' ? widget : null;
    },
  } as unknown as Document;
}

test('아마란스 출근 시각은 오늘 배지가 붙은 행에서만 읽는다', () => {
  // 실측 구조: 오늘 행이 먼저, 지난 날짜 행이 뒤따른다.
  const document = createFakeWorkTimeDocument([
    { badge: '오늘', entries: [{ label: '출근', value: '08:58' }, { label: '퇴근', value: '미등록' }] },
    { badge: null, entries: [{ label: '출근', value: '09:56(09:56)' }, { label: '퇴근', value: '18:00(18:58)' }] },
  ]);
  assert.deepEqual(readTodayCheckinTime(document), { hours: 8, minutes: 58 });
});

test('아마란스 출근 시각은 오늘 행이 없으면 지난 날짜로 대체하지 않는다', () => {
  // 배지 없는 행만 있을 때 첫 행을 쓰면 어제 시각을 오늘로 복사하게 된다.
  const document = createFakeWorkTimeDocument([
    { badge: null, entries: [{ label: '출근', value: '09:56(09:56)' }] },
  ]);
  assert.equal(readTodayCheckinTime(document), null);
});

test('아마란스 출근 시각은 아직 출근 전이면 없음으로 판정한다', () => {
  const document = createFakeWorkTimeDocument([
    { badge: '오늘', entries: [{ label: '출근', value: '미등록' }, { label: '퇴근', value: '미등록' }] },
  ]);
  assert.equal(readTodayCheckinTime(document), null);
});

test('아마란스 출근 시각은 퇴근 값을 출근으로 잘못 읽지 않는다', () => {
  const document = createFakeWorkTimeDocument([
    { badge: '오늘', entries: [{ label: '퇴근', value: '18:00' }] },
  ]);
  assert.equal(readTodayCheckinTime(document), null);
});

test('아마란스 출근 시각은 위젯이 없으면 만들어내지 않는다', () => {
  const emptyDocument = {
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as Document;
  assert.equal(readTodayCheckinTime(emptyDocument), null);
});

interface FakeStorageLog {
  gets: number;
  sets: number;
}

/** chrome.storage.sync의 최소 동작만 흉내낸다. */
function installFakeChromeStorage(initial: unknown): FakeStorageLog {
  const log: FakeStorageLog = { gets: 0, sets: 0 };
  let store: Record<string, unknown> = initial === undefined
    ? {}
    : { extensionSettings: initial };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      sync: {
        async get(key: string) {
          log.gets += 1;
          return key in store ? { [key]: store[key] } : {};
        },
        async set(items: Record<string, unknown>) {
          log.sets += 1;
          store = { ...store, ...items };
        },
      },
    },
  };

  return log;
}

test('설정 읽기는 저장소에 쓰지 않는다', async () => {
  // 저장된 값에 제거된 기능이 남아 있어 정규화 결과와 다른 상황.
  // 여기서 쓰기가 발생하면 storage.onChanged -> reconcile -> 다시 쓰기 순환이 생겨
  // MAX_WRITE_OPERATIONS_PER_HOUR 할당량을 소진한다.
  const log = installFakeChromeStorage({
    schemaVersion: 1,
    sites: {
      jira: {
        enabled: true,
        features: {
          issueLinkCopy: { enabled: false, options: {} },
          boardInspector: { enabled: true, options: {} },
        },
      },
    },
  });

  const first = await getSettings();
  const second = await getSettings();
  const third = await getSettings();

  assert.equal(log.sets, 0, '읽기만으로는 저장하지 않는다');
  assert.equal(log.gets, 3);
  assert.equal(first.sites.jira.features.issueLinkCopy?.enabled, false, '저장된 값을 반영한다');
  assert.equal('boardInspector' in second.sites.jira.features, false, '제거된 기능은 무시한다');
  assert.deepEqual(third, first, '정규화 결과는 결정적이다');
});

test('설정 읽기는 저장된 값이 없어도 기본값을 돌려준다', async () => {
  const log = installFakeChromeStorage(undefined);
  const settings = await getSettings();

  assert.equal(log.sets, 0);
  assert.deepEqual(settings, createDefaultSettings());
});

test('설정 저장은 명시적으로 요청할 때만 쓴다', async () => {
  const log = installFakeChromeStorage(undefined);
  await saveSettings(createDefaultSettings());

  assert.equal(log.sets, 1);
});
