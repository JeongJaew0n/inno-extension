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
          titleAutofill: {
            enabled: true,
            options: {
              titleText: '',
            },
          },
          notificationTools: {
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
      confluence: {
        enabled: true,
        features: {
          pageMarkdownCopy: {
            enabled: true,
            options: {},
          },
          pageMarkdownAppend: {
            enabled: false,
            options: {},
          },
        },
      },
    },
  };
}
