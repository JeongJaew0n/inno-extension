import type { FeatureId, SiteId } from '../../catalog/types';
import { createDefaultSettings } from './defaults';
import { normalizeSettings } from './schema';
import type { ExtensionSettingsV1 } from './types';

export const SETTINGS_STORAGE_KEY = 'extensionSettings';

/**
 * 저장된 설정을 읽어 정규화한다.
 *
 * 정규화 결과를 다시 저장하지 않는다. 이 함수는 매 reconcile마다 호출되는데,
 * 저장하면 `chrome.storage.onChanged`가 다시 reconcile을 부르는 순환이 생긴다.
 * 저장된 값이 정규화 결과와 계속 다르면(기능 추가·삭제 직후가 그렇다) 이 순환이
 * 멈추지 않아 `MAX_WRITE_OPERATIONS_PER_HOUR` 할당량을 소진하고, 그 뒤에는 모든
 * 쓰기가 실패해 설정을 아예 읽지 못하는 상태로 굳는다.
 *
 * 정규화는 결정적이므로 저장하지 않아도 동작에 차이가 없다. 저장소에 남은 옛 키는
 * 읽을 때마다 무시되고, 사용자가 설정을 바꾸는 순간 `saveSettings()`가 정리한다.
 */
export async function getSettings(): Promise<ExtensionSettingsV1> {
  const stored = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  return normalizeSettings(stored[SETTINGS_STORAGE_KEY]);
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
