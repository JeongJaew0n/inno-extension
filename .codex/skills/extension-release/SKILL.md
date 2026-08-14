---
name: extension-release
description: Inno Extension의 다음 Semantic Version을 결정하고 버전 동기화, 검증, ZIP 패키징, release commit, annotated tag, develop push, GitHub Release 자산 업로드와 공개 발행까지 수행한다. 이 저장소에서 사용자가 릴리즈, 배포 버전 생성, 버전 올리기, 태그·GitHub Release 발행, pre-release를 요청할 때 사용한다.
---

# Extension Release

Inno Extension의 재현 가능하고 검증된 릴리즈를 만든다. 상세 버전 규칙은 버전을 결정하기 전에 반드시 [references/semver.md](references/semver.md)를 끝까지 읽는다.

## 핵심 계약

- 기본 릴리즈 브랜치는 `develop`이다.
- `main` 병합은 릴리즈 범위에 포함하지 않는다. 사용자가 명시적으로 요청한 경우에만 별도로 수행한다.
- 이미 공개된 버전, 태그, ZIP은 수정하거나 재사용하지 않는다. 변경이 필요하면 새 버전을 발행한다.
- force push, 기존 태그 이동, 기존 Release 자산 덮어쓰기를 하지 않는다.
- 테스트, 빌드, ZIP 무결성, 업로드 중 하나라도 실패하면 공개 발행하지 않는다.
- 사용자의 기존 작업을 삭제·되돌리거나 릴리즈와 무관한 변경을 포함하지 않는다.

## 1. 상태 확인

다음을 읽고 현재 릴리즈 범위를 확정한다.

```bash
git status --short --branch
git branch -vv
git tag --sort=-v:refname
git log --oneline --decorate <latest-tag>..HEAD
git diff --stat <latest-tag>..HEAD
node -p "require('./package.json').version"
```

- `package.json`, `package-lock.json`, `manifest.json`의 현재 버전을 확인한다.
- 원격 `develop`과 로컬 `develop`을 비교한다. HTTPS 인증이 없으면 원격 설정을 바꾸지 말고 SSH URL `git@github.com:JeongJaew0n/inno-extension.git`을 사용한다.
- 작업 트리가 더러우면 변경 내용을 검토해 이번 릴리즈에 포함하라는 사용자 의도가 명확한 파일만 다룬다.
- 최신 태그 이후 변경 중 가장 영향도가 큰 항목으로 버전을 결정한다.

## 2. 버전 결정

우선순위는 `MAJOR > MINOR > PATCH`다.

- 호환되지 않는 변경: MAJOR
- 하위 호환 기능 추가: MINOR
- 버그, 보안, 성능, 내부 구현, 문서·설정 오류 수정: PATCH

현재 `0.x.x` 초기 개발 단계에서는 다음 프로젝트 정책을 적용한다.

- 기능 추가 또는 호환되지 않는 제품 동작 변경: MINOR
- 기존 동작을 유지하는 수정: PATCH
- `1.0.0` 전환은 공개 인터페이스 안정화가 명시적으로 결정된 경우에만 수행한다.

여러 변경이 섞이면 가장 높은 등급을 선택한다. 판단 근거와 `현재 → 다음` 버전을 사용자에게 간단히 알리되, 명백한 릴리즈 요청에서는 불필요한 승인을 기다리지 않고 진행한다.

### Pre-release 제약

SemVer pre-release는 `x.y.z-alpha.N`, `x.y.z-beta.N`, `x.y.z-rc.N` 순서를 사용한다. 다만 Chrome manifest의 `version`은 숫자 형식만 허용한다.

현재 프로젝트는 `package.json`과 `manifest.json`이 같은 정식 `x.y.z`를 쓰는 계약이므로 pre-release를 그대로 넣지 않는다. Pre-release 요청을 받으면 먼저 `manifest.version_name`, 숫자형 manifest version, ZIP 이름과 package version의 매핑을 설계·검증한 뒤 릴리즈한다. 유효하지 않은 manifest를 만들거나 정식 버전으로 위장하지 않는다.

## 3. 버전과 문서 동기화

정식 버전은 다음 순서로 맞춘다.

