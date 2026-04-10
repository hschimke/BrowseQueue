# BrowseQueue MV3 Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite BrowseQueue as a Manifest V3 Chrome Extension, replacing all deprecated APIs and removing jQuery, while preserving all existing user-facing behavior.

**Architecture:** The background page (`bg.html` + `bg.js`) is replaced by a standalone service worker (`bg.js`). All state moves from `localStorage` to `chrome.storage.local`. Communication between popup/options and the service worker uses `chrome.runtime.sendMessage`. Keyboard shortcuts use `chrome.commands` instead of a custom content script system.

**Tech Stack:** Vanilla JS (ES2020+), Chrome Extension APIs (MV3), SVG icons, `chrome.storage.local`, `chrome.commands`, `chrome.runtime.onMessage`.

**Testing note:** Chrome Extensions have no traditional unit test runner. Each task ends with a manual verification step: load the extension unpacked at `chrome://extensions` (Developer mode → Load unpacked → select the repo root). Re-load the extension between tasks using the refresh icon on the extension card.

---

### Task 1: Delete obsolete files, create SVG icons

**Files:**
- Delete: `bg.html`
- Delete: `jquery-1.5.2.min.js`
- Delete: `jquery-1.4.3.min.js`
- Delete: `keyboard_shortcuts.js`
- Create: `images/icon-enabled.svg`
- Create: `images/icon-disabled.svg`

- [ ] **Step 1: Delete obsolete files**

```bash
git rm bg.html jquery-1.5.2.min.js jquery-1.4.3.min.js keyboard_shortcuts.js
```

Expected output:
```
rm 'bg.html'
rm 'jquery-1.4.3.min.js'
rm 'jquery-1.5.2.min.js'
rm 'keyboard_shortcuts.js'
```

- [ ] **Step 2: Create the disabled (green) SVG icon**

Create `images/icon-disabled.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 19">
  <rect x="2" y="1" width="15" height="5" fill="#22B14C"/>
  <rect x="2" y="7" width="15" height="5" fill="#22B14C"/>
  <rect x="2" y="13" width="15" height="5" fill="#22B14C"/>
</svg>
```

- [ ] **Step 3: Create the enabled (red) SVG icon**

Create `images/icon-enabled.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 19">
  <rect x="2" y="1" width="15" height="5" fill="#ED1C24"/>
  <rect x="2" y="7" width="15" height="5" fill="#ED1C24"/>
  <rect x="2" y="13" width="15" height="5" fill="#ED1C24"/>
</svg>
```

These colors match the original canvas drawing: `#22B14C` (green, queue off) and `#ED1C24` (red, queue on).

- [ ] **Step 4: Commit**

```bash
git add images/icon-enabled.svg images/icon-disabled.svg
git commit -m "chore: remove obsolete files, add SVG action icons"
```

---

### Task 2: Rewrite manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Replace the entire contents of manifest.json**

```json
{
    "manifest_version": 3,
    "name": "__MSG_extName__",
    "version": "2.0.0",
    "description": "__MSG_extension_description__",
    "default_locale": "en_US",
    "background": {
        "service_worker": "bg.js"
    },
    "action": {
        "default_title": "__MSG_browser_action_tooltip__",
        "default_popup": "popup.html",
        "default_icon": "images/icon-disabled.svg"
    },
    "options_ui": {
        "page": "options.html",
        "open_in_tab": true
    },
    "icons": {
        "16": "images/disp_ico_16.png",
        "48": "images/disp_ico_48.png",
        "128": "images/disp_ico_128.png"
    },
    "permissions": [
        "bookmarks",
        "tabs",
        "contextMenus",
        "storage"
    ],
    "commands": {
        "toggle-queue": {
            "suggested_key": {
                "default": "Ctrl+Shift+E",
                "mac": "Command+Shift+E"
            },
            "description": "Toggle queue capture on/off"
        },
        "advance-queue": {
            "suggested_key": {
                "default": "Ctrl+Shift+P",
                "mac": "Command+Shift+P"
            },
            "description": "Open next item in queue"
        }
    }
}
```

