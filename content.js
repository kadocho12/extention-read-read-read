// テキスト選択を検知してbackgroundに送信するコンテントスクリプト

// 定数（Content ScriptsはES Modulesをサポートしていないためローカル定義）
const DEFAULT_SETTINGS = {
  enabled: false,
  rate: 1.0,
  volume: 1.0,
  selectionColor: '#b3d4ff',
  progressHighlightEnabled: true,
  progressUnderlineEnabled: false
};
const EVENT_DELAY_MS = 10;
const ACTIONS = { SPEAK: 'speak', STOP: 'stop', PROGRESS: 'progress', END: 'end' };

const ROOT = document.documentElement;
const SELECTION_STYLE_ID = 'sas-selection-style';
const SELECTION_ENABLED_ATTR = 'data-sas-selection-enabled';
const SELECTION_ORIGIN_ATTR = 'data-sas-selection-origin';
const POPUP_STYLE_ID = 'sas-reading-popup-style';
const POPUP_ID = 'sas-reading-popup';
const POPUP_MARGIN = 8;
const HIGHLIGHT_STYLE_ID = 'sas-progress-highlight-style';

let currentSettings = { ...DEFAULT_SETTINGS };
let popupEl = null;
let popupSpokenEl = null;
let popupRemainingEl = null;
let popupRange = null;
let popupText = '';
let popupCharIndex = 0;
let popupDisplayIndex = 0;
let popupAnimRafId = null;
let popupAnimFrom = 0;
let popupAnimTo = 0;
let popupAnimStart = 0;
let popupAnimDuration = 0;
let popupTargetIndex = 0;
const POPUP_LEAD_CHARS = 2;
const POPUP_ANIM_MIN_MS = 40;
const POPUP_ANIM_MAX_MS = 260;
const POPUP_ANIM_MS_PER_CHAR = 12;
let highlightSpans = [];
let highlightTotalLength = 0;
let suppressSelectionChange = false;
let popupNewlinePrefix = null;

// 安全にメッセージを送信するヘルパー関数
function sendMessageSafely(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    // 拡張機能のコンテキストが無効な場合は無視
    console.debug('Select and Speak: メッセージ送信スキップ', error.message);
  }
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

