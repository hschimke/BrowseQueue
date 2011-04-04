//  Copyright 2010 Henry A Schimke
//  See license.txt for details

var click_ref = false;
var page_ids = new Array();
var title_folder_id = -1;
var nav_target_tab_id = -1;
var EnDisButtonText = chrome.i18n.getMessage("enable_button_text");
var NextButtonMessage = chrome.i18n.getMessage("next_button_text");
var enable_next_button = true;
var title_desired = localStorage["queue_folder_name"];
var tmp_title_id_hold = localStorage["queue_folder_id"];

function updateBABadgeCount() {
	chrome.bookmarks.getChildren(title_folder_id, function ( results ){
			chrome.browserAction.setBadgeText( { "text": results.length.toString() } );
			if( results.length <= 0 ){
				enable_next_button = false;
			}else{
				enable_next_button = true;
			}
		});
}

function set_folder_parent() {
	updateBABadgeCount();
}

function en_dis_func() {
	click_ref = !click_ref;
	if( click_ref ){
		var ctx2 = $("#canvas-red")[0].getContext("2d");
		
		img_dta = ctx2.getImageData(0, 0, 19, 19)
		chrome.browserAction.setIcon( { "imageData": img_dta } );

		chrome.tabs.onCreated.addListener( the_on_created_function );
		chrome.tabs.onUpdated.addListener( the_on_updated_function );
		EnDisButtonText = chrome.i18n.getMessage("disable_button_text");
	}else{
		var ctx = $("#canvas-green")[0].getContext("2d");
		
		img_dta = ctx.getImageData(0, 0, 19, 19)
		chrome.browserAction.setIcon( { "imageData": img_dta } );
		
		chrome.tabs.onCreated.removeListener( the_on_created_function );
		chrome.tabs.onUpdated.removeListener( the_on_updated_function );
		EnDisButtonText = chrome.i18n.getMessage("enable_button_text");
	}
}

function the_on_created_function(tab) { 
	if( tab.url.indexOf('chrome://') != -1 ){
	}else{
		if( page_ids[tab.id] == false ) {
		}else{
			page_ids[tab.id] = true;
		}
	}
}

function the_on_updated_function(tabId, changeInfo, tab) { 
	if( page_ids[tabId] != undefined && page_ids[tabId] == true ){
		if( tab.status == "loading" ){
			chrome.bookmarks.create(
						{'parentId': title_folder_id,
						 'title': tab.title,
						 'url': tab.url},
					 function( res ) { 
						updateBABadgeCount();
					});
			page_ids[tabId] = false;
			chrome.tabs.remove( tabId );
		}else{
		}
	}
}

function getNextBookmark() {
	chrome.bookmarks.getChildren( title_folder_id, function( results ) {
		if( results.length > 0 ){
			if( nav_target_tab_id == -1 ){
				chrome.tabs.create({'url':results[0].url}, function( tab ) {
					page_ids[tab.id] = false;
					nav_target_tab_id = tab.id;
				});
			}else{
				chrome.tabs.update(nav_target_tab_id, {'url':results[0].url} );
			}
			chrome.bookmarks.remove( results[0].id, function() { updateBABadgeCount(); } );
		}
	});
}

function initial_old_fix_traverse_tree( results ) {
	for (var i = 0; i < results.length; i++) {  
		if( results[i].title == title_desired ){
			localStorage["queue_folder_id"] = results[i].id;
			title_folder_id = localStorage["queue_folder_id"];
			set_folder_parent();
			break;
		}else{
			chrome.bookmarks.getChildren( results[i].id, initial_old_fix_traverse_tree );
		}
	}
}

/**
 * Draw a basic icon for the browser action
 * @param {String} color Color to fill the bars with
 * @param {String} target_id jQuery compatible id to select canvas element
 * @return An canvas object containing an icon
 */
function draw_icon_box( color, target_id ) {
    var icn = $(target_id)[0].getContext("2d");

	//draw a circle
	icn.fillStyle = color;
	icn.beginPath();
	icn.rect(2, 1, 15, 5);
	icn.closePath();
	icn.fill();
	
	icn.beginPath();
	icn.rect(2, 7, 15, 5);
	icn.closePath();
	icn.fill();
	
	icn.beginPath();
	icn.rect(2, 13, 15, 5);
	icn.closePath();
	icn.fill();
	
	return icn;
}

