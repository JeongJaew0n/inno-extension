import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createIssueLinkCopyRuntime } from './features/issueLinkCopy/runtime';
import { createIssueModalWidthRuntime } from './features/issueModalWidth/runtime';
import { createBacklogSlashTemplateRuntime } from './features/backlogSlashTemplate/runtime';

const runtime = createSiteRuntime({
  siteId: 'jira',
  features: [
    createIssueLinkCopyRuntime(),
    createIssueModalWidthRuntime(),
    createBacklogSlashTemplateRuntime(),
  ],
  debounceMs: 180,
});

void runtime.start();
