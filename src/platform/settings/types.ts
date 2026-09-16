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

export interface JiraBacklogSlashTemplateOptions extends Record<string, unknown> {
  /** `/` 를 입력했을 때 보여줄 제목 접두사 목록. 한 줄에 하나로 편집한다. */
  templates: string[];
}
