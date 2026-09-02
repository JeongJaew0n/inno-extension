import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createCommitShaCopyRuntime } from './features/commitShaCopy/runtime';
import { createMergeRequestTitleCopyRuntime } from './features/mergeRequestTitleCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'gitlab',
  features: [createMergeRequestTitleCopyRuntime(), createCommitShaCopyRuntime()],
  debounceMs: 180,
});

void runtime.start();
