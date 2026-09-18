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
          pastSprintView: {
            // 셀렉트를 열기 전에는 요청이 나가지 않는다. 켜져 있어도 네트워크를 쓰지 않는다.
            enabled: true,
            options: {},
          },
          boardSprintInfo: {
            // 읽어서 보여주기만 한다.
            enabled: true,
            options: {},
          },
          descriptionEditActions: {
            // 아래쪽 취소·저장 버튼을 대신 누를 뿐이다. 새로운 동작을 만들지 않는다.
            enabled: true,
            options: {},
          },
          descriptionMarkdownCopy: {
            // 복사는 아무것도 바꾸지 않는다.
            enabled: true,
            options: {},
          },
          editorMarkdownToAdf: {
            // 버튼이 보이기만 할 뿐 누르기 전에는 아무것도 바꾸지 않는다. 기본값을 OFF 로 두면
            // 기능이 있는 줄도 모른다. 저장은 여전히 사용자가 누른다.
            enabled: true,
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
