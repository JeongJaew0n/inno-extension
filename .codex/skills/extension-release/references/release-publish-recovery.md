# GitHub Release 발행 실패와 복구

GitHub Release 발행 경로가 CLI에서 Chrome으로 전환되거나 파일 업로드가 실패할 때 적용한다.

## 2026-08-14 실제 실패 기록

`v0.3.0` 릴리즈에서 다음 문제가 연속으로 발생했다.

1. `gh auth status`에서 GitHub.com 토큰 만료를 뒤늦게 확인했다.
2. HTTPS `git push`가 자격 증명을 읽지 못했지만 SSH push fallback은 정상 동작했다.
3. Chrome의 `fileChooser.setFiles()`가 `Not allowed`로 실패했다.
4. Browser가 작성한 form을 Computer Use로 이어서 조작하면서 Release 탭과 사용자의 다른 탭 사이에 포커스가 이동했다.
5. Computer Use의 element index가 화면 갱신 직후 stale 상태가 됐고, 여러 입력을 한 번에 처리하려다 다음 입력이 다른 탭에 적용될 위험이 생겼다.
6. `Tab.markHandoff()`는 현재 runtime 객체에 존재하지 않았다. 탭 보존은 `browser.tabs.finalize({ keep: [{ tab, status: "handoff" }] })` 계약을 사용해야 했다.

결과적으로 commit과 tag push는 완료됐지만 GitHub Release 공개 발행이 별도 재개 단계로 남았다.

## 재발 방지 결정

### 인증을 처음에 판정

다른 호스트 결과와 섞이지 않도록 다음 명령을 단독 실행한다.

```bash
gh auth status --hostname github.com
```

- 성공: `gh release create` 경로를 사용한다.
- 실패: 버전 변경 전에 Chrome 로그인과 UI 제어 가능 여부를 확인하고 browser 경로를 선택한다.

HTTPS push 인증 실패는 원격 URL을 변경하지 않고 SSH URL로 한 번만 fallback한다.

```bash
git push git@github.com:JeongJaew0n/inno-extension.git develop
git push git@github.com:JeongJaew0n/inno-extension.git v<version>
```

### 파일 업로드 surface를 중간에 바꾸지 않기

현재 Chrome backend에서 `fileChooser.setFiles()`의 `Not allowed`가 재현되면 같은 호출을 반복하지 않는다.

선택지는 다음 순서다.

1. 처음부터 Computer Use의 새 Chrome 탭에서 Release form 작성, ZIP 업로드, 발행을 모두 수행한다.
2. Browser로 form을 이미 작성했다면 먼저 `Save draft`로 안정적인 draft URL을 확보한 뒤 Computer Use가 그 URL을 연다.
3. in-memory form과 탭 포커스에 의존한 채 Browser에서 Computer Use로 직접 넘기지 않는다.

Browser 탭을 보존해야 한다면 다음 finalize 형식을 사용한다.

```js
await browser.tabs.finalize({
  keep: [{ tab: releaseTab, status: "handoff" }],
});
```

`releaseTab.markHandoff()`의 존재를 가정하지 않는다.

### Computer Use 저위험 순서

1. `get_app_state({ app: "com.google.Chrome", disableDiff: true })`로 현재 URL과 선택 탭을 확인한다.
2. 기존 사용자 탭 대신 `super+t`로 새 탭을 만든다.
3. 주소창에 Release URL을 넣고 주소창을 클릭한 뒤 `Return`으로 이동한다.
4. 최신 state에서 제목 input index를 얻어 제목만 입력한다.
5. state를 다시 읽고 본문 input index를 얻어 본문만 입력한다.
6. state를 다시 읽고 ZIP 업로드 버튼을 클릭한다.
7. macOS 파일 선택창에서 `super+shift+g`를 누르고 ZIP 절대 경로를 입력한다.
8. 파일 선택 후 업로드 행의 파일명과 크기, 완료 상태를 확인한다.
9. 최신 state에서 `Publish release`를 클릭한다.

한 state에서 얻은 element index로 여러 변경을 연속 실행하지 않는다. 각 변경 사이에 state를 새로 읽는다.

### 포커스 경합 중단 조건

다음 중 하나가 두 번 발생하면 자동 조작을 중단한다.

- 선택 탭이 Release 페이지에서 다른 페이지로 바뀜
- `The user changed '/Applications/Google Chrome.app'` 응답
- element index stale 오류
- 입력 대상이 예상 URL과 다른 탭으로 이동

사용자에게 Chrome 조작을 잠시 멈춰 달라고 요청하고, 확인을 받은 다음 Release 전용 새 탭에서 재개한다. 무제한 재시도하지 않는다.

## `tag-pushed-release-unpublished` 복구

이 상태에서는 버전 번호나 tag를 바꾸지 않는다.

1. 원격 `develop`과 dereferenced annotated tag가 같은 commit인지 확인한다.
2. 로컬 ZIP의 SHA-256과 manifest version을 다시 확인한다.
3. 기존 draft가 있으면 그 draft를 열고, 없으면 기존 tag로 새 Release form을 연다.
4. 같은 ZIP과 기록된 Release 본문을 업로드한다.
5. 공개 후 Release URL, asset URL, SHA-256을 대조한다.

tag나 ZIP 내용이 달라졌다면 기존 tag를 이동하거나 자산을 덮어쓰지 말고 새 SemVer 버전으로 다시 릴리즈한다.
