// ====== Config ======
const APPEND_TEXT   = "\n\nthink really HARD! about this one.";
const STORAGE_KEY   = "thinkHardEnabled";
const OVERLAY_KEY   = "thinkHardShowOverlay";
const DEBUG         = false;

// Fade/hide behavior on unsupported model
const HIDE_AFTER_MS = 30000;
const POLL_MS       = 1000;

const log  = (...a) => DEBUG && console.log("[ThinkHard]", ...a);
const warn = (...a) => DEBUG && console.warn("[ThinkHard]", ...a);

// ====== State ======
let USER_PREF_ENABLED = true;    // user’s on/off
let OVERLAY_PREF_SHOW = true;    // show floating UI?
let MODEL_LOCKED = false;        // blocked unless GPT-5 (normal)
let LAST_MODEL_LABEL = "";
let LAST_ALLOWED = null;

let hideTimer = null;
let isHidden  = false;
let pollId    = null;

// ====== UI Toggle (floating) ======
function injectToggle(initialOn = true) {
  if (!OVERLAY_PREF_SHOW) return;                  // respect preference
  if (document.getElementById("think-hard-toggle")) return;

  const box = document.createElement("div");
  box.id = "think-hard-toggle";
  box.title = "Toggle appending ‘Think HARD!’ to your next message";
  box.innerHTML = `
    <div class="row">
      <span class="icon" aria-hidden="true">🐈‍⬛</span>
      <span class="label">Reasoning</span>
      <input id="think-hard-checkbox" type="checkbox" ${initialOn ? "checked" : ""} />
    </div>
    <div class="status" id="think-hard-status"></div>
    <a class="maker" href="https://x.com/test_tm7873" target="_blank" rel="noopener noreferrer"
       aria-label="Made by @test_tm7873 on X">Made by @test_tm7873 on X</a>
  `;
  document.body.appendChild(box);

  const cb = box.querySelector("#think-hard-checkbox");
  cb.setAttribute("aria-label", "Toggle Think HARD appender");
  cb.addEventListener("change", () => {
    USER_PREF_ENABLED = cb.checked;
    chrome.storage.sync.set({ [STORAGE_KEY]: USER_PREF_ENABLED });
    updateEffectiveEnabledUI();
  });

  updateEffectiveEnabledUI();
}

function removeOverlay() {
  const box = document.getElementById("think-hard-toggle");
  if (box) box.remove();
  isHidden = false;
}

function ensureOverlay() {
  if (OVERLAY_PREF_SHOW) injectToggle(USER_PREF_ENABLED);
  else removeOverlay();
}

function setLockedUI(locked, reason = "") {
  const box = document.getElementById("think-hard-toggle");
  const cb  = document.getElementById("think-hard-checkbox");
  const st  = document.getElementById("think-hard-status");
  if (!box || !cb || !st) return; // overlay might be hidden

  if (locked) {
    box.classList.add("locked");
    cb.disabled = true;
    st.textContent = reason || "Works only for GPT-5 (normal)";
    scheduleHideIfLocked();
  } else {
    box.classList.remove("locked");
    cb.disabled = false;
    st.textContent = "";
    cancelHide();
    showToggle();
  }
}

function updateEffectiveEnabledUI() {
  const cb = document.getElementById("think-hard-checkbox");
  if (cb) cb.checked = USER_PREF_ENABLED && !MODEL_LOCKED;
}

// ====== Show/Hide helpers ======
function scheduleHideIfLocked() {
  cancelHide();
  if (!MODEL_LOCKED) return;
  hideTimer = setTimeout(() => { if (MODEL_LOCKED) hideToggle(); }, HIDE_AFTER_MS);
}
function cancelHide() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } }
function hideToggle() {
  const box = document.getElementById("think-hard-toggle");
  if (box && !isHidden) { box.classList.add("hidden"); box.setAttribute("aria-hidden","true"); isHidden = true; }
}
function showToggle() {
  const box = document.getElementById("think-hard-toggle");
  if (box && isHidden) { box.classList.remove("hidden"); box.removeAttribute("aria-hidden"); isHidden = false; }
}

