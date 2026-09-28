import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createIssueLinkCopyRuntime } from './features/issueLinkCopy/runtime';
import { createIssueModalWidthRuntime } from './features/issueModalWidth/runtime';
import { createBacklogSlashTemplateRuntime } from './features/backlogSlashTemplate/runtime';
import { createEditorMarkdownToAdfRuntimeForJira } from './features/editorMarkdownToAdf/runtime';
import { createDescriptionEditLockRuntime } from './features/descriptionEditLock/runtime';
import { createDescriptionMarkdownCopyRuntime } from './features/descriptionMarkdownCopy/runtime';
import { createDescriptionEditActionsRuntime } from './features/descriptionEditActions/runtime';
import { createBoardSprintInfoRuntime } from './features/boardSprintInfo/runtime';
import { createPastSprintViewRuntime } from './features/pastSprintView/runtime';
import { createQuickDatesRuntime } from './features/createQuickDates/runtime';
import { createTemplateInsertRuntime } from './features/createTemplateInsert/runtime';

const runtime = createSiteRuntime({
  siteId: 'jira',
  features: [
    createIssueLinkCopyRuntime(),
    createIssueModalWidthRuntime(),
    createBacklogSlashTemplateRuntime(),
    createEditorMarkdownToAdfRuntimeForJira(),
    // Markdown 복사보다 먼저 둔다. 같은 줄에 붙을 때 이쪽이 왼쪽에 온다.
    createDescriptionEditLockRuntime(),
    createDescriptionMarkdownCopyRuntime(),
    createDescriptionEditActionsRuntime(),
    createBoardSprintInfoRuntime(),
    createPastSprintViewRuntime(),
    createQuickDatesRuntime(),
    createTemplateInsertRuntime(),
  ],
  debounceMs: 180,
});

void runtime.start();
