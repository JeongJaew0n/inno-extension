import type { FeatureId, SiteId } from '../../catalog/types';
import { createDefaultSettings } from './defaults';
import { normalizeSettings } from './schema';
import type { ExtensionSettingsV1 } from './types';

export const SETTINGS_STORAGE_KEY = 'extensionSettings';

export async function getSettings(): Promise<ExtensionSettingsV1> {
  const stored = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  const settings = normalizeSettings(stored[SETTINGS_STORAGE_KEY]);

  if (JSON.stringify(stored[SETTINGS_STORAGE_KEY]) !== JSON.stringify(settings)) {
    await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
  }

  return settings;
}

export async function saveSettings(settings: ExtensionSettingsV1): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: normalizeSettings(settings) });
}

export async function setSiteEnabled(siteId: SiteId, enabled: boolean): Promise<void> {
  const settings = await getSettings();
  settings.sites[siteId].enabled = enabled;
  await saveSettings(settings);
}

export async function setFeatureEnabled(
  siteId: SiteId,
  featureId: FeatureId,
  enabled: boolean,
): Promise<void> {
  const settings = await getSettings();
  const feature = settings.sites[siteId].features[featureId];
  if (!feature) throw new Error(`설정이 없는 기능입니다: ${siteId}.${featureId}`);
  feature.enabled = enabled;
  await saveSettings(settings);
}

export async function setFeatureOptions(
  siteId: SiteId,
  featureId: FeatureId,
  options: Record<string, unknown>,
): Promise<void> {
  const settings = await getSettings();
  const feature = settings.sites[siteId].features[featureId];
  if (!feature) throw new Error(`설정이 없는 기능입니다: ${siteId}.${featureId}`);
  feature.options = { ...feature.options, ...options };
  await saveSettings(settings);
}

export async function resetFeatureSettings(
  siteId: SiteId,
  featureId: FeatureId,
): Promise<void> {
  const settings = await getSettings();
  const defaults = createDefaultSettings();
  const defaultFeature = defaults.sites[siteId].features[featureId];
  if (!defaultFeature) throw new Error(`기본 설정이 없는 기능입니다: ${siteId}.${featureId}`);
  settings.sites[siteId].features[featureId] = defaultFeature;
  await saveSettings(settings);
}

export async function resetAllSettings(): Promise<void> {
  await saveSettings(createDefaultSettings());
}