/**
 * Check if a key matches a keyboard event object
 * @param {Object} event Keyboard event
 * @param {String} target_value String shortname
 * @return True if matches
*/
function check_for_key_binding_slot( event, target_value ){
    var matches = false;
    switch( target_value ){
        case "ctrl":
            if( event.ctrl ) {
                matches = true;
            }
            break;
        case "shift":
            if( event.shift ) {
                matches = true;
            }
            break;
        case "alt":
            if( event.alt ) {
                matches = true;
            }
            break;
        case "none":
            var ctr = 0;
            if( event.ctrl ) {
                ctr++;
            }
            if( event.shift ) {
                ctr++;
            }
            if( event.alt ) {
                ctr++;
            }
            if( ctr <= 1 ){
                matches = true;
            }
            break;
    }
    
    return matches;
}

function init_bg(){
	//get a reference to the green (disabeled) canvas
	var ctx = draw_icon_box( "#22B14C", "#canvas-green" );

	//get a reference to the red (enabeled) canvas
	var ctx2 = draw_icon_box( "#ED1C24", "#canvas-red" );

	// Add a listener which the content script can request to.
	chrome.extension.onRequest.addListener(
	    function(request, sender, response) {
            var kb_a_mod_1 = localStorage.getItem("kb_a_mod_1");
            var kb_a_mod_2 = localStorage.getItem("kb_a_mod_2");
            var kb_a_key = localStorage.getItem("kb_a_key");
            
            var kb_b_mod_1 = localStorage.getItem("kb_b_mod_1");
            var kb_b_mod_2 = localStorage.getItem("kb_b_mod_2");
            var kb_b_key = localStorage.getItem("kb_b_key");
            
            var mod_a1 = check_for_key_binding_slot( request, kb_a_mod_1 );
            var mod_a2 = check_for_key_binding_slot( request, kb_a_mod_2 );
            var kb_a_key = (kb_a_key.charCodeAt(0) == request.code);
            
            var mod_b1 = check_for_key_binding_slot( request, kb_b_mod_1 );
            var mod_b2 = check_for_key_binding_slot( request, kb_b_mod_2 );
            var kb_b_key = (kb_b_key.charCodeAt(0) == request.code);
            
            /*
             * Enable / Disable
             */
            if( mod_a1 && mod_a2 && kb_a_key ){
                en_dis_func();
            }

            /*
             * Enable / Disable
             */
            if( mod_b1 && mod_b2 && kb_b_key ){
                getNextBookmark();
            }
	    });
	
	img_dta = ctx.getImageData(0, 0, 19, 19)
	chrome.browserAction.setIcon( { "imageData": img_dta } );
}

$(document).ready(function() {
    init_bg();

    if( !tmp_title_id_hold ){
	    if( !title_desired ){
		    //no old style name either, go ahead and create
		    chrome.bookmarks.getTree( function( results ) {
			    for( var i = 0; i < results[0].children.length; i++ ){
				    if( results[0].children[i].title == "Other bookmarks" ){
					    chrome.bookmarks.create({'parentId': results[0].children[i].id,
										    'title': 'Browse Queue'},
									    function(newFolder) {
										    localStorage["queue_folder_id"] = newFolder.id;
										    title_folder_id = localStorage["queue_folder_id"];
										    set_folder_parent();
									    });
				    }
			    }
		    });
	    }else{
		    //old style found, try to use it
		    chrome.bookmarks.getTree( function( results ) {
			    for (var i = 0; i < results.length; i++) {  
				    initial_old_fix_traverse_tree( results[i].children );
			    }
		    });
		    localStorage.removeItem('queue_folder_name');
	    }
    }else{
	    title_folder_id = localStorage["queue_folder_id"];
	    set_folder_parent();
    }

    chrome.tabs.onRemoved.addListener(function(tabId) {
	    if( tabId == nav_target_tab_id ) { nav_target_tab_id = -1; }
    });

    // Update badge when bookmarks are added, removed, changed, or re-ordered
    chrome.bookmarks.onChanged.addListener( updateBABadgeCount );
    chrome.bookmarks.onChildrenReordered.addListener( updateBABadgeCount );
    chrome.bookmarks.onCreated.addListener( updateBABadgeCount );
    chrome.bookmarks.onImportEnded.addListener( updateBABadgeCount );
    chrome.bookmarks.onMoved.addListener( updateBABadgeCount );
    chrome.bookmarks.onRemoved.addListener( updateBABadgeCount );

    // Configure the context menu option
    chrome.contextMenus.create(
        {
            type: 'normal',
            title: 'Queue Link',
            contexts: ['link'],
            onclick: function( info, tab )
                {	            
                    chrome.bookmarks.create(
				        {'parentId': title_folder_id,
				         'title': info.linkUrl,
				         'url': info.linkUrl},
			         function( res ) { 
				        updateBABadgeCount();
			        });
                }
        } );
} );
