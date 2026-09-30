/**
 * GitLab MAIN world 진입점.
 *
 * content script(ISOLATED)가 닿을 수 없는 Vue 인스턴스를 다루는 브리지를 심는다.
 * 이벤트 리스너를 하나 거는 것뿐이라 다른 화면에는 아무 영향이 없다. **네트워크 요청은 없다.**
 */
import { installTokenPresetBridge } from './features/tokenPermissionPreset/mainBridge';

installTokenPresetBridge();