function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
.sas-progress-segment {
  background-repeat: no-repeat;
  background-size: 0 0;
  transition: none;
}
.sas-progress-segment.sas-progress-highlight {
  background-image: linear-gradient(
    to right,
    rgba(255, 215, 0, 0.55),
    rgba(255, 215, 0, 0.55)
  );
  background-size: calc(var(--sas-progress, 0) * 100%) 100%;
  background-position: left top;
}
.sas-progress-segment.sas-progress-underline {
  background-image: linear-gradient(
    to right,
    rgba(255, 193, 7, 0.9),
    rgba(255, 193, 7, 0.9)
  );
  background-size: calc(var(--sas-progress, 0) * 100%) 2px;
  background-position: left calc(100% - 1px);
}
.sas-progress-segment.sas-progress-highlight.sas-progress-underline {
  background-image:
    linear-gradient(to right, rgba(255, 215, 0, 0.55), rgba(255, 215, 0, 0.55)),
    linear-gradient(to right, rgba(255, 193, 7, 0.9), rgba(255, 193, 7, 0.9));
  background-size:
    calc(var(--sas-progress, 0) * 100%) 100%,
    calc(var(--sas-progress, 0) * 100%) 2px;
  background-position:
    left top,
    left calc(100% - 1px);
}
.sas-progress-segment.sas-progress-pulse {
  animation: sas-progress-pulse 180ms ease-out;
  transform-origin: left center;
}
@keyframes sas-progress-pulse {
  0% { transform: scale(1); }
  55% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
  `;
  (document.head || document.documentElement).appendChild(style);
}

function ensurePopupStyle() {
  if (document.getElementById(POPUP_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = POPUP_STYLE_ID;
  style.textContent = `
#${POPUP_ID} {
  position: absolute;
  z-index: 2147483647;
  max-width: min(520px, calc(100vw - 24px));
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(20, 20, 20, 0.92);
  color: #ffffff;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  pointer-events: none;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 120ms ease, transform 120ms ease;
  font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
}
#${POPUP_ID}[data-hidden="true"] {
  opacity: 0;
  transform: translateY(6px);
}
#${POPUP_ID} .sas-spoken {
  color: #ffffff;
}
#${POPUP_ID} .sas-remaining {
  color: rgba(255, 255, 255, 0.45);
}
  `;
  (document.head || document.documentElement).appendChild(style);
}

function ensurePopup() {
  if (popupEl) return;
  ensurePopupStyle();
  popupEl = document.createElement('div');
  popupEl.id = POPUP_ID;
  popupEl.setAttribute('data-hidden', 'true');

  popupSpokenEl = document.createElement('span');
  popupSpokenEl.className = 'sas-spoken';
  popupRemainingEl = document.createElement('span');
  popupRemainingEl.className = 'sas-remaining';

  popupEl.appendChild(popupSpokenEl);
  popupEl.appendChild(popupRemainingEl);
  (document.body || document.documentElement).appendChild(popupEl);
}

function clearPopupRange() {
  popupRange = null;
}

function setPopupRangeFromSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    clearPopupRange();
    return;
  }
  const range = selection.getRangeAt(0);
  popupRange = range.cloneRange();
}

function getPopupAnchorRect() {
  if (popupRange) {
    const rect = popupRange.getBoundingClientRect();
    if (rect && rect.width + rect.height > 0) {
      return rect;
    }
  }
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect && rect.width + rect.height > 0) {
      return rect;
    }
  }
  return null;
}

function positionPopup() {
  if (!popupEl) return;
  const anchorRect = getPopupAnchorRect();
  if (!anchorRect) {
    hidePopup();
    return;
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const popupRect = popupEl.getBoundingClientRect();

  let top = anchorRect.top + scrollY - popupRect.height - POPUP_MARGIN;
  if (top < scrollY + POPUP_MARGIN) {
    top = anchorRect.bottom + scrollY + POPUP_MARGIN;
  }

  let left = anchorRect.left + scrollX;
  const maxLeft = scrollX + window.innerWidth - popupRect.width - POPUP_MARGIN;
  left = Math.min(Math.max(left, scrollX + POPUP_MARGIN), maxLeft);

  popupEl.style.top = `${Math.round(top)}px`;
  popupEl.style.left = `${Math.round(left)}px`;
}

function updatePopup(text, charIndex) {
  if (!text) {
    hidePopup();
    return;
  }
  ensurePopup();
  if (currentSettings.progressHighlightEnabled || currentSettings.progressUnderlineEnabled) {
    ensureHighlightStyle();
  }
  popupText = text;
  popupNewlinePrefix = buildNewlinePrefix(popupText);
  popupCharIndex = Math.max(0, Math.min(charIndex ?? 0, text.length));
  if (currentSettings.progressHighlightEnabled || currentSettings.progressUnderlineEnabled) {
    updateProgressHighlight(toVisualIndex(popupCharIndex));
  }
  popupTargetIndex = Math.max(
    popupCharIndex,
    Math.min(popupCharIndex + POPUP_LEAD_CHARS, text.length)
  );
  startPopupInterpolation();
  popupEl.setAttribute('data-hidden', 'false');
  requestAnimationFrame(positionPopup);
}

function hidePopup() {
  if (!popupEl) return;
  popupEl.setAttribute('data-hidden', 'true');
  stopPopupInterpolation();
}

function stopPopupInterpolation() {
  if (popupAnimRafId) {
    cancelAnimationFrame(popupAnimRafId);
    popupAnimRafId = null;
  }
}

function renderPopupAt(index) {
  popupDisplayIndex = Math.max(0, Math.min(index, popupText.length));
  popupSpokenEl.textContent = popupText.slice(0, popupDisplayIndex);
  popupRemainingEl.textContent = popupText.slice(popupDisplayIndex);
}

function startPopupInterpolation() {
  if (!popupText) {
    return;
  }

  if (popupTargetIndex <= popupDisplayIndex) {
    stopPopupInterpolation();
    renderPopupAt(popupTargetIndex);
    return;
  }

  const delta = popupTargetIndex - popupDisplayIndex;
  popupAnimFrom = popupDisplayIndex;
  popupAnimTo = popupTargetIndex;
  popupAnimStart = performance.now();
  popupAnimDuration = Math.min(
    POPUP_ANIM_MAX_MS,
    Math.max(POPUP_ANIM_MIN_MS, delta * POPUP_ANIM_MS_PER_CHAR)
  );

  stopPopupInterpolation();
  const tick = (now) => {
    const elapsed = now - popupAnimStart;
    const t = Math.min(1, elapsed / popupAnimDuration);
    const eased = t * (2 - t);
    const nextIndex = Math.round(popupAnimFrom + (popupAnimTo - popupAnimFrom) * eased);
    renderPopupAt(nextIndex);
    if (t < 1) {
      popupAnimRafId = requestAnimationFrame(tick);
    } else {
      popupAnimRafId = null;
    }
  };
  popupAnimRafId = requestAnimationFrame(tick);
}

function clearProgressHighlight() {
  if (highlightSpans.length === 0) return;
  for (const span of highlightSpans) {
    const parent = span.parentNode;
    if (!parent) continue;
    const textNode = document.createTextNode(span.textContent || '');
    parent.replaceChild(textNode, span);
    parent.normalize();
  }
  highlightSpans = [];
  highlightTotalLength = 0;
}

function buildProgressHighlightFromSelection() {
  if (!currentSettings.progressHighlightEnabled && !currentSettings.progressUnderlineEnabled) {
    return;
  }
  clearProgressHighlight();

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return;
  }

  ensureHighlightStyle();

  const ancestor = range.commonAncestorContainer;
  const rootNode = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor;
  if (!rootNode) {
    return;
  }
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node.nodeValue || node.nodeValue.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        try {
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } catch (error) {
          return NodeFilter.FILTER_REJECT;
        }
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  let cumulative = 0;
  const spans = [];

  for (const node of nodes) {
    const text = node.nodeValue;
    if (!text) continue;

    let startOffset = 0;
    let endOffset = text.length;
    if (node === range.startContainer) {
      startOffset = range.startOffset;
    }
    if (node === range.endContainer) {
      endOffset = range.endOffset;
    }
    if (endOffset <= startOffset) {
      continue;
    }

    const beforeText = text.slice(0, startOffset);
    const selectedText = text.slice(startOffset, endOffset);
    const afterText = text.slice(endOffset);

    const fragment = document.createDocumentFragment();
    if (beforeText) {
      fragment.appendChild(document.createTextNode(beforeText));
    }

    const span = document.createElement('span');
    span.className = getProgressSegmentClass();
    span.textContent = selectedText;
    span.dataset.start = String(cumulative);
    cumulative += selectedText.length;
    span.dataset.end = String(cumulative);
    fragment.appendChild(span);
    spans.push(span);

    if (afterText) {
      fragment.appendChild(document.createTextNode(afterText));
    }

    if (node.parentNode) {
      node.parentNode.replaceChild(fragment, node);
    }
  }

  highlightSpans = spans;
  highlightTotalLength = cumulative;
  updateProgressHighlight(0);
}

function updateProgressHighlight(index) {
  if (highlightSpans.length === 0) return;
  const clamped = Math.max(0, Math.min(index, highlightTotalLength));
  let activeSpan = null;
  for (const span of highlightSpans) {
    const start = Number(span.dataset.start || 0);
    const end = Number(span.dataset.end || 0);
    const length = Math.max(1, end - start);
    let progress = 0;
    if (clamped >= end) {
      progress = 1;
    } else if (clamped <= start) {
      progress = 0;
    } else {
      progress = (clamped - start) / length;
      activeSpan = span;
    }
    span.style.setProperty('--sas-progress', progress.toFixed(3));
  }
  if (activeSpan) {
    activeSpan.classList.remove('sas-progress-pulse');
    void activeSpan.offsetHeight;
    activeSpan.classList.add('sas-progress-pulse');
  }
}

function getProgressSegmentClass() {
  const classes = ['sas-progress-segment'];
  if (currentSettings.progressHighlightEnabled) {
    classes.push('sas-progress-highlight');
  }
  if (currentSettings.progressUnderlineEnabled) {
    classes.push('sas-progress-underline');
  }
  return classes.join(' ');
}

function updateProgressSegmentClasses() {
  if (highlightSpans.length === 0) return;
  const className = getProgressSegmentClass();
  for (const span of highlightSpans) {
    span.className = className;
  }
}

function buildNewlinePrefix(text) {
  const prefix = new Array(text.length + 1);
  let count = 0;
  prefix[0] = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      count += 1;
    }
    prefix[i + 1] = count;
  }
  return prefix;
}

function toVisualIndex(index) {
  if (!popupNewlinePrefix) {
    return index;
  }
  const clamped = Math.max(0, Math.min(index, popupNewlinePrefix.length - 1));
  return clamped - popupNewlinePrefix[clamped];
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
  if (changes.progressHighlightEnabled || changes.progressUnderlineEnabled) {
    if (!currentSettings.progressHighlightEnabled && !currentSettings.progressUnderlineEnabled) {
      clearProgressHighlight();
    } else {
      ensureHighlightStyle();
      updateProgressSegmentClasses();
    }
  }
});

loadSettings();

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === ACTIONS.PROGRESS) {
    updatePopup(message.text, message.charIndex);
  } else if (message.action === ACTIONS.END) {
    hidePopup();
    clearPopupRange();
    clearProgressHighlight();
  }
});

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
    currentSettings = settings;
    
    // 無効化されている場合は何もしない
    if (!settings.enabled) {
      return;
    }

    if (selectedText && selectedText.length > 0) {
      setSelectionOrigin('mouse');
      setPopupRangeFromSelection();
      buildProgressHighlightFromSelection();
      updatePopup(selectedText, 0);
      if (currentSettings.progressHighlightEnabled || currentSettings.progressUnderlineEnabled) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          suppressSelectionChange = true;
          selection.removeAllRanges();
        }
      }
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
    if (suppressSelectionChange) {
      suppressSelectionChange = false;
      return;
    }
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
      hidePopup();
      clearPopupRange();
      clearProgressHighlight();
      sendMessageSafely({ action: ACTIONS.STOP });
    }
  }, EVENT_DELAY_MS);
});

document.addEventListener('keydown', () => {
  if (!currentSettings.enabled) {
    return;
  }
  setSelectionOrigin(null);
  hidePopup();
  clearPopupRange();
  clearProgressHighlight();
});
