import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createCommitShaCopyRuntime } from './features/commitShaCopy/runtime';
import { createPullRequestTitleCopyRuntime } from './features/pullRequestTitleCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'githubEnterprise',
  features: [createPullRequestTitleCopyRuntime(), createCommitShaCopyRuntime()],
  debounceMs: 180,
});

void runtime.start();
