//  Copyright 2011 Henry A Schimke
//  See license.txt for details

// Add a keyboard listener on keyup.
if (window == top) {
  window.addEventListener("keyup", keyListener, false);
}
 
// Keyboard keyup listener callback.
function keyListener(e) {
    if (e.keyCode != 16 && e.keyCode != 17 && e.keyCode != 18) {
                chrome.extension.sendRequest({
                code: e.keyCode,
                alt: e.altKey,
                shift: e.shiftKey,
                ctrl: e.ctrlKey
            });
    }
}