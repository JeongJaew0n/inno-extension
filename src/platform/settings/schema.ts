import { SITES } from '../../catalog/sites';
import type { FeatureId, SiteId } from '../../catalog/types';
import { createDefaultSettings } from './defaults';
import type { ExtensionSettingsV1, FeatureSettings } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFeatureSettings(
  candidate: unknown,
  defaults: FeatureSettings,
): FeatureSettings {
  if (!isRecord(candidate)) return defaults;

  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : defaults.enabled,
    options: isRecord(candidate.options)
      ? { ...defaults.options, ...candidate.options }
      : defaults.options,
  };
}

export function normalizeSettings(
  candidate: unknown,
  legacyOverlayEnabled?: boolean,
): ExtensionSettingsV1 {
  const defaults = createDefaultSettings();
  if (!isRecord(candidate) || !isRecord(candidate.sites)) {
    if (typeof legacyOverlayEnabled === 'boolean') {
      defaults.sites.jira.features.boardInspector!.enabled = legacyOverlayEnabled;
    }
    return defaults;
  }

  for (const site of SITES) {
    const siteId = site.id as SiteId;
    const candidateSite = candidate.sites[siteId];
    if (!isRecord(candidateSite)) continue;

    const targetSite = defaults.sites[siteId];
    if (typeof candidateSite.enabled === 'boolean') {
      targetSite.enabled = candidateSite.enabled;
    }

    if (!isRecord(candidateSite.features)) continue;
    for (const feature of site.features) {
      const featureId = feature.id as FeatureId;
      const defaultFeature = targetSite.features[featureId];
      if (!defaultFeature) continue;
      targetSite.features[featureId] = normalizeFeatureSettings(
        candidateSite.features[featureId],
        defaultFeature,
      );
    }
  }

  const candidateBoardInspector = isRecord(candidate.sites.jira)
    && isRecord(candidate.sites.jira.features)
    ? candidate.sites.jira.features.boardInspector
    : undefined;
  if (!isRecord(candidateBoardInspector) && typeof legacyOverlayEnabled === 'boolean') {
    defaults.sites.jira.features.boardInspector!.enabled = legacyOverlayEnabled;
  }

  return defaults;
}

export function isFeatureEffectivelyEnabled(
  settings: ExtensionSettingsV1,
  siteId: SiteId,
  featureId: FeatureId,
): boolean {
  return settings.sites[siteId].enabled
    && settings.sites[siteId].features[featureId]?.enabled === true;
}
