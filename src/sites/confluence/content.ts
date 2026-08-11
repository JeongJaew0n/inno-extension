import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createEditorMarkdownToAdfRuntime } from './features/editorMarkdownToAdf/runtime';
import { createPageMarkdownCopyRuntime } from './features/pageMarkdownCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'confluence',
  features: [
    createPageMarkdownCopyRuntime(),
    createEditorMarkdownToAdfRuntime(),
  ],
  debounceMs: 180,
});

void runtime.start();
