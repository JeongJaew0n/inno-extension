import type { FeatureId, SiteId } from '../../catalog/types';

export interface FeatureSettings {
  enabled: boolean;
  options: Record<string, unknown>;
}

export interface SiteSettings {
  enabled: boolean;
  features: Partial<Record<FeatureId, FeatureSettings>>;
}

export interface ExtensionSettingsV1 {
  schemaVersion: 1;
  sites: Record<SiteId, SiteSettings>;
}

export interface AmaranthTitleAutofillOptions extends Record<string, unknown> {
  titleText: string;
}
