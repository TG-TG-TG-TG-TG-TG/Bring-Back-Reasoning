const els = {
  model:   document.getElementById('model'),
  state:   document.getElementById('state'),
  toggle:  document.getElementById('toggle'),
  overlay: document.getElementById('overlay'),
  help:    document.getElementById('help')
};

const SUPPORTED = [/^https:\/\/chatgpt\.com\//, /^https:\/\/chat\.openai\.com\//];

async function activeTab() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  return tab;
}
function onChat(url){ return SUPPORTED.some(rx => rx.test(url||"")); }
function set(el, txt){ el.textContent = txt; }

async function refresh() {
  const tab = await activeTab();
  if (!tab || !onChat(tab.url)) {
    set(els.model, "Model: —");
    set(els.state, "Open chatgpt.com");
    els.toggle.disabled = true;  els.toggle.checked = false;
    els.overlay.disabled = true; els.overlay.checked = true;
    return;
  }
  const res = await chrome.tabs.sendMessage(tab.id, {type:"TH_GET_STATUS"}).catch(()=>null);
  if (!res) {
    set(els.model, "Model: —");
    set(els.state, "Initializing…");
    els.toggle.disabled = true;  els.toggle.checked = false;
    els.overlay.disabled = true; els.overlay.checked = true;
    return;
  }
  set(els.model, `Model: ${res.modelLabel || "Unknown"}`);
  const allowed   = !!res.allowed;
  const effective = !!res.effective;
  const overlayOk = !!res.overlayPref;

  set(els.state, allowed ? (effective ? "Enabled" : "Disabled (toggle off)")
                         : "Locked (GPT-5 only)");
  els.toggle.disabled  = !allowed;
  els.toggle.checked   = effective;
  els.overlay.disabled = false;
  els.overlay.checked  = overlayOk;
}

els.toggle.addEventListener('change', async () => {
  const tab = await activeTab();
  await chrome.tabs.sendMessage(tab.id, {type:"TH_SET_USER_PREF", value: els.toggle.checked}).catch(()=>{});
  refresh();
});

els.overlay.addEventListener('change', async () => {
  const tab = await activeTab();
  await chrome.tabs.sendMessage(tab.id, {type:"TH_SET_OVERLAY_PREF", value: els.overlay.checked}).catch(()=>{});
  // no close; reflect new state immediately
});

function toggleHelp() {
  const open = els.help.classList.toggle('collapsed'); // returns new state (but we used classList.toggle)
  const isCollapsed = els.help.classList.contains('collapsed');
  els.help.setAttribute('aria-expanded', String(!isCollapsed));
}
els.help.addEventListener('click', toggleHelp);
els.help.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelp(); }
});

refresh();
