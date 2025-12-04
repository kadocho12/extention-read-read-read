// Service Worker (Background Script)

import { DEFAULT_SETTINGS, ACTIONS } from './constants.js';

// 初期設定のインストール
chrome.runtime.onInstalled.addListener(async () => {
  // 初期値を設定（既存の値がある場合は上書きしない）
  const existing = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  
  const defaults = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[key] === undefined) {
      defaults[key] = value;
    }
  }
  
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.sync.set(defaults);
  }
});

// 設定変更を監視（OFFにされたら読み上げを停止）
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.enabled) {
    // enabledがfalseに変更されたら読み上げを停止
    if (changes.enabled.newValue === false) {
      chrome.tts.stop();
    }
  }
});

// コンテントスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTIONS.SPEAK) {
    speakText(message.text, message.rate);
  } else if (message.action === ACTIONS.STOP) {
    chrome.tts.stop();
  }
  return true;
});

// テキストを読み上げる関数
function speakText(text, rate) {
  // 現在の読み上げを停止
  chrome.tts.stop();
  
  // 新しいテキストを読み上げ
  chrome.tts.speak(text, {
    rate: rate,
    lang: 'ja-JP',
    onEvent: (event) => {
      if (event.type === 'error') {
        console.error('TTS Error:', event.errorMessage);
      }
    }
  });
}
