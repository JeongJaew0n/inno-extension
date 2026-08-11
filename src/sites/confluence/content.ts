import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createPageMarkdownCopyRuntime } from './features/pageMarkdownCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'confluence',
  features: [createPageMarkdownCopyRuntime()],
  debounceMs: 180,
});

void runtime.start();
