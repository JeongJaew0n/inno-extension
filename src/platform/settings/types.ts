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

/**
 * prefix 태그 설정.
 *
 * 내장 태그는 코드에 있고 여기에는 **숨김 여부만** 남긴다. 통째로 저장하면 다음 릴리즈에서
 * 내장 목록을 늘려도 기존 사용자가 받지 못한다.
 */
export interface JiraPrefixTagOptions extends Record<string, unknown> {
  hiddenBuiltInTags: string[];
  customTags: Array<{ label: string; visible: boolean }>;
}
