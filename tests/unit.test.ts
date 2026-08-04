import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SITES } from '../src/catalog/sites';
import { createDefaultSettings } from '../src/platform/settings/defaults';
import { isFeatureEffectivelyEnabled, normalizeSettings } from '../src/platform/settings/schema';
import { buildIssueClipboardContent } from '../src/sites/jira/features/issueLinkCopy/clipboard';
import {
  extractIssueKeyFromHref,
  parseJiraBoardUrl,
  uniqueIssueKeys,
} from '../src/sites/jira/routes';

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
    content_scripts: Array<{ matches: string[] }>;
  };
  const manifestOrigins = manifest.content_scripts
    .flatMap((entry) => entry.matches)
    .sort();
  const catalogMatches = SITES.flatMap((site) => site.contentMatches).sort();
  assert.deepEqual(manifestOrigins, catalogMatches);
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
  assert.deepEqual(settings.sites.jira.features.boardInspector?.options, {
    supportedProjectKeys: ['NPT'],
    supportedBoardIds: ['2146'],
  });
  assert.equal(settings.sites.amaranth.features.attendanceHeader?.enabled, true);
});

test('과거 overlayEnabled 설정을 boardInspector로 이관한다', () => {
  const settings = normalizeSettings(undefined, true);
  assert.equal(settings.sites.jira.features.boardInspector?.enabled, true);
});

test('Jira board URL과 selectedIssue를 파싱한다', () => {
  assert.deepEqual(
    parseJiraBoardUrl(
      'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146?selectedIssue=npt-18',
    ),
    {
      boardId: '2146',
      projectKey: 'NPT',
      selectedIssueKey: 'NPT-18',
      viewPath: '',
      url: 'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2146?selectedIssue=npt-18',
    },
  );
  assert.equal(parseJiraBoardUrl('https://example.com/jira/software/c/projects/NPT/boards/2146'), null);
});

test('Jira issue 링크 추출과 정렬을 유지한다', () => {
  assert.equal(extractIssueKeyFromHref('/browse/NPT-25'), 'NPT-25');
  assert.equal(extractIssueKeyFromHref('https://example.com/browse/NPT-25'), null);
  assert.deepEqual(
    uniqueIssueKeys(['/browse/NPT-25', '/browse/NPT-2', '/browse/NPT-25', '/browse/NPT-8']),
    ['NPT-2', 'NPT-8', 'NPT-25'],
  );
});

test('Jira 이슈 복사는 Markdown 문자열이 아닌 브라우저 링크 payload를 만든다', () => {
  assert.deepEqual(buildIssueClipboardContent('npt-4'), {
    plainText: 'NPT-4',
    htmlText: '<a href="https://pms-innogrid.atlassian.net/browse/NPT-4">NPT-4</a>',
    issueUrl: 'https://pms-innogrid.atlassian.net/browse/NPT-4',
  });
  assert.equal(buildIssueClipboardContent('invalid'), null);
});
