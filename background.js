// Service Worker (Background Script)

// 初期設定のインストール
chrome.runtime.onInstalled.addListener(async () => {
  // 初期値を設定（既存の値がある場合は上書きしない）
  const existing = await chrome.storage.sync.get(['enabled', 'rate']);
  
  const defaults = {};
  if (existing.enabled === undefined) {
    defaults.enabled = false;
  }
  if (existing.rate === undefined) {
    defaults.rate = 1.0;
  }
  
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.sync.set(defaults);
  }
});

// コンテントスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'speak') {
    speakText(message.text, message.rate);
  } else if (message.action === 'stop') {
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
