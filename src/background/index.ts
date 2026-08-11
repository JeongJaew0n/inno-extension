import { getSettings } from '../platform/settings/repository';
import {
  clearConfluenceCredentials,
  type ConfluenceCredentials,
  getConfluenceCredentials,
  restrictCredentialStorageAccess,
  saveConfluenceCredentials,
} from '../platform/credentials/confluence';
import {
  CONFLUENCE_CLEAR_CREDENTIALS,
  CONFLUENCE_FETCH_PAGE,
  CONFLUENCE_GET_CREDENTIALS,
  CONFLUENCE_SAVE_CREDENTIALS,
  CONFLUENCE_UPDATE_PAGE,
  type ConfluenceBackgroundRequest,
  type ConfluenceBackgroundResponse,
  type ConfluenceCredentialSummary,
  type ConfluencePageAdfDocument,
  type ConfluenceUpdatedPage,
} from '../platform/messages/confluence';
import {
  fetchConfluencePageAdf,
  toConfluenceErrorPayload,
  updateConfluencePageAdf,
} from '../sites/confluence/api/client';
import {
  CONFLUENCE_ORIGIN,
  isSameConfluencePage,
} from '../sites/confluence/routes';

const EXTENSION_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isCredentialsPayload(value: unknown): value is { email: string; apiToken: string } {
  return isObject(value) && isString(value.email) && isString(value.apiToken);
}

function isFetchPayload(value: unknown): value is { pageIdOrUrl: string } {
  return isObject(value) && isString(value.pageIdOrUrl);
}

function isUpdatePayload(
  value: unknown,
): value is {
  pageId: string;
  pageUrl: string;
  tabId: number;
  title: string;
  status: string;
  currentVersion: number;
  adf: unknown;
} {
  return (
    isObject(value) &&
    isString(value.pageId) &&
    isString(value.pageUrl) &&
    typeof value.tabId === 'number' &&
    Number.isInteger(value.tabId) &&
    value.tabId >= 0 &&
    isString(value.title) &&
    isString(value.status) &&
    typeof value.currentVersion === 'number' &&
    'adf' in value
  );
}

async function getSenderPageUrl(
  sender: chrome.runtime.MessageSender,
  tabId: number,
): Promise<string | null> {
  if (!isTrustedExtensionSender(sender)) {
    if (sender.tab?.id !== tabId) return null;
    return sender.tab?.url ?? sender.url ?? null;
  }

  try {
    return (await chrome.tabs.get(tabId)).url ?? null;
  } catch {
    return null;
  }
}

async function isMatchingUpdateContext(
  sender: chrome.runtime.MessageSender,
  payload: { pageId: string; pageUrl: string; tabId: number },
): Promise<boolean> {
  if (!isSameConfluencePage(payload.pageUrl, payload.pageId)) return false;
  const senderPageUrl = await getSenderPageUrl(sender, payload.tabId);
  return senderPageUrl !== null && isSameConfluencePage(senderPageUrl, payload.pageId);
}

function isConfluenceRequest(message: unknown): message is ConfluenceBackgroundRequest {
  if (!isObject(message) || !isString(message.type)) return false;

  switch (message.type) {
    case CONFLUENCE_GET_CREDENTIALS:
    case CONFLUENCE_CLEAR_CREDENTIALS:
      return true;
    case CONFLUENCE_SAVE_CREDENTIALS:
      return isCredentialsPayload(message.payload);
    case CONFLUENCE_FETCH_PAGE:
      return isFetchPayload(message.payload);
    case CONFLUENCE_UPDATE_PAGE:
      return isUpdatePayload(message.payload);
    default:
      return false;
  }
}

function isTrustedExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(EXTENSION_ORIGIN);
}

function isAllowedConfluenceSender(sender: chrome.runtime.MessageSender): boolean {
  if (isTrustedExtensionSender(sender)) return true;
  if (sender.id !== chrome.runtime.id) return false;

  const candidates = [sender.origin, sender.url, sender.tab?.url];
  return candidates.some((value) => (
    typeof value === 'string'
    && (value === CONFLUENCE_ORIGIN || value.startsWith(`${CONFLUENCE_ORIGIN}/`))
  ));
}

function unauthorizedResponse<T>(
  code: 'invalid_origin' | 'untrusted_sender',
  message: string,
): ConfluenceBackgroundResponse<T> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

