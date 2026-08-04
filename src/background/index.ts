import { getSettings } from '../platform/settings/repository';

chrome.runtime.onInstalled.addListener(() => {
  void getSettings();
});
