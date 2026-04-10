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
