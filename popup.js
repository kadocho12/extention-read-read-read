import { DEFAULT_SETTINGS } from './constants.js';

// DOM要素の取得
const enabledSwitch = document.getElementById('enabledSwitch');
const statusText = document.getElementById('statusText');
const rateSlider = document.getElementById('rateSlider');
const rateValue = document.getElementById('rateValue');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

// 設定の読み込み
async function loadSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  
  enabledSwitch.checked = result.enabled;
  updateStatusText(result.enabled);
  
  rateSlider.value = result.rate;
  updateRateValue(result.rate);
  
  volumeSlider.value = result.volume;
  updateVolumeValue(result.volume);
}

// ステータステキストの更新
function updateStatusText(enabled) {
  statusText.textContent = enabled ? 'ON' : 'OFF';
  statusText.classList.toggle('off', !enabled);
}

// 速度表示の更新
function updateRateValue(rate) {
  rateValue.textContent = `${parseFloat(rate).toFixed(1)}x`;
}

// 音量表示の更新
function updateVolumeValue(volume) {
  volumeValue.textContent = `${Math.round(parseFloat(volume) * 100)}%`;
}

// ON/OFFスイッチの変更イベント
enabledSwitch.addEventListener('change', async () => {
  const enabled = enabledSwitch.checked;
  await chrome.storage.sync.set({ enabled });
  updateStatusText(enabled);
});

// 速度スライダーの変更イベント
rateSlider.addEventListener('input', () => {
  const rate = parseFloat(rateSlider.value);
  updateRateValue(rate);
});

rateSlider.addEventListener('change', async () => {
  const rate = parseFloat(rateSlider.value);
  await chrome.storage.sync.set({ rate });
});

// 音量スライダーの変更イベント
volumeSlider.addEventListener('input', () => {
  const volume = parseFloat(volumeSlider.value);
  updateVolumeValue(volume);
});

volumeSlider.addEventListener('change', async () => {
  const volume = parseFloat(volumeSlider.value);
  await chrome.storage.sync.set({ volume });
});

// 初期化
loadSettings();
