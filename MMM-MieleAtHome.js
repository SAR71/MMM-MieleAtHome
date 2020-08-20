/*
https://www.miele.com/developer/

https://api.mcs3.miele.com/thirdparty/login?response_type=code&client_id=cb7757b2-2491-4fe9-a393-86c9bf604ab6&redirect_uri=https%3A%2F%2Fwww.miele.com%2Fdeveloper%2Fswagger-ui%2Foauth2-redirect.html&state=V2VkIEF1ZyAwNSAyMDIwIDE3OjE3OjMwIEdNVCswMjAwIChNaXR0ZWxldXJvcMOkaXNjaGUgU29tbWVyemVpdCk%3D
 
https://github.com/hash99/ioBroker.mieleathome/blob/master/utils/mieleathome.js
*/

Module.register("MMM-MieleAtHome", {
	// define variables used by module, but not in config data
	updated:  0,
	HTML: "<p>Loading Module...</p>",

	// holder for config info from module_name.js
	config:null,

	// anything here in defaults will be added to the config data
	// and replaced if the same thing is provided in config
	defaults: {
		userName: "",
        password: "",
        client_ID: "",
		client_Secret: "",
		BaseURL: 'https://api.mcs3.miele.com/',
		showAlwaysAllDevices: false, //if true all devices will be shown, despite if on or off
		showDeviceIfDoorIsOpen: true, //if showAlwaysAllDevices is true, the device will be shown if Door is open
		showDeviceIfFailure: true, //if showAlwaysAllDevices is true, the device will be shown if there is a failure
		showDeviceIfInfoIsAvailable: true, //if showAlwaysAllDevices is true, the device will be shown if Info is Available
		ignoreDevices: [],
		useIndividualNames: false,
		vg: "de-DE",
		language: "de",
		updateFrequency: 5000
	},

	init: function(){
		Log.log(this.name + " is in init!");
	},

	start: function(){
		Log.log(this.name + " is starting!");

		var timer = setInterval(()=>{
			this.sendSocketNotification("UPDATEREQUEST", null)
			this.updateDom();			
		}, this.config.updateFrequency)
	},

	loaded: function(callback) {
		Log.log(this.name + " is loaded!");

		callback();
	},

	// return list of other functional scripts to use, if any (like require in node_helper)
	getScripts: function() {
	return	[
			// sample of list of files to specify here, if no files,do not use this routine, or return empty list

			//'script.js', // will try to load it from the vendor folder, otherwise it will load is from the module folder.
			//'moment.js', // this file is available in the vendor folder, so it doesn't need to be available in the module folder.
			//this.file('anotherfile.js'), // this file will be loaded straight from the module folder.
			//'https://code.jquery.com/jquery-2.2.3.min.js',  // this file will be loaded from the jquery servers.
		]
	}, 

	// return list of stylesheet files to use if any
	getStyles: function() {
		return ["MMM-MieleAtHome.css"];
		//return 	[
			// sample of list of files to specify here, if no files, do not use this routine, , or return empty list

			//'script.css', // will try to load it from the vendor folder, otherwise it will load is from the module folder.
			//'font-awesome.css', // this file is available in the vendor folder, so it doesn't need to be avialable in the module folder.
			//this.file('anotherfile.css'), // this file will be loaded straight from the module folder.
			//'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css',  // this file will be loaded from the bootstrapcdn servers.
		//]
	},

	// return list of translation files to use, if any
	/*getTranslations: function() {
		return {
			// sample of list of files to specify here, if no files, do not use this routine, , or return empty list
			// en: "translations/en.json",  (folders and filenames in your module folder)
			// de: "translations/de.json"
		}
	}, */ 



	// only called if the module header was configured in module config in config.js
	getHeader: function() {
		return "Miele@Home";
	},

	// messages received from other modules and the system (NOT from your node helper)
	// payload is a notification dependent data structure
	notificationReceived: function(notification, payload, sender) {
		// once everybody is loaded up
		if(notification==="ALL_MODULES_STARTED"){
			// send our config to our node_helper
			this.sendSocketNotification("CONFIG",this.config)
		}
		if (sender) {
			//Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
		} else {
			//Log.log(this.name + " received a system notification: " + notification);
		}
	},

	// messages received from from your node helper (NOT other modules or the system)
	// payload is a notification dependent data structure, up to you to design between module and node_helper
	socketNotificationReceived: function(notification, payload) {
		//Log.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);
		
		switch(notification){
			case "STARTUP":
				this.HTML = payload;
				//some_other_variable = payload;
				this.updateDom(1000);
			break;

			case "MMM-MieleAtHome_Update":
				this.HTML = payload;
				//some_other_variable = payload;
			break;
		}
	},

	// system notification your module is being hidden
	// typically you would stop doing UI updates (getDom/updateDom) if the module is hidden
	suspend: function(){

	},

	// system notification your module is being unhidden/shown
	// typically you would resume doing UI updates (getDom/updateDom) if the module is shown
	resume: function(){

	},

	// this is the major worker of the module, it provides the displayable content for this module
	getDom: function() {
		var wrapper = document.createElement("div");

		wrapper.innerHTML = "<p>" + this.HTML + "</p>";

		//Zum Debuggen zurücksenden
		//this.sendSocketNotification("HTML", wrapper.innerHTML)

		return wrapper;
	},
})