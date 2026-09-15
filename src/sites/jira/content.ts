import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createIssueLinkCopyRuntime } from './features/issueLinkCopy/runtime';
import { createIssueModalWidthRuntime } from './features/issueModalWidth/runtime';

const runtime = createSiteRuntime({
  siteId: 'jira',
  features: [createIssueLinkCopyRuntime(), createIssueModalWidthRuntime()],
  debounceMs: 180,
});

void runtime.start();