Key changes from the original:
- `manifest_version`: 1 → 3
- `background_page` → `background.service_worker`
- `browser_action` → `action`
- `options_page` → `options_ui`
- Added `storage` permission (required for `chrome.storage.local`)
- Added `commands` block (replaces custom keyboard shortcut system)
- Removed `content_scripts` entirely (`keyboard_shortcuts.js` is gone)

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat: upgrade to Manifest V3"
```

---

### Task 3: Rewrite bg.js as a service worker

**Files:**
- Modify: `bg.js`

This is the core of the migration. The entire file is replaced. Key design points:
- All event listeners registered synchronously at the top level (MV3 requirement)
- State stored in `chrome.storage.local` (service workers don't persist globals across restarts)
- Module-level `pendingTabs` Map tracks tab interception candidates within a service worker session (appropriate: tab IDs don't outlive a browser session anyway)
- `chrome.commands.onCommand` replaces the content script keyboard system
- `chrome.runtime.onMessage` listener returns `true` and uses `.then(sendResponse)` for async replies (required MV3 pattern)

- [ ] **Step 1: Replace the entire contents of bg.js**

```javascript
// Copyright 2011-2026 Henry A Schimke
// See license.txt for details

// Tracks which tabs should be intercepted by the queue.
// true = intercept this tab when it loads; false = let it load normally.
// Module-level: survives within a service worker session but not across restarts,
// which is appropriate since tab IDs don't survive browser restarts either.
const pendingTabs = new Map();

// All listeners must be registered synchronously at the top level in MV3.
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.commands.onCommand.addListener(onCommand);
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.tabs.onRemoved.addListener(onTabRemoved);
chrome.bookmarks.onChanged.addListener(updateBadge);
chrome.bookmarks.onChildrenReordered.addListener(updateBadge);
chrome.bookmarks.onCreated.addListener(updateBadge);
chrome.bookmarks.onImportEnded.addListener(updateBadge);
chrome.bookmarks.onMoved.addListener(updateBadge);
chrome.bookmarks.onRemoved.addListener(updateBadge);
chrome.contextMenus.onClicked.addListener(onContextMenuClicked);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // keep message channel open for async response
});

async function onInstalled() {
    chrome.contextMenus.create({
        id: 'queue-link',
        type: 'normal',
        title: 'Queue Link',
        contexts: ['link']
    });

    const { queue_folder_id } = await chrome.storage.local.get('queue_folder_id');
    if (!queue_folder_id) {
        await createDefaultFolder();
    }

    updateIcon(false);
    await updateBadge();
}

async function createDefaultFolder() {
    const [root] = await chrome.bookmarks.getTree();
    const otherBookmarks = root.children.find(c => c.title === 'Other bookmarks')
        ?? root.children.find(c => c.id === '2')
        ?? root.children[0];

    const folder = await chrome.bookmarks.create({
        parentId: otherBookmarks.id,
        title: 'Browse Queue'
    });
    await chrome.storage.local.set({ queue_folder_id: folder.id });
}

async function updateBadge() {
    const { queue_folder_id } = await chrome.storage.local.get('queue_folder_id');
    if (!queue_folder_id) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }
    const children = await chrome.bookmarks.getChildren(queue_folder_id);
    chrome.action.setBadgeText({ text: children.length > 0 ? children.length.toString() : '' });
}

function updateIcon(enabled) {
    chrome.action.setIcon({
        path: enabled ? 'images/icon-enabled.svg' : 'images/icon-disabled.svg'
    });
}

async function onCommand(command) {
    if (command === 'toggle-queue') {
        await toggleQueue();
    } else if (command === 'advance-queue') {
        await advanceQueue();
    }
}

async function toggleQueue() {
    const { queue_enabled } = await chrome.storage.local.get('queue_enabled');
    const newState = !queue_enabled;
    await chrome.storage.local.set({ queue_enabled: newState });
    updateIcon(newState);
}

async function advanceQueue() {
    const { queue_folder_id, nav_target_tab_id } =
        await chrome.storage.local.get(['queue_folder_id', 'nav_target_tab_id']);
    if (!queue_folder_id) return;

    const children = await chrome.bookmarks.getChildren(queue_folder_id);
    if (children.length === 0) return;

    const next = children[0];
    const targetId = nav_target_tab_id ?? -1;

    if (targetId === -1) {
        const tab = await chrome.tabs.create({ url: next.url });
        // Mark this tab so onTabCreated/onTabUpdated don't intercept it.
        // Setting before onTabCreated fires is safe: chrome.tabs.create's
        // promise resolves before the event fires in the same SW context.
        pendingTabs.set(tab.id, false);
        await chrome.storage.local.set({ nav_target_tab_id: tab.id });
    } else {
        await chrome.tabs.update(targetId, { url: next.url });
    }

    await chrome.bookmarks.remove(next.id);
    await updateBadge();
}

async function onTabCreated(tab) {
    const { queue_enabled } = await chrome.storage.local.get('queue_enabled');
    if (!queue_enabled) return;
    if (tab.url && tab.url.startsWith('chrome://')) return;
    if (pendingTabs.get(tab.id) === false) return; // our navigation tab

    pendingTabs.set(tab.id, true);
}

