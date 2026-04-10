// Copyright 2011-2026 Henry A Schimke
// See license.txt for details

// Tracks which tabs should be intercepted by the queue.
// true = intercept this tab when it loads; false = let it load normally.
// Module-level: survives within a service worker session but not across restarts,
// which is appropriate since tab IDs don't survive browser restarts either.
const pendingTabs = new Map();

// All listeners must be registered synchronously at the top level in MV3.
chrome.runtime.onInstalled.addListener((...a) => onInstalled(...a).catch(console.error));
chrome.commands.onCommand.addListener((...a) => onCommand(...a).catch(console.error));
chrome.tabs.onCreated.addListener((...a) => onTabCreated(...a).catch(console.error));
chrome.tabs.onUpdated.addListener((...a) => onTabUpdated(...a).catch(console.error));
chrome.tabs.onRemoved.addListener((...a) => onTabRemoved(...a).catch(console.error));
chrome.bookmarks.onChanged.addListener(() => updateBadge().catch(console.error));
chrome.bookmarks.onChildrenReordered.addListener(() => updateBadge().catch(console.error));
chrome.bookmarks.onCreated.addListener(() => updateBadge().catch(console.error));
chrome.bookmarks.onImportEnded.addListener(() => updateBadge().catch(console.error));
chrome.bookmarks.onMoved.addListener(() => updateBadge().catch(console.error));
chrome.bookmarks.onRemoved.addListener(() => updateBadge().catch(console.error));
chrome.contextMenus.onClicked.addListener((...a) => onContextMenuClicked(...a).catch(console.error));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message ?? String(err) }));
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
    const canvas = new OffscreenCanvas(19, 19);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = enabled ? '#ED1C24' : '#22B14C';
    ctx.fillRect(2, 1, 15, 5);
    ctx.fillRect(2, 7, 15, 5);
    ctx.fillRect(2, 13, 15, 5);
    chrome.action.setIcon({ imageData: ctx.getImageData(0, 0, 19, 19) });
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
    const targetId = nav_target_tab_id ?? null;

    try {
        if (targetId === null) {
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
    } catch (err) {
        console.error('advanceQueue failed:', err);
        return;
    }
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

    if (!tab.url || !/^https?:/.test(tab.url)) {
        pendingTabs.set(tabId, false);
        return;
    }

    await chrome.bookmarks.create({
        parentId: queue_folder_id,
        title: tab.title || tab.url,
        url: tab.url
    });

    pendingTabs.set(tabId, false);
    await chrome.tabs.remove(tabId).catch(console.error);
    await updateBadge();
}

async function onTabRemoved(tabId) {
    const { nav_target_tab_id } = await chrome.storage.local.get('nav_target_tab_id');
    if (tabId === nav_target_tab_id) {
        await chrome.storage.local.set({ nav_target_tab_id: null });
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
