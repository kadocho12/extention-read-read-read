import { DEFAULT_SETTINGS } from './constants.js';

// DOM要素の取得
const enabledSwitch = document.getElementById('enabledSwitch');
const statusText = document.getElementById('statusText');
const rateSlider = document.getElementById('rateSlider');
const rateValue = document.getElementById('rateValue');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const selectionColorPicker = document.getElementById('selectionColorPicker');
const selectionColorInput = document.getElementById('selectionColorInput');
const progressHighlightSwitch = document.getElementById('progressHighlightSwitch');
const progressHighlightStatus = document.getElementById('progressHighlightStatus');
const progressUnderlineSwitch = document.getElementById('progressUnderlineSwitch');
const progressUnderlineStatus = document.getElementById('progressUnderlineStatus');

// 設定の読み込み
async function loadSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  
  enabledSwitch.checked = result.enabled;
  updateStatusText(result.enabled, statusText);
  
  rateSlider.value = result.rate;
  updateRateValue(result.rate);
  
  volumeSlider.value = result.volume;
  updateVolumeValue(result.volume);

  setColorInputs(result.selectionColor);

  progressHighlightSwitch.checked = result.progressHighlightEnabled;
  updateStatusText(result.progressHighlightEnabled, progressHighlightStatus);

  progressUnderlineSwitch.checked = result.progressUnderlineEnabled;
  updateStatusText(result.progressUnderlineEnabled, progressUnderlineStatus);
}

// ステータステキストの更新
function updateStatusText(enabled, target) {
  target.textContent = enabled ? 'ON' : 'OFF';
  target.classList.toggle('off', !enabled);
}

// 速度表示の更新
function updateRateValue(rate) {
  rateValue.textContent = `${parseFloat(rate).toFixed(1)}x`;
}

// 音量表示の更新
function updateVolumeValue(volume) {
  volumeValue.textContent = `${Math.round(parseFloat(volume) * 100)}%`;
}

function normalizeHexColor(value) {
  if (!value) return null;
  let hex = value.trim().toLowerCase();
  if (!hex.startsWith('#')) {
    hex = `#${hex}`;
  }
  const shortMatch = /^#([0-9a-f]{3})$/i.exec(hex);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return hex.toLowerCase();
  }
  return null;
}

function setColorInputs(color) {
  const normalized = normalizeHexColor(color) || DEFAULT_SETTINGS.selectionColor;
  selectionColorPicker.value = normalized;
  selectionColorInput.value = normalized;
  selectionColorInput.classList.remove('invalid');
}

// ON/OFFスイッチの変更イベント
enabledSwitch.addEventListener('change', async () => {
  const enabled = enabledSwitch.checked;
  await chrome.storage.sync.set({ enabled });
  updateStatusText(enabled, statusText);
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

selectionColorPicker.addEventListener('input', () => {
  const color = selectionColorPicker.value;
  selectionColorInput.value = color;
  selectionColorInput.classList.remove('invalid');
});

selectionColorPicker.addEventListener('change', async () => {
  const color = selectionColorPicker.value;
  await chrome.storage.sync.set({ selectionColor: color });
});

selectionColorInput.addEventListener('input', () => {
  const normalized = normalizeHexColor(selectionColorInput.value);
  if (normalized) {
    selectionColorInput.classList.remove('invalid');
    selectionColorPicker.value = normalized;
  } else {
    selectionColorInput.classList.add('invalid');
  }
});

selectionColorInput.addEventListener('change', async () => {
  const normalized = normalizeHexColor(selectionColorInput.value);
  if (!normalized) {
    selectionColorInput.classList.add('invalid');
    return;
  }
  setColorInputs(normalized);
  await chrome.storage.sync.set({ selectionColor: normalized });
});

selectionColorInput.addEventListener('blur', async () => {
  const normalized = normalizeHexColor(selectionColorInput.value);
  if (!normalized) {
    selectionColorInput.classList.add('invalid');
    return;
  }
  setColorInputs(normalized);
  await chrome.storage.sync.set({ selectionColor: normalized });
});

progressHighlightSwitch.addEventListener('change', async () => {
  const progressHighlightEnabled = progressHighlightSwitch.checked;
  await chrome.storage.sync.set({ progressHighlightEnabled });
  updateStatusText(progressHighlightEnabled, progressHighlightStatus);
});

progressUnderlineSwitch.addEventListener('change', async () => {
  const progressUnderlineEnabled = progressUnderlineSwitch.checked;
  await chrome.storage.sync.set({ progressUnderlineEnabled });
  updateStatusText(progressUnderlineEnabled, progressUnderlineStatus);
});

// 初期化
loadSettings();
