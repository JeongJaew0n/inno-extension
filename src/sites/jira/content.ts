import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createBoardInspectorRuntime } from './features/boardInspector/runtime';
import { createIssueLinkCopyRuntime } from './features/issueLinkCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'jira',
  features: [createIssueLinkCopyRuntime(), createBoardInspectorRuntime()],
  debounceMs: 180,
});

void runtime.start();
