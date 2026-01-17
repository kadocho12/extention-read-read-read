// テキスト選択を検知してbackgroundに送信するコンテントスクリプト

// 定数（Content ScriptsはES Modulesをサポートしていないためローカル定義）
const DEFAULT_SETTINGS = {
  enabled: false,
  rate: 1.0,
  volume: 1.0,
  selectionColor: '#b3d4ff'
};
const EVENT_DELAY_MS = 10;
const ACTIONS = {
  SPEAK: 'speak',
  STOP: 'stop'
};

const ROOT = document.documentElement;
const SELECTION_STYLE_ID = 'sas-selection-style';
const SELECTION_ENABLED_ATTR = 'data-sas-selection-enabled';
const SELECTION_ORIGIN_ATTR = 'data-sas-selection-origin';

let currentSettings = { ...DEFAULT_SETTINGS };

function sendMessageSafely(message) {
  chrome.runtime.sendMessage(message);
}

function ensureSelectionStyle() {
  if (document.getElementById(SELECTION_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = SELECTION_STYLE_ID;
  style.textContent = `
:root {
  --sas-selection-bg: ${DEFAULT_SETTINGS.selectionColor};
  --sas-selection-text: #000000;
}
:root[${SELECTION_ENABLED_ATTR}="true"][${SELECTION_ORIGIN_ATTR}="mouse"] ::selection {
  background: var(--sas-selection-bg);
  color: var(--sas-selection-text);
}
:root[${SELECTION_ENABLED_ATTR}="true"][${SELECTION_ORIGIN_ATTR}="mouse"] ::-moz-selection {
  background: var(--sas-selection-bg);
  color: var(--sas-selection-text);
}
  `;
  (document.head || document.documentElement).appendChild(style);
}

function normalizeHexColor(value) {
  if (!value) return null;
  let hex = String(value).trim().toLowerCase();
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

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function linearizeChannel(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }) {
  const rLin = linearizeChannel(r);
  const gLin = linearizeChannel(g);
  const bLin = linearizeChannel(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickTextColor(bgHex) {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#000000';
  const lum = relativeLuminance(rgb);
  const contrastBlack = contrastRatio(lum, 0);
  const contrastWhite = contrastRatio(1, lum);
  return contrastBlack >= contrastWhite ? '#000000' : '#ffffff';
}

function applySelectionColors(color) {
  ensureSelectionStyle();
  const normalized = normalizeHexColor(color) || DEFAULT_SETTINGS.selectionColor;
  const textColor = pickTextColor(normalized);
  ROOT.style.setProperty('--sas-selection-bg', normalized);
  ROOT.style.setProperty('--sas-selection-text', textColor);
}

function setSelectionEnabled(enabled) {
  if (enabled) {
    ROOT.setAttribute(SELECTION_ENABLED_ATTR, 'true');
  } else {
    ROOT.removeAttribute(SELECTION_ENABLED_ATTR);
    setSelectionOrigin(null);
  }
}

function setSelectionOrigin(origin) {
  if (origin === 'mouse') {
    ROOT.setAttribute(SELECTION_ORIGIN_ATTR, 'mouse');
  } else {
    ROOT.removeAttribute(SELECTION_ORIGIN_ATTR);
  }
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  currentSettings = settings;
  applySelectionColors(settings.selectionColor);
  setSelectionEnabled(settings.enabled);
  return settings;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  const next = { ...currentSettings };
  for (const [key, change] of Object.entries(changes)) {
    next[key] = change.newValue;
  }
  currentSettings = next;
  if (changes.selectionColor || changes.enabled) {
    applySelectionColors(currentSettings.selectionColor);
    setSelectionEnabled(currentSettings.enabled);
  }
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

    if (selectedText && selectedText.length > 0) {
      setSelectionOrigin('mouse');
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
      setSelectionOrigin(null);
      sendMessageSafely({ action: ACTIONS.STOP });
    }
  }, EVENT_DELAY_MS);
});

document.addEventListener('keydown', () => {
  if (!currentSettings.enabled) {
    return;
  }
  setSelectionOrigin(null);
});
