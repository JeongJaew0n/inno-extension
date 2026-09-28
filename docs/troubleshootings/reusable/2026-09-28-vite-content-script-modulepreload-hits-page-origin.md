# content script 의 동적 import 가 사이트 주소로 `/assets/…` 요청을 보낸다

- 발생일: 2026-09-28
- 상태: **원인 확정 · 수정 · e2e 로 확인**

## 환경

Vite 5 + `@crxjs/vite-plugin` 2 (beta), Chrome MV3 content script.

## 증상

content script 에서 동적 `import()` 로 모듈을 불러올 때마다 **사이트 페이지 주소**로 요청이 나가
404 가 난다.

```
Failed to load resource: 404  https://<사이트>/assets/code-block-to-adf-….js
```

기능은 동작한다. 실제 import 는 확장 주소로 가서 성공하기 때문이다. 그래서 로그만 보고 지나치기 쉽다.

## 원인

Vite 는 동적 import 에 **모듈 미리 불러오기**를 붙인다. 빌드 산출물에 `__vite__mapDeps` 목록
(`"assets/…js"`)이 생기고, 런타임에 `<link rel="modulepreload" href="/assets/…">` 를 문서에 넣는다.

경로가 문서 기준이라 content script 에서는 **사이트 오리진**으로 풀린다. 확장 페이지(Popup)에서는
`chrome-extension://` 오리진이라 문제가 없어서 드러나지 않는다.

## 해결

```ts
// vite.config.ts
export default defineConfig({
  plugins: [crx({ manifest })],
  build: { modulePreload: false },
});
```

확장 파일은 전부 로컬이라 미리 불러와서 얻는 것도 없다. 끄면 `__vite__mapDeps` 가 사라진다.

## 재발 방지

e2e 가 페이지·content script·service worker 의 오류 로그를 전부 모아 0건인지 본다. 이 404 도
그렇게 잡혔다.