async function onTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status !== 'loading') return;
    if (pendingTabs.get(tabId) !== true) return;

    const { queue_folder_id } = await chrome.storage.local.get('queue_folder_id');
    if (!queue_folder_id) return;

    await chrome.bookmarks.create({
        parentId: queue_folder_id,
        title: tab.title || tab.url,
        url: tab.url
    });

    pendingTabs.set(tabId, false);
    chrome.tabs.remove(tabId);
    await updateBadge();
}

async function onTabRemoved(tabId) {
    const { nav_target_tab_id } = await chrome.storage.local.get('nav_target_tab_id');
    if (tabId === nav_target_tab_id) {
        await chrome.storage.local.set({ nav_target_tab_id: -1 });
    }
    pendingTabs.delete(tabId);
}

async function onContextMenuClicked(info) {
    const { queue_folder_id } = await chrome.storage.local.get('queue_folder_id');
    if (!queue_folder_id) return;

    await chrome.bookmarks.create({
        parentId: queue_folder_id,
        title: info.linkUrl,
        url: info.linkUrl
    });
    await updateBadge();
}

async function handleMessage(message) {
    switch (message.type) {
        case 'get-state': {
            const data = await chrome.storage.local.get([
                'queue_enabled', 'queue_folder_id', 'use_quick_click_mode'
            ]);
            let queueEmpty = true;
            if (data.queue_folder_id) {
                const children = await chrome.bookmarks.getChildren(data.queue_folder_id);
                queueEmpty = children.length === 0;
            }
            return {
                enabled: !!data.queue_enabled,
                queueEmpty,
                useQuickClick: !!data.use_quick_click_mode
            };
        }
        case 'toggle': {
            await toggleQueue();
            const { queue_enabled } = await chrome.storage.local.get('queue_enabled');
            return { enabled: !!queue_enabled };
        }
        case 'advance': {
            await advanceQueue();
            return { success: true };
        }
        case 'set-folder': {
            await chrome.storage.local.set({ queue_folder_id: message.folderId });
            await updateBadge();
            return { success: true };
        }
        case 'set-quick-click': {
            await chrome.storage.local.set({ use_quick_click_mode: message.value });
            return { success: true };
        }
        default:
            return { error: 'unknown message type' };
    }
}
```

- [ ] **Step 2: Load the extension in Chrome and verify the service worker starts**

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the repo root directory
4. The extension card should appear with no errors
5. Click the **Service worker** link on the extension card — DevTools opens showing the SW console
6. Verify no red error badges on the extension card

- [ ] **Step 3: Verify core queue behavior**

1. Click the extension icon in the toolbar — popup should open (may be unstyled, that's fine)
2. Right-click any link on a webpage — "Queue Link" should appear in the context menu
3. Click "Queue Link" — the badge count on the extension icon should increment to 1
4. Confirm no uncaught errors in the service worker DevTools console

- [ ] **Step 4: Commit**

```bash
git add bg.js
git commit -m "feat: replace background page with MV3 service worker"
```

---

### Task 4: Rewrite popup.html and popup.js

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`

