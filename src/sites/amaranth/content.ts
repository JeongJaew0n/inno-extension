import { createSiteRuntime } from '../../platform/runtime/createSiteRuntime';
import { createAttendanceHeaderRuntime } from './features/attendanceHeader/runtime';

const runtime = createSiteRuntime({
  siteId: 'amaranth',
  features: [createAttendanceHeaderRuntime()],
});

void runtime.start();
