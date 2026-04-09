# BrowseQueue — Manifest V3 Modernization Design

**Date:** 2026-04-09  
**Author:** Henry Schimke

## Overview

BrowseQueue is a queue-based browsing Chrome Extension originally written in 2011 targeting Manifest V1. This document specifies the full rewrite required to bring it up to Manifest V3, the current and only supported extension platform in modern Chrome.

The approach is a **full-pass rewrite** of all files simultaneously. The codebase is small (~300 lines across 5 JS files) and all deprecated patterns are deeply intertwined, making incremental migration impractical and a clean rewrite the lower-risk option.

All existing user-facing behavior is preserved. No new features are added.

## Decisions

### Keyboard Shortcuts → `chrome.commands`

The original extension implemented a fully-configurable keyboard shortcut system: users picked modifier keys and a letter in the options page, a content script listened for keyup events and messaged the background page, which checked the configured binding.

**Decision:** Replace with Chrome's native `chrome.commands` API. Two commands are defined in the manifest with sensible defaults (Ctrl+Shift+E to toggle, Ctrl+Shift+P to advance). Users can customize them via `chrome://extensions/shortcuts` as with any modern extension.

**Why:** The custom system relied on `chrome.extension.sendRequest` (removed in MV3) and a content script injected into every page. `chrome.commands` is the correct modern primitive for this use case.

**If revisiting:** A custom shortcut system could be rebuilt using `chrome.runtime.onMessage` from a content script, but would require careful handling of the service worker's stateless nature and would need to replicate what `chrome.commands` already provides for free. The options page UI (`fill_keybindings`, modifier dropdowns, key inputs) would need to be restored. The decision to use `chrome.commands` should be reconsidered if users need shortcuts that Chrome's command system cannot express (e.g., key sequences, non-modifier combos).

### Storage → `chrome.storage.local` (fresh start)

`localStorage` is unavailable in service workers. All persisted settings (queue folder ID, quick-click mode) move to `chrome.storage.local`. No migration of existing `localStorage` values — the extension has been offline for years and has no active user base to preserve settings for.

### Background Page → Service Worker

`bg.html` + the jQuery dependency are deleted. `bg.js` becomes a standalone service worker registered directly in the manifest. All state previously held in global variables is stored in `chrome.storage.local` and read on demand, since service workers do not persist between events.

### Icon Drawing → Static SVG Files

The background page used `<canvas>` elements to draw red/green icons at runtime. Canvas is unavailable in service workers. Two SVG files replace this: `images/icon-enabled.svg` (red) and `images/icon-disabled.svg` (green). `chrome.action.setIcon({ path: ... })` swaps between them. The existing PNG files in `images/` are kept for the manifest `icons` field (Web Store, `chrome://extensions`).

### jQuery → Removed

jQuery 1.5.2 is deleted. All DOM interaction is rewritten using vanilla JS (`document.querySelector`, `addEventListener`, `createElement`, etc.). No replacement library is introduced.

### Options Page Keyboard Bindings UI → Removed

The modifier key dropdowns and key input fields are removed from the options page. A note replaces them pointing users to `chrome://extensions/shortcuts` for shortcut customization.

## File Changes

### Deleted
- `bg.html` — background page wrapper, replaced by service worker registration in manifest
- `jquery-1.5.2.min.js` — removed entirely
- `keyboard_shortcuts.js` — content script replaced by `chrome.commands`

### Added
- `images/icon-enabled.svg` — red three-bar icon for queue-enabled state
- `images/icon-disabled.svg` — green three-bar icon for queue-disabled state

### Rewritten
- `manifest.json`
- `bg.js`
- `popup.html` + `popup.js`
- `options.html` + `options.js` + `options.css`

