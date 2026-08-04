import type { ExtensionSettingsV1 } from './types';

export function createDefaultSettings(): ExtensionSettingsV1 {
  return {
    schemaVersion: 1,
    sites: {
      amaranth: {
        enabled: true,
        features: {
          attendanceHeader: {
            enabled: true,
            options: {},
          },
        },
      },
      jira: {
        enabled: true,
        features: {
          issueLinkCopy: {
            enabled: true,
            options: {},
          },
          boardInspector: {
            enabled: false,
            options: {
              supportedProjectKeys: ['NPT'],
              supportedBoardIds: ['2146'],
            },
          },
        },
      },
    },
  };
}