1. `npm version <next-version> --no-git-tag-version`으로 `package.json`과 `package-lock.json`을 갱신한다.
2. `manifest.json`의 `version`을 같은 값으로 갱신한다.
3. `rg`로 이전 버전의 현재 릴리즈 링크, 대상 버전, 배포 안내를 찾아 필요한 README·spec만 갱신한다.
4. 세 파일의 버전이 완전히 같은지 다시 확인한다.

릴리즈 노트는 최신 태그 이후 실제 diff를 근거로 작성한다. 완료하지 않은 기능이나 검증하지 않은 동작은 포함하지 않는다.

## 4. 검증과 패키징

```bash
npm run package
shasum -a 256 release/inno-extension-<version>.zip
unzip -t release/inno-extension-<version>.zip
```

`npm run package`는 typecheck, 자동화 테스트, 프로덕션 빌드, ZIP 무결성 검사를 포함해야 한다. 결과에서 다음을 기록한다.

- 테스트 통과 개수
- ZIP 절대 경로와 크기
- SHA-256
- `dist/manifest.json`과 배포 ZIP 안 manifest의 버전

패키징 후 예상치 못한 tracked file 변경이 없는지 `git status`와 `git diff --check`로 확인한다.

## 5. Commit, tag, push

릴리즈에 필요한 파일만 stage한다.

```bash
git add <release-files>
git commit -m "chore: v<version> 릴리즈"
git tag -a v<version> -m "Inno Extension v<version>"
```

- 동일 태그가 로컬이나 원격에 이미 존재하면 중단하고 새 버전을 결정한다.
- commit과 annotated tag가 같은 커밋을 가리키는지 확인한다.
- `develop`과 태그를 푸시한다. HTTPS 인증 실패 시 다음 SSH 경로를 사용하되 `origin` URL 자체는 바꾸지 않는다.

```bash
git push git@github.com:JeongJaew0n/inno-extension.git develop
git push git@github.com:JeongJaew0n/inno-extension.git v<version>
```

푸시 후 `git ls-remote`로 원격 branch와 tag를 검증한다.

## 6. GitHub Release 발행

제목은 `Inno Extension v<version>`으로 한다. 본문은 다음 구조를 사용한다.

```markdown
## 주요 변경

### <서비스 또는 영역>
- 실제 변경 내용

## 설치
첨부된 `inno-extension-<version>.zip`을 내려받아 압축을 풀고 Chrome 확장 프로그램의 개발자 모드에서 압축해제된 확장 프로그램으로 로드하세요.

## 검증
- TypeScript typecheck 통과
- 자동화 테스트 <N>개 통과
- 프로덕션 빌드 및 ZIP 무결성 검사 통과

SHA-256: `<sha256>`
```

1. 인증된 `gh`가 있으면 CLI를 우선 사용한다.
2. CLI 인증이 없고 사용자의 로그인된 Chrome 세션이 있으면 GitHub Release 화면을 사용한다.
3. ZIP 업로드는 완료 상태와 파일명·크기를 확인한 뒤에만 `Publish release`를 실행한다.
4. Chrome 자동화에서 `fileChooser.setFiles`가 `Not allowed`로 실패하면 Computer Use로 macOS 파일 선택창을 연다. `Cmd+Shift+G`로 ZIP 절대 경로를 입력하고 선택한다.
5. 공개 URL `https://github.com/JeongJaew0n/inno-extension/releases/tag/v<version>`과 실제 ZIP 다운로드 링크를 확인한다.

브라우저 도구를 사용하면 해당 도구 스킬의 탭 정리·finalize 계약을 따른다.

## 7. 완료 검증과 보고

다음이 모두 일치해야 완료다.

- `package.json`, `package-lock.json`, `manifest.json` 버전
- release commit과 annotated tag target
- 원격 `develop` commit
- GitHub Release tag
- 첨부 ZIP 파일명
- 릴리즈 노트 SHA-256과 로컬 ZIP SHA-256

최종 보고에는 버전, commit, tag, 공개 Release URL, ZIP URL, SHA-256, 테스트 결과를 포함한다. 실패한 인증 경로가 있었더라도 안전한 fallback으로 완료했다면 한 줄로 원인을 남긴다.
