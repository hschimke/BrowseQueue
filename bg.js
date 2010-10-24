var click_ref = false;
var mg = chrome.i18n.getMessage("bg_mg_text");
var page_ids = new Array();
var title_folder_id = -1;
var nav_target_tab_id = -1;
var EnDisButtonText = chrome.i18n.getMessage("enable_button_text");
var NextButtonMessage = chrome.i18n.getMessage("next_button_text");
var enable_next_button = true;

var updateBABadgeCount = function(){
	chrome.bookmarks.getChildren(title_folder_id, function ( results ){
			chrome.browserAction.setBadgeText( { "text": results.length.toString() } );
			if( results.length <= 0 ){
				enable_next_button = false;
			}else{
				enable_next_button = true;
			}
		});
};

var set_folder_parent = function(){
	updateBABadgeCount();
};

var title_desired = localStorage["queue_folder_name"];
var tmp_title_id_hold = localStorage["queue_folder_id"];
if( !tmp_title_id_hold ){
	if( !title_desired ){
		//console.log( "no old style name either, go ahead and create" );
		//no old style name either, go ahead and create
		chrome.bookmarks.getTree( function( results ) {
			for( var i = 0; i < results[0].children.length; i++ ){
				//console.log( results[0].children[i].title );
				if( results[0].children[i].title == "Other bookmarks" ){
					//console.log( "Go Other bookmarks core: " + results[i].id );
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
		//console.log( "old style found, try to use it" );
		//old style found, try to use it
		chrome.bookmarks.getTree( function( results ) {
			for (var i = 0; i < results.length; i++) {  
				//console.log( results[i].id + " : " + results[i].title );
				initial_old_fix_traverse_tree( results[i].children );
			}
		});
		localStorage.removeItem('queue_folder_name');
	}
}else{
	title_folder_id = localStorage["queue_folder_id"];
	set_folder_parent();
}

var en_dis_func = function() {
		click_ref = !click_ref;
		if( click_ref ){
			//chrome.browserAction.setBadgeText( { "text": "ON" } );
			var ctx2 = document.getElementById("canvas_red").getContext("2d");
			
			img_dta = ctx2.getImageData(0, 0, 19, 19)
			chrome.browserAction.setIcon( { "imageData": img_dta } );

			chrome.tabs.onCreated.addListener( the_on_created_function );
			chrome.tabs.onUpdated.addListener( the_on_updated_function );
			EnDisButtonText = "Disable";
		}else{
			//chrome.browserAction.setBadgeText( { "text": "OFF" } );
			var ctx = document.getElementById("canvas_green").getContext("2d");
			
			img_dta = ctx.getImageData(0, 0, 19, 19)
			chrome.browserAction.setIcon( { "imageData": img_dta } );
			
			chrome.tabs.onCreated.removeListener( the_on_created_function );
			chrome.tabs.onUpdated.removeListener( the_on_updated_function );
			EnDisButtonText = "Enable";
		}
		//console.log( mg + click_ref );
	};

var the_on_created_function = function(tab) { 
	if( tab.url.indexOf('chrome://') != -1 ){
		//console.log( "Chrome tag, do not mangle" );
	}else{
		if( page_ids[tab.id] == false ) {
			//console.log( "Skipping intentionally" );
		}else{
			//console.log( "Tab created: " + tab.id);
			page_ids[tab.id] = true;
		}
	}
};

var the_on_updated_function = function(tabId, changeInfo, tab) { 
	//console.log( "Id: " + tabId + " Url: " + tab.url );
	if( page_ids[tabId] != undefined && page_ids[tabId] == true ){
		if( tab.status == "loading" ){
			//console.log( "Ready to create a bookmark with parent " + title_folder_id + " with url " + tab.url );
			chrome.bookmarks.create(
						{'parentId': title_folder_id,
						 'title': tab.title,
						 'url': tab.url},
					 function( res ) { 
						//console.log( "Added bookmark" );
						updateBABadgeCount();
					});
			page_ids[tabId] = false;
			chrome.tabs.remove( tabId );
		}else{
			//console.log( "Still waiting for loading to complete" );
		}
	}
};

var getNextBookmark = function() {
	chrome.bookmarks.getChildren( title_folder_id, function( results ) {
		if( results.length > 0 ){
			//console.log( "bookmark: " + results[0].title + " :: " + results[0].url );
			if( nav_target_tab_id == -1 ){
				//console.log( "Target tab not created, creating" );
				chrome.tabs.create({'url':results[0].url}, function( tab ) {
					page_ids[tab.id] = false;
					nav_target_tab_id = tab.id;
				});
			}else{
				//console.log( "Target tab already exists, updating it" );
				chrome.tabs.update(nav_target_tab_id, {'url':results[0].url} );
			}
			chrome.bookmarks.remove( results[0].id, function() { updateBABadgeCount(); } );
		}
	});
};

//console.log( "Search bookmarks" );

var initial_old_fix_traverse_tree = function( results ) {
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

//set_folder_parent();
//updateBABadgeCount();

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

function init_bg(){
	//get a reference to the canvas
	var ctx = document.getElementById("canvas_green").getContext("2d");

	//draw a circle
	ctx.fillStyle = "#22B14C"
	ctx.beginPath();
	ctx.rect(2, 1, 15, 5);
	ctx.closePath();
	ctx.fill();
	
	ctx.beginPath();
	ctx.rect(2, 7, 15, 5);
	ctx.closePath();
	ctx.fill();
	
	ctx.beginPath();
	ctx.rect(2, 13, 15, 5);
	ctx.closePath();
	ctx.fill();
	
	//get a reference to the canvas
	var ctx2 = document.getElementById("canvas_red").getContext("2d");

	//draw a circle
	ctx2.fillStyle = "#ED1C24"
	ctx2.beginPath();
	ctx2.rect(2, 1, 15, 5);
	ctx2.closePath();
	ctx2.fill();
	
	ctx2.beginPath();
	ctx2.rect(2, 7, 15, 5);
	ctx2.closePath();
	ctx2.fill();
	
	ctx2.beginPath();
	ctx2.rect(2, 13, 15, 5);
	ctx2.closePath();
	ctx2.fill();
	
	// Add a listener to the content script can request to.
	chrome.extension.onRequest.addListener(function(request, sender, response) {
	  
	  /*
	   * Enable / Disable
	   * 69 + shift Ctrl - Shift - E
	   */
	  if( request.shift && (request.code == 69) ){
		en_dis_func();
	  }
	  
	  /*
	   * Enable / Disable
	   * 80 + shift Ctrl - Shift - P
	   */
	   if( request.shift && (request.code == 80) ){
		getNextBookmark();
	  }
	});
	
	img_dta = ctx.getImageData(0, 0, 19, 19)
	chrome.browserAction.setIcon( { "imageData": img_dta } );
}

//console.log( "Registered" );
