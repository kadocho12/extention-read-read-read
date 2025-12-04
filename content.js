// テキスト選択を検知してbackgroundに送信するコンテントスクリプト

// 定数（Content ScriptsはES Modulesをサポートしていないためローカル定義）
const DEFAULT_SETTINGS = { enabled: false, rate: 1.0, volume: 1.0 };
const EVENT_DELAY_MS = 10;
const ACTIONS = { SPEAK: 'speak', STOP: 'stop' };

// 安全にメッセージを送信するヘルパー関数
function sendMessageSafely(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    // 拡張機能のコンテキストが無効な場合は無視
    console.debug('Select and Speak: メッセージ送信スキップ', error.message);
  }
}

// mouseupイベントでテキスト選択を検知
// 選択完了をトリガーに読み上げ開始
document.addEventListener('mouseup', async (event) => {
  // 少し遅延を入れて選択が確定するのを待つ
  setTimeout(async () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // 空文字列や空白のみの場合は何もしない
    if (!selectedText || selectedText.length === 0) {
      return;
    }
    
    // 設定を取得
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    
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
