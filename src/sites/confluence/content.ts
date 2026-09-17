import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createEditorMarkdownToAdfRuntimeForConfluence } from './features/editorMarkdownToAdf/runtime';
import { createPageMarkdownCopyRuntime } from './features/pageMarkdownCopy/runtime';

const runtime = createSiteRuntime({
  siteId: 'confluence',
  features: [
    createPageMarkdownCopyRuntime(),
    createEditorMarkdownToAdfRuntimeForConfluence(),
  ],
  debounceMs: 180,
});

void runtime.start();
