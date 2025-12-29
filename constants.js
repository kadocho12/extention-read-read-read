// 定数定義ファイル

// デフォルト設定値
export const DEFAULT_SETTINGS = {
  enabled: false,
  rate: 1.0,
  volume: 1.0,
  selectionColor: '#b3d4ff',
  progressHighlightEnabled: true,
  progressUnderlineEnabled: false
};

// 読み上げ速度の範囲
export const RATE_RANGE = {
  min: 0.5,
  max: 3.0,
  step: 0.1
};

// 音量の範囲
export const VOLUME_RANGE = {
  min: 0,
  max: 1.0,
  step: 0.1
};

// イベント遅延時間（ミリ秒）
export const EVENT_DELAY_MS = 10;

// メッセージアクション
export const ACTIONS = {
  SPEAK: 'speak',
  STOP: 'stop',
  PROGRESS: 'progress',
  END: 'end',
  UPDATE_SETTINGS: 'updateSettings'
};
