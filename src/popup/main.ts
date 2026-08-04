import { findFeatureDescriptor, findSiteDescriptor, SITES } from '../catalog/sites';
import { FEATURE_IDS, SITE_IDS, type FeatureId, type SiteId } from '../catalog/types';
import { createDefaultSettings } from '../platform/settings/defaults';
import {
  getSettings,
  resetAllSettings,
  resetFeatureSettings,
  SETTINGS_STORAGE_KEY,
  setFeatureEnabled,
  setFeatureOptions,
  setSiteEnabled,
} from '../platform/settings/repository';
import type { ExtensionSettingsV1 } from '../platform/settings/types';
import { featureRoute, parsePopupRoute, siteRoute, type PopupRoute } from './router';

const appElement = document.querySelector<HTMLElement>('#app');
if (!appElement) throw new Error('Popup root를 찾을 수 없습니다.');
const app: HTMLElement = appElement;

let settings: ExtensionSettingsV1 = createDefaultSettings();

const SITE_ICON_URLS: Record<SiteId, string> = {
  amaranth: new URL('./assets/amaranth-favicon.png', import.meta.url).href,
  jira: new URL('./assets/jira-favicon.png', import.meta.url).href,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSiteId(value: string | undefined): value is SiteId {
  return value !== undefined && SITE_IDS.some((siteId) => siteId === value);
}

function isFeatureId(value: string | undefined): value is FeatureId {
  return value !== undefined && FEATURE_IDS.some((featureId) => featureId === value);
}

function renderToggle(
  checked: boolean,
  label: string,
  attributes: string,
  disabled = false,
): string {
  return `
    <label class="switch" title="${escapeHtml(label)}">
      <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${attributes} aria-label="${escapeHtml(label)}" />
      <span class="switch-track" aria-hidden="true"></span>
    </label>
  `;
}

function renderTabs(active: 'features' | 'settings'): string {
  return `
    <nav class="tabs" aria-label="Popup 메뉴">
      <button type="button" class="tab ${active === 'features' ? 'is-active' : ''}" data-route="#/">편의기능</button>
      <button type="button" class="tab ${active === 'settings' ? 'is-active' : ''}" data-route="#/settings">설정</button>
    </nav>
  `;
}

function renderSiteList(): string {
  const cards = SITES.map((site) => {
    const siteSettings = settings.sites[site.id];
    const enabledCount = site.features.filter(
      (feature) => siteSettings.features[feature.id]?.enabled === true,
    ).length;

    return `
      <article class="site-card ${siteSettings.enabled ? '' : 'is-disabled'}" style="--site-color:${site.color}">
        <button type="button" class="card-body" data-route="${siteRoute(site.id)}">
          <span class="site-icon" aria-hidden="true">
            <img class="site-icon-image" src="${SITE_ICON_URLS[site.id]}" alt="" width="32" height="32" />
          </span>
          <span class="card-copy">
            <strong>${escapeHtml(site.name)}</strong>
            <span class="host-row">
              ${escapeHtml(site.hostLabel)}
              <span class="external-symbol" aria-hidden="true">↗</span>
            </span>
          </span>
        </button>
        <button type="button" class="site-open-button" data-open-origin="${site.origin}" aria-label="${escapeHtml(site.name)} 열기">↗</button>
        <span class="feature-count">${enabledCount}/${site.features.length}</span>
        ${renderToggle(
          siteSettings.enabled,
          `${site.name} 전체 기능`,
          `data-site-toggle data-site-id="${site.id}"`,
        )}
        <button type="button" class="icon-button" data-route="${siteRoute(site.id)}" aria-label="${escapeHtml(site.name)} 상세">›</button>
      </article>
    `;
  }).join('');

  return `
    <header class="brand-header"><h1>Inno Extension</h1></header>
    ${renderTabs('features')}
    <section class="page-content site-list" aria-label="사이트별 편의기능">${cards}</section>
  `;
}

function renderPageHeader(title: string, backRoute: string): string {
  return `
    <header class="page-header">
      <button type="button" class="back-button" data-route="${backRoute}" aria-label="뒤로">‹</button>
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

function renderSiteDetail(siteId: SiteId): string {
  const site = findSiteDescriptor(siteId);
  const siteSettings = settings.sites[siteId];
  const featureCards = site.features.map((feature) => {
    const featureSettings = siteSettings.features[feature.id];
    const route = featureRoute(siteId, feature.id);
    return `
      <article class="feature-card ${siteSettings.enabled ? '' : 'is-site-disabled'}">
        <button type="button" class="feature-body" data-route="${route}">
          <strong>${escapeHtml(feature.name)}</strong>
          <span>${escapeHtml(feature.description)}</span>
          <small>적용 범위: <code>${escapeHtml(feature.routeSummary)}</code></small>
        </button>
        ${renderToggle(
          featureSettings?.enabled === true,
          feature.name,
          `data-feature-toggle data-site-id="${siteId}" data-feature-id="${feature.id}"`,
        )}
        <button type="button" class="icon-button" data-route="${route}" aria-label="${escapeHtml(feature.name)} 상세">›</button>
      </article>
    `;
  }).join('');

  return `
    ${renderPageHeader(site.name, '#/')}
    <section class="page-content">
      <div class="section-heading">
        <span>기능 목록</span>
        ${renderToggle(
          siteSettings.enabled,
          `${site.name} 전체 기능`,
          `data-site-toggle data-site-id="${siteId}"`,
        )}
      </div>
      ${siteSettings.enabled ? '' : '<p class="notice">사이트 전체 기능이 꺼져 있습니다. 하위 설정은 그대로 보존됩니다.</p>'}
      <div class="feature-list">${featureCards}</div>
    </section>
  `;
}

function renderFeatureOptions(siteId: SiteId, featureId: FeatureId): string {
  if (siteId !== 'jira' || featureId !== 'boardInspector') {
    return '<p class="empty-options">이 기능에는 별도의 추가 옵션이 없습니다.</p>';
  }

  const options = settings.sites.jira.features.boardInspector?.options ?? {};
  const projectKeys = Array.isArray(options.supportedProjectKeys)
    ? options.supportedProjectKeys.filter((value): value is string => typeof value === 'string')
    : [];
  const boardIds = Array.isArray(options.supportedBoardIds)
    ? options.supportedBoardIds.filter((value): value is string => typeof value === 'string')
    : [];

  return `
    <div class="option-fields" data-options-form data-site-id="jira" data-feature-id="boardInspector">
      <label>
        <span>프로젝트 키</span>
        <input type="text" data-option="supportedProjectKeys" value="${escapeHtml(projectKeys.join(', '))}" placeholder="NPT" />
        <small>쉼표로 여러 값을 구분합니다.</small>
      </label>
      <label>
        <span>보드 ID</span>
        <input type="text" data-option="supportedBoardIds" value="${escapeHtml(boardIds.join(', '))}" placeholder="2146" />
        <small>Jira 보드 URL의 숫자 ID입니다.</small>
      </label>
    </div>
  `;
}

function renderFeatureDetail(siteId: SiteId, featureId: FeatureId): string {
  const site = findSiteDescriptor(siteId);
  const feature = findFeatureDescriptor(siteId, featureId);
  const featureSettings = settings.sites[siteId].features[featureId];

  return `
    ${renderPageHeader(feature.name, siteRoute(siteId))}
    <section class="page-content feature-detail">
      <div class="detail-summary">
        <div>
          <span class="eyebrow">${escapeHtml(site.name)}</span>
          <p>${escapeHtml(feature.description)}</p>
        </div>
        ${renderToggle(
          featureSettings?.enabled === true,
          feature.name,
          `data-feature-toggle data-site-id="${siteId}" data-feature-id="${featureId}"`,
        )}
      </div>
      <div class="route-box">
        <span>적용 범위</span>
        <code>${escapeHtml(feature.routeSummary)}</code>
      </div>
      <section class="settings-card">
        <h2>상세 설정</h2>
        ${renderFeatureOptions(siteId, featureId)}
      </section>
      <button type="button" class="secondary-button" data-reset-feature data-site-id="${siteId}" data-feature-id="${featureId}">이 기능을 기본값으로 초기화</button>
    </section>
  `;
}

function renderGeneralSettings(): string {
  const manifest = chrome.runtime.getManifest();
  return `
    <header class="brand-header"><h1>Inno Extension</h1></header>
    ${renderTabs('settings')}
    <section class="page-content settings-page">
      <div class="settings-card">
        <h2>확장 프로그램 정보</h2>
        <dl>
          <div><dt>버전</dt><dd>${escapeHtml(manifest.version)}</dd></div>
          <div><dt>지원 사이트</dt><dd>${SITES.length}개</dd></div>
          <div><dt>등록 기능</dt><dd>${SITES.reduce((count, site) => count + site.features.length, 0)}개</dd></div>
        </dl>
      </div>
      <div class="settings-card danger-zone">
        <h2>설정 초기화</h2>
        <p>사이트와 기능 설정을 설치 기본값으로 되돌립니다.</p>
        <button type="button" class="secondary-button" data-reset-all>전체 설정 초기화</button>
      </div>
    </section>
  `;
}

function renderRoute(route: PopupRoute): string {
  if (route.page === 'settings') return renderGeneralSettings();
  if (route.page === 'site') return renderSiteDetail(route.siteId);
  if (route.page === 'feature') return renderFeatureDetail(route.siteId, route.featureId);
  return renderSiteList();
}

async function render(): Promise<void> {
  settings = await getSettings();
  app.innerHTML = renderRoute(parsePopupRoute(window.location.hash));
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

app.addEventListener('click', async (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-route], [data-open-origin], [data-reset-feature], [data-reset-all]')
    : null;
  if (!target) return;

  if (target.dataset.openOrigin) {
    await chrome.tabs.create({ url: target.dataset.openOrigin });
    return;
  }

  if (target.dataset.route) {
    window.location.hash = target.dataset.route.replace(/^#/, '');
    return;
  }

  if (target.hasAttribute('data-reset-all')) {
    await resetAllSettings();
    await render();
    return;
  }

  const { siteId, featureId } = target.dataset;
  if (target.hasAttribute('data-reset-feature') && isSiteId(siteId) && isFeatureId(featureId)) {
    await resetFeatureSettings(siteId, featureId);
    await render();
  }
});

app.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.hasAttribute('data-site-toggle') && isSiteId(target.dataset.siteId)) {
    await setSiteEnabled(target.dataset.siteId, target.checked);
    await render();
    return;
  }

  if (target.hasAttribute('data-feature-toggle')
    && isSiteId(target.dataset.siteId)
    && isFeatureId(target.dataset.featureId)) {
    await setFeatureEnabled(target.dataset.siteId, target.dataset.featureId, target.checked);
    await render();
    return;
  }

  const form = target.closest<HTMLElement>('[data-options-form]');
  if (!form || !isSiteId(form.dataset.siteId) || !isFeatureId(form.dataset.featureId)) return;
  const optionInputs = form.querySelectorAll<HTMLInputElement>('[data-option]');
  const options: Record<string, unknown> = {};
  for (const optionInput of optionInputs) {
    if (optionInput.dataset.option) options[optionInput.dataset.option] = parseList(optionInput.value);
  }
  await setFeatureOptions(form.dataset.siteId, form.dataset.featureId, options);
});

window.addEventListener('hashchange', () => void render());
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[SETTINGS_STORAGE_KEY]) void render();
});

void render();
