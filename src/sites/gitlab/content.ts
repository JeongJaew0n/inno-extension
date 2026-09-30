import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createCommitShaCopyRuntime } from './features/commitShaCopy/runtime';
import { createMergeRequestTitleCopyRuntime } from './features/mergeRequestTitleCopy/runtime';
import { createTokenPermissionPresetRuntime } from './features/tokenPermissionPreset/runtime';

const runtime = createSiteRuntime({
  siteId: 'gitlab',
  features: [
    createMergeRequestTitleCopyRuntime(),
    createCommitShaCopyRuntime(),
    createTokenPermissionPresetRuntime(),
  ],
  debounceMs: 180,
});

void runtime.start();
