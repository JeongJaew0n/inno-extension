import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createAttendanceHeaderRuntime } from './features/attendanceHeader/runtime';
import { createNotificationToolsRuntime } from './features/notificationTools/runtime';
import { createTitleAutofillRuntime } from './features/titleAutofill/runtime';

const runtime = createSiteRuntime({
  siteId: 'amaranth',
  features: [
    createAttendanceHeaderRuntime(),
    createTitleAutofillRuntime(),
    createNotificationToolsRuntime(),
  ],
});

void runtime.start();
