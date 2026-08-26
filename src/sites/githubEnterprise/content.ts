import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createPullRequestTitleCopyRuntime } from './features/pullRequestTitleCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'githubEnterprise',
  features: [createPullRequestTitleCopyRuntime()],
  debounceMs: 180,
});

void runtime.start();
