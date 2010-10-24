var enable_disable_function = function() {
		chrome.extension.getBackgroundPage().en_dis_func();
		window.close();
	};
var queue_pop_function = function() { 
		chrome.extension.getBackgroundPage().getNextBookmark();
		window.close();
	};

function startup(){
	var en_n = chrome.extension.getBackgroundPage().enable_next_button;
	if( !en_n ){
		document.getElementById( "pn" ).disabled = true;
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
