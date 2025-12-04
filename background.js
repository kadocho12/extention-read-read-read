// Service Worker (Background Script)

import { DEFAULT_SETTINGS, ACTIONS } from './constants.js';

// 現在読み上げ中のテキスト情報を保持
let currentSpeech = {
  text: '',
  charIndex: 0,
  isSpeaking: false
};

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

// 設定変更を監視
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'sync') {
    // enabledがfalseに変更されたら読み上げを停止
    if (changes.enabled && changes.enabled.newValue === false) {
      chrome.tts.stop();
      currentSpeech.isSpeaking = false;
      return;
    }
    
    // 読み上げ中に速度または音量が変更されたら、残りのテキストを新しい設定で再読み上げ
    if (currentSpeech.isSpeaking && (changes.rate || changes.volume)) {
      const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      const remainingText = currentSpeech.text.substring(currentSpeech.charIndex);
      
      if (remainingText.length > 0) {
        // 現在の読み上げを停止して、残りを新しい設定で再開
        chrome.tts.stop();
        speakText(remainingText, settings.rate, settings.volume, false);
      }
    }
  }
});

// コンテントスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTIONS.SPEAK) {
    speakText(message.text, message.rate, message.volume, true);
  } else if (message.action === ACTIONS.STOP) {
    chrome.tts.stop();
    currentSpeech.isSpeaking = false;
  }
  return true;
});

// テキストを読み上げる関数
// isNewSpeech: 新規読み上げの場合はtrue、設定変更による再開の場合はfalse
function speakText(text, rate, volume, isNewSpeech = true) {
  // 現在の読み上げを停止
  chrome.tts.stop();
  
  // 新規読み上げの場合は元のテキストを保存
  if (isNewSpeech) {
    currentSpeech.text = text;
    currentSpeech.charIndex = 0;
  }
  
  currentSpeech.isSpeaking = true;
  
  // 新しいテキストを読み上げ
  chrome.tts.speak(text, {
    rate: rate,
    volume: volume,
    lang: 'ja-JP',
    onEvent: (event) => {
      if (event.type === 'word' && event.charIndex !== undefined) {
        // 読み上げ位置を更新（新規読み上げの場合のみ絶対位置として使用）
        if (isNewSpeech) {
          currentSpeech.charIndex = event.charIndex;
        } else {
          // 再開の場合は元のテキストでの位置に変換
          currentSpeech.charIndex = currentSpeech.text.length - text.length + event.charIndex;
        }
      } else if (event.type === 'end' || event.type === 'cancelled') {
        currentSpeech.isSpeaking = false;
      } else if (event.type === 'error') {
        currentSpeech.isSpeaking = false;
        console.error('TTS Error:', event.errorMessage);
      }
    }
  });
}
