// テキスト選択を検知してbackgroundに送信するコンテントスクリプト

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
    const settings = await chrome.storage.sync.get({
      enabled: false,
      rate: 1.0
    });
    
    // 無効化されている場合は何もしない
    if (!settings.enabled) {
      return;
    }
    
    // backgroundスクリプトに読み上げリクエストを送信
    chrome.runtime.sendMessage({
      action: 'speak',
      text: selectedText,
      rate: settings.rate
    });
  }, 10);
});

// 選択解除されたら読み上げを停止
document.addEventListener('selectionchange', () => {
  // selectionchange はドラッグ中にも発火するので少し待って確定させる
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // 選択が空（解除）になったら停止を通知
    if (!selectedText || selectedText.length === 0) {
      chrome.runtime.sendMessage({ action: 'stop' });
    }
  }, 10);
});