- [ ] **Step 1: Replace popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      background: #fff;
      padding: 12px;
      min-width: 180px;
    }
    .button-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    button {
      width: 100%;
      padding: 8px 16px;
      border: 1px solid #dadce0;
      border-radius: 6px;
      background: #f8f9fa;
      color: #202124;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
    }
    button:hover:not(:disabled) { background: #e8eaed; }
    button:disabled { opacity: 0.45; cursor: default; }
  </style>
</head>
<body>
  <div class="button-group">
    <button id="toggle-button"></button>
    <button id="next-button"></button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Replace popup.js**

```javascript
// Copyright 2011-2026 Henry A Schimke
// See license.txt for details

document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggle-button');
    const nextBtn = document.getElementById('next-button');

    const state = await chrome.runtime.sendMessage({ type: 'get-state' });

    toggleBtn.textContent = state.enabled
        ? chrome.i18n.getMessage('disable_button_text')
        : chrome.i18n.getMessage('enable_button_text');

    nextBtn.textContent = chrome.i18n.getMessage('next_button_text');
    nextBtn.disabled = state.queueEmpty;

    // Quick click mode: if the queue has items and capture is off, auto-advance.
    if (state.useQuickClick && !state.queueEmpty && !state.enabled) {
        await chrome.runtime.sendMessage({ type: 'advance' });
        window.close();
        return;
    }

    toggleBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'toggle' });
        window.close();
    });

    nextBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'advance' });
        window.close();
    });
});
```

- [ ] **Step 3: Load the extension and verify the popup**

1. Reload the extension at `chrome://extensions`
2. Click the extension toolbar icon
3. Popup should open showing two buttons: **Enable** and **Next**
4. **Next** button should be disabled if the queue is empty
5. Click **Enable** — popup closes, toolbar icon should switch to the red SVG
6. Open a new tab to any URL — the tab should close immediately and badge count increments
7. Click the toolbar icon again → buttons should read **Disable** and **Next** (Next now enabled)
8. Click **Next** — a new tab should open with the queued URL and badge decrements

- [ ] **Step 4: Commit**

```bash
git add popup.html popup.js
git commit -m "feat: rewrite popup with vanilla JS and modern styling"
```

---

### Task 5: Rewrite options.html, options.js, and options.css

**Files:**
- Modify: `options.html`
- Modify: `options.js`
- Modify: `options.css`

- [ ] **Step 1: Replace options.css**

```css
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #202124;
    background: #f8f9fa;
    min-height: 100vh;
}

.container {
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 24px;
}

h1 {
    font-size: 22px;
    font-weight: 400;
    color: #202124;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e8eaed;
}

h2 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #5f6368;
    margin-bottom: 12px;
}

section {
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
}

section p {
    color: #5f6368;
    margin-bottom: 12px;
    line-height: 1.5;
}

select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    color: #202124;
    background: #fff;
    cursor: pointer;
}

select:focus {
    outline: none;
    border-color: #1a73e8;
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    line-height: 1.5;
}

.checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    cursor: pointer;
    accent-color: #1a73e8;
}

.shortcuts-table {
    width: 100%;
    border-collapse: collapse;
}

.shortcuts-table td {
    padding: 5px 0;
    color: #3c4043;
}

.shortcuts-table td:last-child {
    text-align: right;
}

kbd {
    display: inline-block;
    padding: 2px 8px;
    font-family: monospace;
    font-size: 12px;
    background: #f1f3f4;
    border: 1px solid #dadce0;
    border-radius: 4px;
    color: #3c4043;
}

a {
    color: #1a73e8;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

#save-button {
    padding: 10px 24px;
    background: #1a73e8;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
}

#save-button:hover { background: #1557b0; }
#save-button:active { background: #0d47a1; }

footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e8eaed;
}

footer p {
    font-size: 12px;
    color: #9aa0a6;
    margin-bottom: 4px;
    line-height: 1.5;
}
```

- [ ] **Step 2: Replace options.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Browse Queue Options</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <h1>Browse Queue</h1>

    <section>
      <h2>Queue Folder</h2>
      <p>Select the bookmarks folder used to store queued links.</p>
      <select id="folder-list"></select>
    </section>

    <section>
      <h2>Behavior</h2>
      <label class="checkbox-label">
        <input type="checkbox" id="use-quick-click-mode-cb">
        Use Quick Click Mode
      </label>
    </section>

    <section>
      <h2>Keyboard Shortcuts</h2>
      <p>
        Shortcuts can be customized at
        <a href="chrome://extensions/shortcuts">chrome://extensions/shortcuts</a>.
      </p>
      <table class="shortcuts-table">
        <tr>
          <td>Toggle queue capture</td>
          <td><kbd>Ctrl+Shift+E</kbd></td>
        </tr>
        <tr>
          <td>Advance queue</td>
          <td><kbd>Ctrl+Shift+P</kbd></td>
        </tr>
      </table>
    </section>

    <button id="save-button">Save</button>

    <footer>
      <p>Unless otherwise noted, code and layout Copyright 2011&ndash;2026 Henry A Schimke.</p>
      <p>Quick Click Mode contributed by Martin Weik. Loading event suggestion by Rafa&#322; Miko&#322;ajczak.</p>
    </footer>
  </div>
  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 3: Replace options.js**

```javascript
// Copyright 2011-2026 Henry A Schimke
// See license.txt for details

function traverseBookmarks(select, nodes) {
    for (const node of nodes) {
        if (node.id !== '0' && !node.url) {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.title;
            select.appendChild(option);
        }
        if (node.children) {
            traverseBookmarks(select, node.children);
        }
    }
}

async function populateSelect() {
    const select = document.getElementById('folder-list');
    select.replaceChildren(); // clear existing options safely

    const [root] = await chrome.bookmarks.getTree();
    traverseBookmarks(select, root.children);

    const { queue_folder_id } = await chrome.storage.local.get('queue_folder_id');
    if (queue_folder_id) {
        select.value = queue_folder_id;
    }
}

async function saveOptions() {
    const folderId = document.getElementById('folder-list').value;
    const quickClick = document.getElementById('use-quick-click-mode-cb').checked;

    await chrome.storage.local.set({
        queue_folder_id: folderId,
        use_quick_click_mode: quickClick
    });

    await chrome.runtime.sendMessage({ type: 'set-folder', folderId });
    await chrome.runtime.sendMessage({ type: 'set-quick-click', value: quickClick });

    await populateSelect();
}

document.addEventListener('DOMContentLoaded', async () => {
    await populateSelect();

    const { use_quick_click_mode } = await chrome.storage.local.get('use_quick_click_mode');
    document.getElementById('use-quick-click-mode-cb').checked = !!use_quick_click_mode;

    document.getElementById('save-button').addEventListener('click', saveOptions);
});
```

- [ ] **Step 4: Load the extension and verify the options page**

1. Reload the extension at `chrome://extensions`
2. Right-click the toolbar icon → **Options**
3. The options page should open in a new tab with clean modern styling
4. The folder dropdown should be populated with all bookmark folders, with "Browse Queue" selected
5. Change the folder, enable quick click mode, click **Save**
6. Reload the options page — saved values should be restored
7. The Keyboard Shortcuts section should show the note and a read-only table (no editable fields)

- [ ] **Step 5: Commit**

```bash
git add options.html options.js options.css
git commit -m "feat: rewrite options page with vanilla JS, chrome.storage.local, and modern styling"
```

---

### Task 6: Update Makefile and final verification

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Replace the Makefile**

```makefile
BUILDDIR := build
IMGDIR := images
LOCALESDIR := _locales
IMGBUILDDIR := $(BUILDDIR)/$(IMGDIR)
LOCALESBUILDDIR := $(BUILDDIR)/$(LOCALESDIR)
images := disp_ico_16.png disp_ico_48.png disp_ico_128.png icon-enabled.svg icon-disabled.svg
static := license.txt
css := options.css
js := bg.js options.js popup.js
html := options.html popup.html
manifest := manifest.json

collect : $(images) $(static) $(css) $(js) $(html) $(manifest) | $(BUILDDIR)

release : clean collect
	cd $(BUILDDIR) && zip -r -9 ../../BrowseQueue-`git describe --tags`.zip .

$(BUILDDIR) :
	mkdir $(BUILDDIR)

$(IMGBUILDDIR) : | $(BUILDDIR)
	mkdir $(IMGBUILDDIR)

$(LOCALESBUILDDIR) : | $(BUILDDIR)
	mkdir $(LOCALESBUILDDIR)

$(images) : | $(IMGBUILDDIR)
	cp $(IMGDIR)/$@ $(IMGBUILDDIR)/$@

$(static) : | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(css) : | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(js) : locales | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(html) : $(js) $(css) | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(manifest) : locales | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

locales : | $(LOCALESBUILDDIR)
	cp --recursive $(LOCALESDIR)/ $(BUILDDIR)/

.PHONY : clean
clean :
	-rm -r $(BUILDDIR)
```

- [ ] **Step 2: Verify the build runs cleanly**

```bash
make release
```

Expected: No errors. A `.zip` file is created in the parent directory. The zip should contain: `bg.js`, `popup.html`, `popup.js`, `options.html`, `options.js`, `options.css`, `manifest.json`, `license.txt`, `images/` (both SVGs and PNGs), `_locales/`.

- [ ] **Step 3: Full end-to-end verification**

Load the extension from the repo root and verify all behaviors:

1. **Install:** Extension loads with no errors at `chrome://extensions`
2. **Badge:** Badge shows correct count (or blank if queue is empty)
3. **Icon:** Toolbar shows green icon (disabled state) on fresh install
4. **Enable via popup:** Click toolbar icon → Enable → icon turns red
5. **Tab interception:** With queue enabled, open a new tab to any URL — tab closes immediately, badge increments
6. **Disable via popup:** Click toolbar icon → Disable → icon turns green
7. **Advance queue:** Click toolbar icon → Next → queued URL opens in new tab, badge decrements
8. **Keyboard toggle:** Press Ctrl+Shift+E (Cmd+Shift+E on Mac) → icon toggles state
9. **Keyboard advance:** Press Ctrl+Shift+P (Cmd+Shift+P on Mac) → queue advances
10. **Context menu:** Right-click a link → Queue Link → badge increments
11. **Options page:** Right-click toolbar icon → Options → page opens cleanly, folder dropdown populated, save persists settings

- [ ] **Step 4: Commit**

```bash
git add Makefile
git commit -m "chore: update Makefile for MV3 file set"
```
