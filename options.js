//  Copyright 2010 Henry A Schimke
//  See license.txt for details

/**
 * Saves options to localStorage.
 */
function save_options_select() {
    var id_hold = $('#folder-list option:selected').val();
    var quick_click_mode = $('#use-quick-click-mode-cb').attr('checked');

    localStorage["queue_folder_id"] = id_hold;
    localStorage["use_quick_click_mode"] = quick_click_mode;

    chrome.extension.getBackgroundPage().title_folder_id = id_hold;
    chrome.extension.getBackgroundPage().set_folder_parent();

    populate_select();
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
 * Initialize the page
 */
function start_up(){
	populate_select();
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
