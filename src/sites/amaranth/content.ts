import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createAttendanceHeaderRuntime } from './features/attendanceHeader/runtime';
import { createTitleAutofillRuntime } from './features/titleAutofill/runtime';

const runtime = createSiteRuntime({
  siteId: 'amaranth',
  features: [createAttendanceHeaderRuntime(), createTitleAutofillRuntime()],
});

void runtime.start();
