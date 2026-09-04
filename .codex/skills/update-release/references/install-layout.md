# 설치 레이아웃과 경로를 지켜야 하는 이유

## 왜 수동 갱신인가

이 확장은 Chrome 웹 스토어에 올리지 않는다. 사용자는 릴리즈 ZIP을 내려받아 **압축해제된 확장
프로그램**으로 로드한다. 스토어 배포가 아니므로 Chrome이 자동 갱신하지 않는다.

## 경로를 바꾸면 설정이 사라진다

`manifest.json`에는 `key` 필드가 **없다.**

```bash
$ node -p "Object.keys(require('./manifest.json'))"
[ 'manifest_version', 'name', 'version', 'description',
  'icons', 'permissions', 'action', 'content_scripts' ]
```

`key`가 없는 압축해제 확장의 ID는 **설치 폴더의 절대 경로에서 파생된다.** 경로가 바뀌면 ID가
바뀐다.

```mermaid
flowchart LR
    P["설치 폴더 절대 경로"] --> I["확장 ID"]
    I --> S["chrome.storage.sync 저장 영역"]
```

이 확장의 설정은 `chrome.storage.sync`에 저장한다. ID가 바뀌면 **다른 확장으로 취급되어 기존
설정을 읽지 못한다.** 사용자는 기능 ON/OFF 설정을 처음부터 다시 해야 한다.

그래서 갱신은 반드시 **같은 폴더에 내용만 덮어쓰는** 방식이어야 한다. 새 폴더에 풀고 Chrome에서
다시 로드하게 하면 안 된다.

## 폴더를 지웠다 다시 만들지 않는다

`rm -rf "$INSTALL_DIR" && mkdir "$INSTALL_DIR"`는 경로 문자열은 같지만 새 디렉터리다. Chrome이
열어둔 핸들이 무효가 되어 확장을 잃을 수 있다.

내용만 비운다.

```bash
find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
```

## ZIP 구조

릴리즈 ZIP의 최상위에는 감싸는 폴더가 없다.

```
manifest.json
assets/
icons/
src/
```

따라서 `unzip -d "$INSTALL_DIR"`이 곧바로 올바른 배치를 만든다. 중간 폴더가 생기면 자산이
잘못된 것이므로 중단한다.

## 소스 설치와 구분한다

저장소를 클론해 `npm run build`로 만든 `dist/`를 로드한 사용자도 있다. 이 경우:

- `dist/`는 `.gitignore` 대상이고 빌드가 다시 만든다.
- ZIP으로 덮어쓰면 다음 빌드가 되돌린다. 갱신 수단이 아니다.

`INSTALL_DIR`이 저장소 안의 `dist/`이면 덮어쓰지 말고 `git pull && npm run build`를 안내한다.

## 확장 재로드는 자동화할 수 없다

`chrome://extensions`는 브라우저 자동화가 접근을 차단한다.

```
Can't interact with browser-internal or unparseable URLs.
```

파일 교체까지가 스킬의 범위다. 재로드는 사용자가 눌러야 한다.

## 재로드 후 탭 새로고침이 필요한 이유

파일을 덮어쓰면 기존 탭에 주입돼 있던 content script의 `chrome.runtime` context가 무효화된다.
이 확장은 그 상태를 감지해 조용히 멈춘다(`isExtensionContextValid()`). 버튼이 사라진 것처럼
보이지만 오류는 아니다. **탭을 새로고침해야 새 코드가 주입된다.**

관련 기록: `docs/issue/2026-09-01-stale-content-script-console-error.md`