// ====== Toast (used by popup "help") ======
let toastTimer = null;
function showToast(msg, type = "error", ms = 2200) {
  let t = document.getElementById("think-hard-toast");
  if (!t) { t = document.createElement("div"); t.id = "think-hard-toast"; document.body.appendChild(t); }
  t.className = type === "ok" ? "ok" : "error";
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// ====== Composer discovery ======
function findComposer() {
  const ceCandidates = [
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-testid="prompt-textarea"]',
    'div[contenteditable="true"]'
  ];
  for (const sel of ceCandidates) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return { el, type: "ced" };
  }
  const taCandidates = [
    'textarea#prompt-textarea',
    'textarea[placeholder*="Message"]',
    'textarea[aria-label*="message"]',
    "textarea"
  ];
  for (const sel of taCandidates) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return { el, type: "textarea" };
  }
  return null;
}
function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}
function getFormRoot(node) {
  let n = node;
  while (n && n !== document.body) { if (n.tagName === "FORM") return n; n = n.parentElement; }
  return null;
}
function getSendButton() {
  return (
    document.querySelector('[data-testid="send-button"]') ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('button[type="submit"]')
  );
}

// ====== Lexical-safe insert ======
function currentText(comp) { return comp.type === "textarea" ? comp.el.value : comp.el.innerText || ""; }
function alreadyHasSuffix(text) {
  const trimmed = text.replace(/\s+$/, "");
  const suffixCore = APPEND_TEXT.replace(/^\s+/, "").replace(/\s+$/, "");
  return trimmed.toLowerCase().endsWith(suffixCore.toLowerCase());
}
function shouldAppend(text) { const s = text.trim(); return !!s && !alreadyHasSuffix(text); }
function ensureSeparator(s) { if (!s || !s.trim()) return ""; return /\n\s*$/.test(s) ? "" : "\n\n"; }
function appendToComposer(comp, text) {
  const buildInsert = (cur) => ensureSeparator(cur) + text.replace(/^\s+/, "");
  if (comp.type === "textarea") {
    const insertion = buildInsert(comp.el.value || "");
    comp.el.value += insertion;
    comp.el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  comp.el.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(comp.el);
  range.collapse(false);
  sel.removeAllRanges(); sel.addRange(range);
  const insertion = buildInsert(comp.el.innerText || "");
  document.execCommand("insertText", false, insertion);
  comp.el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: insertion }));
}

// ====== Enable logic ======
function effectiveEnabled() { return USER_PREF_ENABLED && !MODEL_LOCKED; }
function appendIfEnabled() {
  if (!effectiveEnabled()) return;
  const comp = findComposer();
  if (!comp) return;
  const txt = currentText(comp);
  if (!shouldAppend(txt)) return;
  appendToComposer(comp, APPEND_TEXT);
}

// ====== Wiring (send hooks) ======
function wire() {
  const comp = findComposer();
  if (!comp) return;

  const form = getFormRoot(comp.el);
  const sendBtn = getSendButton();

  if (!comp.el._thinkHardKeydown) {
    comp.el._thinkHardKeydown = true;
    comp.el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) appendIfEnabled();
    }, true);
  }
  if (form && !form._thinkHardSubmit) {
    form._thinkHardSubmit = true;
    form.addEventListener("submit", () => appendIfEnabled(), true);
  }
  if (sendBtn && !sendBtn._thinkHardMouse) {
    sendBtn._thinkHardMouse = true;
    sendBtn.addEventListener("mousedown", () => appendIfEnabled(), true);
  }
}

// ====== Model helpers ======
function detectModelFromUrl() {
  try {
    const p = new URLSearchParams(location.search);
    const m = (p.get('model') || '').toLowerCase();
    if (!m) return null;
    if (m === 'gpt-5') return 'gpt-5';
    if (m.includes('gpt-5') && m.includes('thinking')) return 'gpt-5-thinking';
    return m;
  } catch { return null; }
}
function detectCurrentModelLabel() {
  const roots = [
    document.querySelector("header"),
    document.querySelector('[data-testid*="sidebar"]'),
    document.querySelector('[data-testid*="model"]'),
    document
  ].filter(Boolean);

  const labels = new Set();
  for (const root of roots) {
    const els = root.querySelectorAll(`
      [data-testid*="model"], [aria-label*="model"], [class*="model"], button, span, div
    `);
    for (const el of els) {
      const t = (el.textContent || "").trim();
      if (t && /gpt/i.test(t)) labels.add(t);
    }
    if (labels.size) break;
  }
  return Array.from(labels).sort((a, b) => a.length - b.length)[0] || "";
}
function normalizeLabel(label) {
  let s = (label || "").toLowerCase();
  s = s.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  return s;
}
function isAllowedModel(label) {
  const s = normalizeLabel(label);
  if (!s) return false;
  if (!/(?:^|[^0-9])5(?:$|[^0-9])/.test(s) || !/gpt|chatgpt/.test(s)) return false;
  if (/\b(thinking|reason|auto|chain|o\d|mini|flash|realtime|omni|turbo)\b/.test(s)) return false;
  return /\bgpt[-\s]?5\b|\bchatgpt\s*5\b/.test(s);
}

