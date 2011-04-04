//  Copyright 2011 Henry A Schimke
//  See license.txt for details

/**
 * Handle enable/disable button click by calling to background page function
 */
function enable_disable_function() {
	chrome.extension.getBackgroundPage().en_dis_func();
	window.close();
}

/**
 * Handle next button click by calling the background page function
 */
function queue_pop_function() { 
	chrome.extension.getBackgroundPage().getNextBookmark();
	window.close();
}

/**
 * Initialize the popup
 */
function startup(){
	var en_n = chrome.extension.getBackgroundPage().enable_next_button;
	if( !en_n ){
	    $('#next-button').attr( 'disabled', true );
	}
	
	if( localStorage["use_quick_click_mode"] == true || localStorage["use_quick_click_mode"] == 'true' ){
	    // #Martin_Weik -- Begin
	    var click_ref = chrome.extension.getBackgroundPage().click_ref;
	    if(en_n && !click_ref) {
		    //directly open next element
		    queue_pop_function();
	    }
	    // #Martin_Weik -- End
    }
}

$(function() {
    startup();
    $('#enable-disable-button').click(
        function() {
            enable_disable_function();
        } );
    $('#next-button').click( 
        function() {
            queue_pop_function();
        } );
});
