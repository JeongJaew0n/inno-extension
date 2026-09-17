import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createIssueLinkCopyRuntime } from './features/issueLinkCopy/runtime';
import { createIssueModalWidthRuntime } from './features/issueModalWidth/runtime';
import { createBacklogSlashTemplateRuntime } from './features/backlogSlashTemplate/runtime';
import { createEditorMarkdownToAdfRuntimeForJira } from './features/editorMarkdownToAdf/runtime';
import { createDescriptionMarkdownCopyRuntime } from './features/descriptionMarkdownCopy/runtime';
import { createDescriptionEditActionsRuntime } from './features/descriptionEditActions/runtime';

const runtime = createSiteRuntime({
  siteId: 'jira',
  features: [
    createIssueLinkCopyRuntime(),
    createIssueModalWidthRuntime(),
    createBacklogSlashTemplateRuntime(),
    createEditorMarkdownToAdfRuntimeForJira(),
    createDescriptionMarkdownCopyRuntime(),
    createDescriptionEditActionsRuntime(),
  ],
  debounceMs: 180,
});

void runtime.start();
