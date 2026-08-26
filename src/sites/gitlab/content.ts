import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createCommitShaCopyRuntime } from './features/commitShaCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'gitlab',
  features: [createCommitShaCopyRuntime()],
  debounceMs: 180,
});

void runtime.start();
