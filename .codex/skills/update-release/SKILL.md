---
name: update-release
description: 로컬에 설치된 Inno Extension을 GitHub 최신 릴리즈로 갱신한다. 설치 폴더를 찾아 현재 버전과 최신 릴리즈를 비교하고, 릴리즈 ZIP을 내려받아 무결성을 확인한 뒤 백업하고 같은 경로에 덮어쓴다. 사용자가 확장 업데이트, 최신 버전 확인, 새 버전 설치, 릴리즈 내려받기를 요청할 때 사용한다.
---

# Update Release

Chrome 웹 스토어에 올리지 못해 이 확장은 **압축해제된 확장 프로그램**으로 설치한다. 그래서
새 버전이 나와도 자동으로 갱신되지 않는다. 이 스킬이 그 수동 갱신을 대신한다.

## 핵심 계약

- **설치 폴더 경로를 절대 바꾸지 않는다.** 이유는 [references/install-layout.md](references/install-layout.md)에 있다. 경로가 바뀌면 확장 ID가 바뀌고 **사용자 설정이 전부 사라진다.**
- 덮어쓰기 전에 반드시 백업하고 그 경로를 사용자에게 알린다.
- ZIP 무결성과 버전 일치를 확인하기 전에는 기존 파일을 지우지 않는다.
- 실패하면 백업에서 복원하고 상태를 보고한다. 반쯤 지워진 폴더를 남기지 않는다.
- 확장 재로드는 자동화할 수 없다. `chrome://extensions`는 브라우저 자동화가 차단한다. 마지막에 사용자에게 안내한다.
- 이미 최신이면 아무것도 하지 않는다. 같은 버전을 다시 받아 덮어쓰지 않는다.
- 저장소 작업 트리(`dist/`)를 설치 폴더로 쓰고 있으면 덮어쓰지 말고 경고한다. 그 경우는 `npm run build`가 갱신 수단이다.

## 1. 설치 폴더 확인

사용자가 경로를 알려주면 그것을 쓴다. 모르면 찾는다.

```bash
find ~ -maxdepth 6 -name manifest.json -path '*inno*' 2>/dev/null
```

찾은 후보마다 다음을 확인해 **Inno Extension이 맞는지** 검증한다.

```bash
node -p "JSON.stringify(require('<후보>/manifest.json'))" 2>/dev/null
```

- `name`이 `Inno Extension`이어야 한다.
- 후보가 여러 개면 사용자에게 어느 것을 쓰는지 묻는다. 임의로 고르지 않는다.
- 후보가 저장소의 `dist/`이면 핵심 계약대로 중단하고 안내한다.
- 하나도 못 찾으면 사용자에게 `chrome://extensions`에서 확장 카드의 **경로**를 확인해 알려달라고 요청한다.

확정한 경로를 `INSTALL_DIR`로 삼는다.

## 2. 현재 버전과 최신 릴리즈 비교

```bash
node -p "require('$INSTALL_DIR/manifest.json').version"
```

최신 릴리즈는 `gh`가 있으면 `gh`를, 없으면 공개 API를 쓴다. 저장소가 공개라 인증 없이 조회된다.

```bash
gh release view --repo JeongJaew0n/inno-extension --json tagName,assets

curl -fsSL https://api.github.com/repos/JeongJaew0n/inno-extension/releases/latest
```

- 두 버전이 같으면 **여기서 끝낸다.** 현재 버전과 릴리즈 URL을 알리고 종료한다.
- 설치 버전이 릴리즈보다 높으면 개발 중 빌드일 수 있다. 덮어쓰기 전에 사용자에게 확인받는다.
- 자산 이름은 `inno-extension-<version>.zip` 하나다. 여러 개면 이름이 정확히 일치하는 것을 고른다.

## 3. 내려받기와 검증

작업 파일은 임시 디렉터리에 둔다. 설치 폴더 안에 받지 않는다.

```bash
curl -fsSL -o "$TMP/inno-extension-<version>.zip" "<browser_download_url>"
unzip -t "$TMP/inno-extension-<version>.zip"
```

무결성 검사를 통과한 뒤 **ZIP 안의 manifest 버전이 릴리즈 태그와 같은지** 확인한다.

```bash
unzip -p "$TMP/<zip>" manifest.json | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version"
```

ZIP 최상위에는 `manifest.json`, `assets/`, `icons/`, `src/`가 있고 감싸는 폴더가 없다. 최상위에
`manifest.json`이 없으면 자산이 잘못된 것이므로 중단한다.

셋 중 하나라도 실패하면 기존 파일을 **건드리지 않고** 중단한다.

## 4. 백업

```bash
cp -R "$INSTALL_DIR" "${INSTALL_DIR%/}.backup-<현재버전>-<YYYYMMDD-HHMMSS>"
```

백업 경로를 사용자에게 알린다. 백업이 실패하면 교체를 진행하지 않는다.

## 5. 교체

**폴더 자체가 아니라 안의 내용만 지운다.** 폴더를 지웠다 다시 만들면 경로는 같아 보여도
inode가 바뀌어 Chrome이 확장을 잃을 수 있다.

```bash
find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
unzip -q "$TMP/<zip>" -d "$INSTALL_DIR"
```

지우기 전에 대상이 실제로 확장 폴더가 맞는지 다시 확인한다. `INSTALL_DIR`이 홈 디렉터리나
저장소 루트 같은 곳을 가리키면 즉시 중단한다.

## 6. 검증

```bash
node -p "require('$INSTALL_DIR/manifest.json').version"
ls "$INSTALL_DIR"
```

- manifest 버전이 새 릴리즈 버전과 같아야 한다.
- `manifest.json`, `assets/`, `icons/`, `src/`가 모두 있어야 한다.

하나라도 어긋나면 백업에서 복원한다.

```bash
find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R "<백업>/." "$INSTALL_DIR/"
```

## 7. 사용자 안내

교체만으로는 적용되지 않는다. 다음을 **사용자가 직접** 해야 한다.

1. `chrome://extensions`를 연다.
2. Inno Extension 카드의 **새로고침**(⟳)을 누른다.
3. 열려 있던 대상 사이트 탭을 새로고침한다.

2번을 건너뛰면 이전 코드가 계속 돈다. 3번을 건너뛰면 기존 탭의 content script가 무효화된
상태로 남아 버튼이 보이지 않는다.

## 8. 보고

다음을 포함해 보고한다.

- 설치 폴더 경로
- `이전 버전 → 새 버전`
- 백업 경로와 삭제해도 되는 시점
- 릴리즈 노트 URL
- 사용자가 직접 해야 할 두 단계(7절)

정상 동작을 확인하기 전에는 백업을 지우지 않는다. 삭제는 사용자가 판단한다.