// ====== Gate ======
function enforceModelGate({ showToasts = false } = {}) {
  const urlModel = detectModelFromUrl();     // primary
  const label    = detectCurrentModelLabel();// fallback

  const allowed = urlModel ? (urlModel === 'gpt-5') : isAllowedModel(label);
  if (label === LAST_MODEL_LABEL && allowed === LAST_ALLOWED) return;

  LAST_MODEL_LABEL = label;
  LAST_ALLOWED     = allowed;

  if (allowed) {
    MODEL_LOCKED = false;
    setLockedUI(false);
    updateEffectiveEnabledUI();
    showToggle();
    if (showToasts) showToast("GPT-5 detected — Think HARD! enabled (if toggled).", "ok", 1600);
  } else {
    MODEL_LOCKED = true;
    setLockedUI(true, "Works only for GPT-5 (normal). Detected: " + (urlModel || label || "unknown"));
    updateEffectiveEnabledUI();
    scheduleHideIfLocked();
    if (showToasts) showToast("Think HARD! works only for GPT-5 (normal).", "error", 2000);
  }
}

// ====== Inject route hook (page world, CSP-safe via file) ======
function injectRouteHook() {
  try {
    const url = chrome.runtime.getURL('route-hook.js');
    const s = document.createElement('script');
    s.src = url;
    s.defer = true;
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    // polling + click fallback still handles changes
    if (DEBUG) console.debug("[ThinkHard] route hook inject failed", e);
  }
}

// ====== Watchers ======
function startModelWatchers() {
  injectRouteHook();

  const mo = new MutationObserver(() => { wire(); enforceModelGate(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("click", () => enforceModelGate(), true);
  document.addEventListener("visibilitychange", () => enforceModelGate());
  document.addEventListener("th:route", () => enforceModelGate());

  if (pollId) clearInterval(pollId);
  pollId = setInterval(() => enforceModelGate(), POLL_MS);
}

// ====== Popup messaging ======
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'TH_GET_STATUS') {
    sendResponse({
      modelLabel: LAST_MODEL_LABEL || (detectModelFromUrl() || ''),
      allowed: !MODEL_LOCKED,
      userPref: USER_PREF_ENABLED,
      overlayPref: OVERLAY_PREF_SHOW,
      overlayVisible: !!document.getElementById('think-hard-toggle'),
      effective: USER_PREF_ENABLED && !MODEL_LOCKED
    });
    return true;
  }
  if (msg?.type === 'TH_SET_USER_PREF') {
    USER_PREF_ENABLED = !!msg.value;
    chrome.storage.sync.set({ [STORAGE_KEY]: USER_PREF_ENABLED });
    updateEffectiveEnabledUI();
    sendResponse({ ok: true }); return true;
  }
  if (msg?.type === 'TH_SET_OVERLAY_PREF') {
    OVERLAY_PREF_SHOW = !!msg.value;
    chrome.storage.sync.set({ [OVERLAY_KEY]: OVERLAY_PREF_SHOW });
    ensureOverlay();
    sendResponse({ ok: true }); return true;
  }
  if (msg?.type === 'TH_SHOW_INFO') {
    showToast(
      MODEL_LOCKED
        ? 'Adds an instruction to your next message, but only on GPT-5 (normal).'
        : 'Enabled: will append “think really HARD! about this one.” to your next message.',
      MODEL_LOCKED ? 'error' : 'ok',
      3000
    );
    return true;
  }
});

// ====== Init ======
chrome.storage.sync.get({ [STORAGE_KEY]: true, [OVERLAY_KEY]: true }, (res) => {
  USER_PREF_ENABLED = !!res[STORAGE_KEY];
  OVERLAY_PREF_SHOW = res[OVERLAY_KEY] !== false; // default true
  ensureOverlay();
  wire();
  enforceModelGate({ showToasts: true });
  startModelWatchers();
});
