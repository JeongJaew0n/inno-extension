import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createIssueLinkCopyRuntime } from './features/issueLinkCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'jira',
  features: [createIssueLinkCopyRuntime()],
  debounceMs: 180,
});

void runtime.start();
