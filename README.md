# Bring-Back-Reasoning

Force the **GPT-5 (normal)** router to reason about its answers by appending a tiny instruction to your message — only when the correct model is selected.

> When enabled, the extension adds
> `think really HARD! about this one.`
> to the end of the message **right before send** (Enter), but **only** on GPT-5 (normal).
> It auto-disables on other models (e.g., *GPT-5 Thinking*).

---

## Highlights

* ✅ **GPT-5-only gate** — auto-enables on **GPT-5 (normal)**, auto-disables everywhere else
* 🧠 **One-line nudge** — appends the instruction only when you send (no double-appends)
* 🎛️ **Two ways to control it**

  * Floating on-page switch (can be hidden)
  * Toolbar popup (status, toggle, and help)
* 🫥 **Smart fade** — if you linger on an unsupported model, the on-page switch fades after 30s; it reappears when you switch back to GPT-5
* ♿ **Works with the new Lexical composer** (contenteditable) and textarea fallback
* 🔒 **Private** — no network calls, no analytics; settings sync via Chrome’s `storage.sync`

---

## Install (unpacked)

These steps match the Chrome “Hello World” flow you’re used to.

1. **Download** or `git clone` this repo.
2. Open Chrome and go to `chrome://extensions`.
3. Switch **Developer mode** on (top right).
4. Click **Load unpacked** and pick the project folder.
5. Pin the extension from the puzzle icon so its toolbar button shows.
6. Open ChatGPT, select **GPT-5 (normal)**, and try it.

> Tip: the toolbar popup shows live status (model + enabled/disabled).
> The on-page switch lives at the bottom-right of ChatGPT.

## Install from Chrome Web Store (coming soon)

This section will be updated once the extension is published on the Chrome Web Store.

---

## Usage

* **Enable/disable**: use the on-page switch or the toolbar popup.
* **Hide the on-page switch**: open the popup → toggle **“Show on-page switch”** off.
  (The feature still works; you just don’t see the floating UI.)
* **Newline vs send**: **Enter** sends (and appends). **Shift+Enter** inserts a newline.

---

## Screens & Behavior

* **On GPT-5 (normal)** → appender allowed; your toggle state applies.
* **On GPT-5 Thinking or other models** → appender is locked off; on-page switch shows a note and fades after \~30s.

Switching models updates instantly (route change hook + DOM watch + light polling).

---

## Folder structure

```
Bring-Back-Reasoning/
├── content.js
├── styles.css
├── popup.html
├── popup.css
├── popup.js
├── route-hook.js
├── manifest.json
└── icons/
    ├── logo-16.png
    ├── logo-32.png
    ├── logo-48.png
    └── logo-128.png
```

---

## Permissions

```json
"permissions": ["storage"],
"host_permissions": [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*"
]
```

* **storage** — to remember your toggles (`thinkHardEnabled`, `thinkHardShowOverlay`)
* **host\_permissions** — to run on ChatGPT pages only

No data leaves your machine.

---

## How it works (nerdy notes)

* Finds the ChatGPT composer (Lexical `contenteditable` or `<textarea>` fallback).
* On **Enter** (or clicking Send/Submit) it appends the instruction once, using safe text insertion that triggers Lexical/React events.
* Detects the current model from the **URL** (`?model=gpt-5` vs `gpt-5-thinking`) and from **visible labels** as a fallback.
* Listens for model changes via:

  * a **page-world route hook** (`route-hook.js`, injected as a file to satisfy CSP),
  * a DOM observer,
  * global clicks/visibility change,
  * a small **poll** (\~1s).

---

## Roadmap

* Optional custom instruction text
* Per-chat enablement
* Keyboard shortcut to toggle

---

## License

**MIT** — do anything, just keep the copyright & license notice.
Branding & icons © 2025 **test\_tm7873**. All rights reserved.

---

## Credits

Made by **@test\_tm7873** on X.
Thanks to everyone who still wants models to… **Think HARD!** 🐈‍⬛
