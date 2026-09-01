import type { FeatureId } from '../../catalog/types';
import { getSettings, SETTINGS_STORAGE_KEY } from '../settings/repository';
import type { ExtensionSettingsV1 } from '../settings/types';
import type { SiteRuntime, SiteRuntimeOptions, SiteRuntimeStatus } from './types';
import { createUpdateScheduler } from './updateScheduler';

const GET_SITE_STATUS = 'GET_SITE_STATUS';
const RESCAN_SITE = 'RESCAN_SITE';

/**
 * 확장 context가 살아 있는지 확인한다.
 *
 * 확장을 재로드하거나 삭제하면 이미 주입된 content script는 페이지에서 제거되지 않고 계속
 * 실행되지만, 소속 context가 무효화되어 모든 `chrome.*` 호출이 실패한다. 이 스크립트는 새
 * context를 얻을 수 없으므로 되살릴 방법이 없다. 탭을 새로고침해야 새 script가 주입된다.
 *
 * 무효화된 context에서는 `chrome.runtime` 접근 자체가 던질 수 있어 try로 감싼다.
 */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
  } catch {
    return false;
  }
}

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
  let contextInvalidated = false;
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

    // 무효화된 context에서는 매 reconcile이 실패하며 로그만 쌓인다. 한 번만 알리고 멈춘다.
    if (!isExtensionContextValid()) {
      quiesce();
      return;
    }

    reconciling = true;
    try {
      try {
        settings = await getSettings();
      } catch (error) {
        // 저장소 오류로 설정을 읽지 못해도 이미 붙은 기능을 통째로 잃지 않는다.
        console.error(`[Inno Extension] ${options.siteId} 설정을 읽지 못했습니다`, error);
        if (!settings) return;
      }
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
    if (!started || contextInvalidated) return;

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

  /**
   * 확장 context가 무효화됐을 때 조용히 멈춘다.
   *
   * 이미 주입한 UI는 **제거하지 않는다.** 클립보드 복사는 `chrome.*`를 쓰지 않으므로
   * context가 죽어도 버튼은 계속 동작한다. 여기서 DOM을 걷어내면 아직 쓸 수 있는 기능까지
   * 사용자에게서 빼앗는 셈이 된다. 갱신만 멈추고 남은 것은 그대로 둔다.
   */
  function quiesce(): void {
    if (contextInvalidated) return;
    contextInvalidated = true;
    started = false;
    scheduler.cancel();
    disconnectObserver();
    window.removeEventListener('hashchange', handleNavigation);
    window.removeEventListener('popstate', handleNavigation);
    // 리스너 제거도 chrome API 호출이라 무효화된 context에서는 던진다.
    try {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
    } catch {
      // 이미 무효화된 context다. 정리할 대상도 함께 사라졌다.
    }
    console.info(
      `[Inno Extension] ${options.siteId} 확장 context가 무효화되어 갱신을 멈춥니다.`
      + ' 탭을 새로고침하면 복구됩니다.',
    );
  }

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