## manifest.json

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
  "permissions": ["bookmarks", "tabs", "contextMenus", "storage"],
  "commands": {
    "toggle-queue": {
      "suggested_key": { "default": "Ctrl+Shift+E", "mac": "Command+Shift+E" },
      "description": "Toggle queue capture on/off"
    },
    "advance-queue": {
      "suggested_key": { "default": "Ctrl+Shift+P", "mac": "Command+Shift+P" },
      "description": "Open next item in queue"
    }
  }
}
```

Note: `content_scripts` is removed entirely. No scripts are injected into pages.

## bg.js (Service Worker)

**State** (all in `chrome.storage.local`):
- `queue_folder_id` — bookmark folder ID for the queue
- `queue_enabled` — boolean, whether tab interception is active
- `nav_target_tab_id` — ID of the tab used for queue navigation (-1 if none)
- `use_quick_click_mode` — boolean

**Listeners registered at top level (synchronously):**
- `chrome.runtime.onInstalled` — first-run folder creation, badge/icon init
- `chrome.commands.onCommand` — handles `toggle-queue` and `advance-queue`
- `chrome.tabs.onCreated` — marks new tabs as candidates (when queue enabled)
- `chrome.tabs.onUpdated` — intercepts loading tabs that are candidates
- `chrome.tabs.onRemoved` — clears `nav_target_tab_id` if that tab closes
- `chrome.bookmarks.on*` — updates badge count on any bookmark change
- `chrome.contextMenus.onClicked` — queues a link from context menu
- `chrome.runtime.onMessage` — handles messages from popup and options page

**Tab interception logic** is preserved exactly: `onCreated` marks the tab, `onUpdated` intercepts it on `"loading"` status, creates a bookmark, removes the tab.

**Message protocol** (popup/options → service worker):
- `{ type: "get-state" }` → responds with `{ enabled, queueEmpty, useQuickClick }`
- `{ type: "toggle" }` → toggles queue enabled/disabled, updates icon
- `{ type: "advance" }` → pops next bookmark, opens/navigates tab
- `{ type: "set-folder", folderId }` → updates `queue_folder_id`, refreshes badge
- `{ type: "set-quick-click", value }` → updates `use_quick_click_mode`

**Icon updates:** `chrome.action.setIcon({ path: 'images/icon-enabled.svg' })` when enabled, `icon-disabled.svg` when disabled.

**Badge:** `chrome.action.setBadgeText({ text: count.toString() })` — preserved from original.

**Context menu:** Created in `onInstalled`. Handler uses `chrome.runtime.onMessage` protocol pattern — actually registered directly as `chrome.contextMenus.onClicked` listener.

## popup.html + popup.js

**popup.html:** Two buttons (`#toggle-button`, `#next-button`), no inline scripts, `<script src="popup.js" defer>` at bottom. Styled with embedded CSS for a clean modern popup appearance (fixed width ~200px, proper padding, styled buttons).

**popup.js:** On load, sends `{ type: "get-state" }` to service worker. Uses response to:
- Set toggle button label ("Enable" / "Disable")
- Disable/enable the next button based on queue empty state
- If quick-click mode is on, queue is non-empty, and not currently enabled: auto-call advance

Button clicks send `{ type: "toggle" }` or `{ type: "advance" }` then `window.close()`.

## options.html + options.js + options.css

**options.html:** Two fieldsets: "Queue Folder" (folder dropdown) and "Icon Mode" (quick-click checkbox). A note replaces the keyboard bindings section: *"Keyboard shortcuts can be customized at chrome://extensions/shortcuts"*. Save button. Modern, clean layout.

**options.css:** Full visual refresh — clean sans-serif font, appropriate spacing, styled form controls, neutral color palette matching Chrome extension conventions.

**options.js:** 
- `populate_select()` — unchanged logic, rewritten without jQuery
- `restore_options()` — reads from `chrome.storage.local` instead of `localStorage`
- `save_options()` — writes to `chrome.storage.local`, sends `set-folder` and `set-quick-click` messages to service worker
- Keyboard binding functions (`fill_keybindings`, all `kb_*` variables) — deleted

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Service Worker (bg.js)             │
│                                                     │
│  chrome.commands.onCommand ──► toggle / advance     │
│  chrome.tabs.onCreated/onUpdated ──► intercept      │
│  chrome.bookmarks.on* ──► badge update              │
│  chrome.contextMenus.onClicked ──► queue link       │
│  chrome.runtime.onMessage ──► popup / options msgs  │
│                                                     │
│  State: chrome.storage.local                        │
│    queue_folder_id, queue_enabled,                  │
│    nav_target_tab_id, use_quick_click_mode          │
└───────────────────┬─────────────────────────────────┘
                    │ chrome.runtime.sendMessage
          ┌─────────┴──────────┐
          │                    │
   ┌──────┴───────┐    ┌───────┴──────┐
   │  popup.html  │    │ options.html │
   │  popup.js    │    │ options.js   │
   └──────────────┘    └──────────────┘
```

## Out of Scope

- Adding new features
- Publishing to Chrome Web Store
- Migrating existing user settings (extension has been offline for years)
- Any changes to bookmark data structure or queue folder semantics