async function requireCredentials() {
  const credentials = await getConfluenceCredentials();
  if (!credentials) {
    throw new Error('Confluence 인증 정보가 저장되어 있지 않습니다.');
  }
  return credentials;
}

async function mergeCredentials(payload: {
  email: string;
  apiToken: string;
}): Promise<ConfluenceCredentials> {
  const existing = await getConfluenceCredentials();
  const email = payload.email.trim() || existing?.email || '';
  const apiToken = payload.apiToken.trim() || existing?.apiToken || '';

  if (!email || !apiToken) {
    throw new Error('Confluence 이메일과 API 토큰이 모두 필요합니다.');
  }

  return { email, apiToken };
}

function toCredentialSummary(
  credentials: Awaited<ReturnType<typeof getConfluenceCredentials>>,
): ConfluenceCredentialSummary {
  return {
    email: credentials?.email ?? '',
    hasApiToken: Boolean(credentials?.apiToken),
  };
}

async function handleConfluenceMessage(
  message: ConfluenceBackgroundRequest,
  sender: chrome.runtime.MessageSender,
): Promise<
  ConfluenceBackgroundResponse<
    ConfluenceCredentialSummary | ConfluencePageAdfDocument | ConfluenceUpdatedPage | { cleared: true }
  >
> {
  try {
    switch (message.type) {
      case CONFLUENCE_GET_CREDENTIALS: {
        if (!isTrustedExtensionSender(sender)) {
          return unauthorizedResponse('untrusted_sender', '인증 정보는 확장 프로그램 UI에서만 접근할 수 있습니다.');
        }

        return { ok: true, data: toCredentialSummary(await getConfluenceCredentials()) };
      }

      case CONFLUENCE_SAVE_CREDENTIALS: {
        if (!isTrustedExtensionSender(sender)) {
          return unauthorizedResponse('untrusted_sender', '인증 정보는 확장 프로그램 UI에서만 저장할 수 있습니다.');
        }

        await saveConfluenceCredentials(await mergeCredentials(message.payload));
        return { ok: true, data: toCredentialSummary(await getConfluenceCredentials()) };
      }

      case CONFLUENCE_CLEAR_CREDENTIALS: {
        if (!isTrustedExtensionSender(sender)) {
          return unauthorizedResponse('untrusted_sender', '인증 정보는 확장 프로그램 UI에서만 삭제할 수 있습니다.');
        }

        await clearConfluenceCredentials();
        return { ok: true, data: { cleared: true } };
      }

      case CONFLUENCE_FETCH_PAGE: {
        if (!isAllowedConfluenceSender(sender)) {
          return unauthorizedResponse('invalid_origin', '허용되지 않은 Confluence 컨텍스트입니다.');
        }

        const credentials = await requireCredentials();
        return {
          ok: true,
          data: await fetchConfluencePageAdf(credentials, message.payload.pageIdOrUrl),
        };
      }

      case CONFLUENCE_UPDATE_PAGE: {
        if (!isAllowedConfluenceSender(sender)) {
          return unauthorizedResponse('invalid_origin', '허용되지 않은 Confluence 컨텍스트입니다.');
        }
        if (!await isMatchingUpdateContext(sender, message.payload)) {
          return unauthorizedResponse(
            'invalid_origin',
            '현재 탭의 Confluence 문서와 업데이트 대상이 일치하지 않습니다.',
          );
        }

        const credentials = await requireCredentials();
        return {
          ok: true,
          data: await updateConfluencePageAdf(credentials, {
            pageId: message.payload.pageId,
            title: message.payload.title,
            status: message.payload.status,
            currentVersion: message.payload.currentVersion,
            adf: message.payload.adf,
          }),
        };
      }
    }
  } catch (error) {
    const normalized = toConfluenceErrorPayload(error);
    if (normalized.message === 'Confluence 인증 정보가 저장되어 있지 않습니다.') {
      normalized.code = 'missing_credentials';
    }

    return {
      ok: false,
      error: normalized,
    };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void getSettings();
  void restrictCredentialStorageAccess();
});

chrome.runtime.onStartup.addListener(() => {
  void restrictCredentialStorageAccess();
});

void restrictCredentialStorageAccess();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isConfluenceRequest(message)) return false;

  void handleConfluenceMessage(message, sender).then(sendResponse);
  return true;
});
