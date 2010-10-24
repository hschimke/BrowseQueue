// Saves options to localStorage.
function save_options_select() {
  var folder_select = document.getElementById( "folder_list" );
  var quick_click_select = document.getElementById( "use_quick_click_mode_cb" );
  
  var id_hold = folder_select.options[ folder_select.selectedIndex ].value;
  var quick_click_mode = quick_click_select.checked;
  
  localStorage["queue_folder_id"] = id_hold;
  localStorage["use_quick_click_mode"] = quick_click_mode;
  
  chrome.extension.getBackgroundPage().title_folder_id = id_hold;
  chrome.extension.getBackgroundPage().set_folder_parent();
  
  populate_select();
}

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

function add_option_bkmrk( mark ){
	if( mark.id != "0" ){
		if( mark.url == undefined ){
			add_option( mark.title, mark.id );
		}
	}
}

function add_option( opt_text, op_val ){
	var folder_select = document.getElementById( "folder_list" );
				
	var opt = document.createElement( "option" );
	opt.text = opt_text;
	opt.value = op_val;
	folder_select.options.add( opt );
}

function populate_select() {
	document.getElementById( "folder_list" ).options.length = 0;
	chrome.bookmarks.getTree( traverse_bookmarks );
}

function restore_options_2( bkmrk ){
	var folder_select = document.getElementById( "folder_list" );
	
	var total = folder_select.options.length;

	for (var i = 0; i < total; i++) {
		var child = folder_select.options[i];
		if (child.value == bkmrk[0].id) {
			child.selected = "true";
			break;
		}
	}
}

function restore_options() {
	var saved_id = localStorage["queue_folder_id"];
	if (!saved_id) {
		return;
	}
	
	chrome.bookmarks.get( saved_id, restore_options_2 );
}

function start_up(){
	populate_select();
	if( localStorage["use_quick_click_mode"] == true || localStorage["use_quick_click_mode"] == 'true' ){
	    var quick_click_select = document.getElementById( "use_quick_click_mode_cb" );
	    quick_click_select.checked = true;
	}
}

