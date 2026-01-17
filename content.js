// テキスト選択を検知してbackgroundに送信するコンテントスクリプト

// 定数（Content ScriptsはES Modulesをサポートしていないためローカル定義）
const DEFAULT_SETTINGS = {
  enabled: false,
  rate: 1.0,
  volume: 1.0
};
const EVENT_DELAY_MS = 10;
const ACTIONS = {
  SPEAK: 'speak',
  STOP: 'stop'
};

let currentSettings = { ...DEFAULT_SETTINGS };

function sendMessageSafely(message) {
  chrome.runtime.sendMessage(message);
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  currentSettings = settings;
  return settings;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  const next = { ...currentSettings };
  for (const [key, change] of Object.entries(changes)) {
    next[key] = change.newValue;
  }
  currentSettings = next;
});

loadSettings();

// mouseupイベントでテキスト選択を検知
// 選択完了をトリガーに読み上げ開始
document.addEventListener('mouseup', async (event) => {
  // 少し遅延を入れて選択が確定するのを待つ
  setTimeout(async () => {
    const selection = window.getSelection();    
    const selectedText = selection.toString().trim();
    
    // 設定を取得
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    currentSettings = settings;
    
    // 無効化されている場合は何もしない
    if (!settings.enabled) {
      return;
    }

    // backgroundスクリプトに読み上げリクエストを送信
    sendMessageSafely({
      action: ACTIONS.SPEAK,
      text: selectedText,
      rate: settings.rate,
      volume: settings.volume
    });
  }, EVENT_DELAY_MS);
});

// 選択解除されたら読み上げを停止
document.addEventListener('selectionchange', async () => {
  // selectionchange はドラッグ中にも発火するので少し待って確定させる
  setTimeout(async () => {
    // 設定を取得して有効時のみ処理
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    currentSettings = settings;
    if (!settings.enabled) {
      return;
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // 選択が空（解除）になったら停止を通知
    if (!selectedText || selectedText.length === 0) {
      sendMessageSafely({ action: ACTIONS.STOP });
    }
  }, EVENT_DELAY_MS);
});

document.addEventListener('keydown', () => {
  if (!currentSettings.enabled) {
    return;
  }
});
