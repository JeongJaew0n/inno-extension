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
              // 기본 문구. 양식별 문구(titleTextsByForm)가 없을 때 쓴다
              titleText: '',
              titleTextsByForm: {},
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
          descriptionEditLock: {
            // 스위치만 보인다. 막힘(locked)은 기본으로 꺼져 있어 Jira 동작이 그대로다.
            enabled: true,
            options: { locked: false },
          },
          createQuickDates: {
            // 모달에 버튼 하나를 넣을 뿐이다. 누를 때만 필드를 건드린다.
            enabled: true,
            options: {},
          },
          createTemplateInsert: {
            enabled: true,
            options: {
              // 내장 템플릿은 코드에 있다. 여기에는 숨김 여부와 사용자 것만 둔다.
              hiddenBuiltInTitles: [],
              customTemplates: [],
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
          tokenPermissionPreset: {
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
