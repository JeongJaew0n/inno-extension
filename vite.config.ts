import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    /*
     * 모듈 미리 불러오기를 끈다.
     *
     * Vite 는 동적 import 에 `<link rel="modulepreload" href="assets/…">` 를 붙인다. 경로가 상대
     * 경로라 content script 에서는 **사이트 페이지 주소 기준**으로 풀린다. 그래서 Markdown 변환기를
     * 불러올 때마다 `https://pms-innogrid.atlassian.net/assets/…` 로 요청이 나가 404 가 났다
     * (실제 import 는 확장 주소로 가서 성공한다). 사내 사이트에 쓸데없는 요청을 흘리는 셈이다.
     *
     * 확장 파일은 전부 로컬이라 미리 불러와서 얻는 것도 없다. e2e 오류 수집에서 잡았다.
     */
    modulePreload: false,
  },
});
