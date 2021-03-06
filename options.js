//  Copyright 2011 Henry A Schimke
//  See license.txt for details

/**
 * Saves options to localStorage.
 */
function save_options_select() {
    var id_hold = $('#folder-list option:selected').val();
    var quick_click_mode = $('#use-quick-click-mode-cb').attr('checked');

    localStorage["queue_folder_id"] = id_hold;
    localStorage["use_quick_click_mode"] = quick_click_mode;
    
    // Keyboard Bindings
    var kb_a_mod_1 = $('#kb-binding-a-mod-1 option:selected').val();
    var kb_a_mod_2 = $('#kb-binding-a-mod-2 option:selected').val();
    var kb_a_key = $('#kb-binding-a-key').val();
    
    var kb_b_mod_1 = $('#kb-binding-b-mod-1 option:selected').val();
    var kb_b_mod_2 = $('#kb-binding-b-mod-2 option:selected').val();
    var kb_b_key = $('#kb-binding-b-key').val();
    
    localStorage["kb_a_mod_1"] = kb_a_mod_1;
    localStorage["kb_a_mod_2"] = kb_a_mod_2;
    localStorage["kb_a_key"] = kb_a_key;
    
    localStorage["kb_b_mod_1"] = kb_b_mod_1;
    localStorage["kb_b_mod_2"] = kb_b_mod_2;
    localStorage["kb_b_key"] = kb_b_key;

    // Update bg script settings
    chrome.extension.getBackgroundPage().title_folder_id = id_hold;
    chrome.extension.getBackgroundPage().set_folder_parent();
    
    // Reset folder list drop down
    populate_select();
    // Reset custom keybindings display
    fill_keybindings();
}

/**
 * Recurse over bookmarks and add folders to the dropdown list
 */
function traverse_bookmarks( results ){
	for (var j = 0; j < results.length; j++) {
		var res = results[j];
		
		add_option_bkmrk( res );
		
		chrome.bookmarks.getChildren( res.id, traverse_bookmarks );
	}
	
	if( results.length == 0 ){
		restore_options();
	}
}

/**
 * If a bookmark is a folder (has no url) add it to the dropdown list
 */
function add_option_bkmrk( mark ){
	if( mark.id != "0" ){
		if( mark.url == undefined ){
			add_option( mark.title, mark.id );
		}
	}
}

/**
 * Add an option to the folder-list dropdown box
 * @param {String} opt_text Text for the new item in the dropdown list
 * @param {String} opt_val Select value for the new item in the dropdown list
 */
function add_option( opt_text, opt_val ) {
    $('<option></option>', {
        'value': opt_val,
        'text': opt_text
    }).appendTo( $('#folder-list') );
}

/**
 * Clear and then fill the folder-list dropdown list with bookmarks
 */
function populate_select() {
	$('#folder-list').html("");
	chrome.bookmarks.getTree( traverse_bookmarks );
}

/**
 * Set the source folder for queued links in the dropdown list
 */
function restore_options_2( bkmrk ){
    $('#folder-list').val( bkmrk[0].id );
}

/**
 * If a folder has been saved, load the select optoins and set the selected folder
 */
function restore_options() {
	var saved_id = localStorage["queue_folder_id"];
	if (!saved_id) {
		return;
	}
	
	chrome.bookmarks.get( saved_id, restore_options_2 );
}

/**
 * Fill saved custom keybindings, or load the defaults.
 */
function fill_keybindings() {
    var kb_a_mod_1 = localStorage.getItem("kb_a_mod_1");
    var kb_a_mod_2 = localStorage.getItem("kb_a_mod_2");
    var kb_a_key = localStorage.getItem("kb_a_key");
    
    var kb_b_mod_1 = localStorage.getItem("kb_b_mod_1");
    var kb_b_mod_2 = localStorage.getItem("kb_b_mod_2");
    var kb_b_key = localStorage.getItem("kb_b_key");
    
    if( kb_a_mod_1 === null ){
        kb_a_mod_1 = "ctrl";
    }
    if( kb_a_mod_2 === null ){
        kb_a_mod_2 = "shift";
    }
    if( kb_a_key === null ){
        kb_a_key = "E";
    }
    
    if( kb_b_mod_1 === null ){
        kb_b_mod_1 = "ctrl";
    }
    if( kb_b_mod_2 === null ){
        kb_b_mod_2 = "shift";
    }
    if( kb_b_key === null ){
        kb_b_key = "P";
    }
    
    // Clean and validate A
    if( kb_a_mod_1 == "none" && kb_a_mod_2 == "none" ){
        kb_a_mod_1 = "ctrl";
        kb_a_mod_2 = "shift";
    }
    if( kb_a_mod_1 == kb_a_mod_2 ){
        kb_a_mod_2 = "none";
    }
    if( kb_a_key == "" || kb_a_key == " " ){
        kb_a_key = "E";
    }
    
    // Clean and validate B
    if( kb_b_mod_1 == "none" && kb_b_mod_2 == "none" ){
        kb_b_mod_1 = "ctrl";
        kb_b_mod_2 = "shift";
    }
    if( kb_b_mod_1 == kb_b_mod_2 ){
        kb_b_mod_2 = "none";
    }
    if( kb_b_key == "" || kb_b_key == " " ){
        kb_b_key = "P";
    }
    
    // Verify not identical
    if( (kb_a_mod_1 == kb_b_mod_1) && (kb_a_mod_2 == kb_b_mod_2) && (kb_a_key == kb_b_key) ){
        kb_a_key = "E";
        kb_b_key = "P";
    }
    
    $('#kb-binding-a-mod-1').val(kb_a_mod_1);
    $('#kb-binding-a-mod-2').val(kb_a_mod_2);
    $('#kb-binding-a-key').val(kb_a_key);

    $('#kb-binding-b-mod-1').val(kb_b_mod_1);
    $('#kb-binding-b-mod-2').val(kb_b_mod_2);
    $('#kb-binding-b-key').val(kb_b_key);
}

/**
 * Initialize the page
 */
function start_up(){
	populate_select();
    fill_keybindings();
	if( localStorage["use_quick_click_mode"] == true || localStorage["use_quick_click_mode"] == 'true' ) {
	    $('#use-quick-click-mode-cb').attr("checked", true);
//	    quick_click_select.checked = true;
	}
}

$(function() {
    start_up();
    $('#save-button').click(
        function() {
            save_options_select();
        } );
});
