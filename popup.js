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
