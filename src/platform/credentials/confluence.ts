export const CONFLUENCE_CREDENTIALS_STORAGE_KEY = 'innoExtension.platform.credentials.confluence';

export interface ConfluenceCredentials {
  email: string;
  apiToken: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCredentials(value: unknown): ConfluenceCredentials | null {
  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyString(candidate.email) || !isNonEmptyString(candidate.apiToken)) {
    return null;
  }

  return {
    email: candidate.email.trim(),
    apiToken: candidate.apiToken.trim(),
  };
}

export async function restrictCredentialStorageAccess(): Promise<void> {
  const setAccessLevel = chrome.storage.local.setAccessLevel;
  if (!setAccessLevel) return;

  try {
    await setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch (error) {
    console.warn('[Inno Extension] storage.local access restriction failed', error);
  }
}

export async function getConfluenceCredentials(): Promise<ConfluenceCredentials | null> {
  const stored = await chrome.storage.local.get(CONFLUENCE_CREDENTIALS_STORAGE_KEY);
  return normalizeCredentials(stored[CONFLUENCE_CREDENTIALS_STORAGE_KEY]);
}

export async function saveConfluenceCredentials(credentials: ConfluenceCredentials): Promise<void> {
  await chrome.storage.local.set({
    [CONFLUENCE_CREDENTIALS_STORAGE_KEY]: {
      email: credentials.email.trim(),
      apiToken: credentials.apiToken.trim(),
    },
  });
}

export async function clearConfluenceCredentials(): Promise<void> {
  await chrome.storage.local.remove(CONFLUENCE_CREDENTIALS_STORAGE_KEY);
}
