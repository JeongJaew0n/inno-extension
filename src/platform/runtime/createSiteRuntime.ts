import type { FeatureId } from '../../catalog/types';
import { getSettings, SETTINGS_STORAGE_KEY } from '../settings/repository';
import type { ExtensionSettingsV1 } from '../settings/types';
import type { SiteRuntime, SiteRuntimeOptions, SiteRuntimeStatus } from './types';
import { createUpdateScheduler } from './updateScheduler';

const GET_SITE_STATUS = 'GET_SITE_STATUS';
const RESCAN_SITE = 'RESCAN_SITE';

function waitForDocumentBody(): Promise<void> {
  if (document.body) return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

export function createSiteRuntime(options: SiteRuntimeOptions): SiteRuntime {
  const debounceMs = options.debounceMs ?? 120;
  const maxWaitMs = options.maxWaitMs ?? 1000;
  let settings: ExtensionSettingsV1 | null = null;
  let observer: MutationObserver | null = null;
  let lastReconciledUrl: string | null = null;
  let started = false;
  let reconciling = false;
  let rerunRequested = false;
  let activeFeatureIds: FeatureId[] = [];

  function disconnectObserver(): void {
    observer?.disconnect();
    observer = null;
  }

  function disposeAllFeatures(): void {
    for (const feature of options.features) {
      try {
        feature.dispose();
      } catch (error) {
        console.error(`[Inno Extension] ${options.siteId}.${feature.id} 정리 실패`, error);
      }
    }
    activeFeatureIds = [];
  }

  function ensureObserver(): void {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => scheduleUpdate());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  async function reconcileNow(): Promise<void> {
    if (!started) return;
    if (reconciling) {
      rerunRequested = true;
      return;
    }

    reconciling = true;
    try {
      settings = await getSettings();
      options.onSettingsLoaded?.(settings);
      const siteSettings = settings.sites[options.siteId];
      lastReconciledUrl = window.location.href;

      if (!siteSettings.enabled) {
        disconnectObserver();
        disposeAllFeatures();
        return;
      }

      ensureObserver();
      const context = { url: new URL(lastReconciledUrl), document };
      const nextActiveFeatureIds: FeatureId[] = [];

      for (const feature of options.features) {
        const featureSettings = siteSettings.features[feature.id];
        try {
          if (featureSettings?.enabled) {
            await feature.reconcile(context, featureSettings);
            nextActiveFeatureIds.push(feature.id);
          } else {
            feature.dispose();
          }
        } catch (error) {
          console.error(`[Inno Extension] ${options.siteId}.${feature.id} 실행 실패`, error);
        }
      }

      activeFeatureIds = nextActiveFeatureIds;
    } finally {
      reconciling = false;
      if (rerunRequested) {
        rerunRequested = false;
        scheduleUpdate();
      }
    }
  }

  const scheduler = createUpdateScheduler({
    debounceMs,
    maxWaitMs,
    run: () => void reconcileNow(),
  });

  function scheduleUpdate(): void {
    if (!started) return;

    // SPA는 pushState로 이동하므로 hashchange/popstate 없이 route가 바뀔 수 있다.
    // route가 바뀐 것을 확인하면 debounce를 거치지 않고 바로 reconcile한다.
    if (lastReconciledUrl !== null && window.location.href !== lastReconciledUrl) {
      reconcileImmediately();
      return;
    }

    scheduler.schedule();
  }

  function reconcileImmediately(): void {
    if (!started) return;
    scheduler.runNow();
  }

  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName === 'sync' && changes[SETTINGS_STORAGE_KEY]) {
      scheduleUpdate();
    }
  };

  const handleNavigation = (): void => reconcileImmediately();

  const handleMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return false;

    if (message.type === GET_SITE_STATUS) {
      sendResponse(runtime.getStatus());
      return false;
    }

    if (message.type === RESCAN_SITE) {
      scheduleUpdate();
      sendResponse({ ok: true });
      return false;
    }

    return false;
  };

  const runtime: SiteRuntime = {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      await waitForDocumentBody();
      chrome.storage.onChanged.addListener(handleStorageChange);
      chrome.runtime.onMessage.addListener(handleMessage);
      window.addEventListener('hashchange', handleNavigation);
      window.addEventListener('popstate', handleNavigation);
      await reconcileNow();
    },

    stop(): void {
      started = false;
      scheduler.cancel();
      disconnectObserver();
      disposeAllFeatures();
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
      window.removeEventListener('hashchange', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    },

    rescan(): void {
      scheduleUpdate();
    },

    getStatus(): SiteRuntimeStatus {
      return {
        siteId: options.siteId,
        siteEnabled: settings?.sites[options.siteId].enabled ?? false,
        activeFeatureIds: [...activeFeatureIds],
        url: window.location.href,
      };
    },
  };

  return runtime;
}
