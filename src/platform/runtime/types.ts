import type { FeatureId, SiteId } from '../../catalog/types';
import type { ExtensionSettingsV1, FeatureSettings } from '../settings/types';

export interface PageContext {
  url: URL;
  document: Document;
}

export interface FeatureRuntime {
  readonly id: FeatureId;
  reconcile(context: PageContext, settings: FeatureSettings): void | Promise<void>;
  dispose(): void;
}

export interface SiteRuntimeStatus {
  siteId: SiteId;
  siteEnabled: boolean;
  activeFeatureIds: FeatureId[];
  url: string;
}

export interface SiteRuntime {
  start(): Promise<void>;
  stop(): void;
  rescan(): void;
  getStatus(): SiteRuntimeStatus;
}

export interface SiteRuntimeOptions {
  siteId: SiteId;
  features: readonly FeatureRuntime[];
  debounceMs?: number;
  maxWaitMs?: number;
  onSettingsLoaded?: (settings: ExtensionSettingsV1) => void;
}
