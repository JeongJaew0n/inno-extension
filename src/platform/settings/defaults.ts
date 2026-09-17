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
          issueModalWidth: {
            enabled: false,
            options: {},
          },
          backlogSlashTemplate: {
            enabled: true,
            options: {
              // 내장 prefix 태그는 코드에 있다. 여기에는 숨김 여부와 커스텀만 둔다.
              hiddenBuiltInTags: [],
              customTags: [],
            },
          },
          editorMarkdownToAdf: {
            // 문서를 통째로 바꾸는 동작이라 사용자가 직접 켜야 한다. Confluence 쪽과 같다.
            enabled: false,
            options: {},
          },
        },
      },
      githubEnterprise: {
        enabled: true,
        features: {
          pullRequestTitleCopy: {
            enabled: true,
            options: {},
          },
          githubCommitShaCopy: {
            enabled: true,
            options: {},
          },
        },
      },
      gitlab: {
        enabled: true,
        features: {
          mergeRequestTitleCopy: {
            enabled: true,
            options: {},
          },
          commitShaCopy: {
            enabled: true,
            options: {},
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
