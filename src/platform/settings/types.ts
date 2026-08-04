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

export interface BoardInspectorOptions extends Record<string, unknown> {
  supportedProjectKeys: string[];
  supportedBoardIds: string[];
}
