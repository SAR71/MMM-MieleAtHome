var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({

	init(){
		console.log("init module helper: MMM-MieleAtHome");
	},

	start() {
		console.log('Starting module helper: ' + this.name);		
	},

	stop(){
		console.log('Stopping module helper: ' + this.name);
	},

	// handle messages from our module// each notification indicates a different messages
	// payload is a data structure that is different per message.. up to you to design this
	socketNotificationReceived(notification, payload) {
		//console.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);

		switch(notification){
			case "CONFIG":
				// save payload config info
				this.config=payload

				setConfig(payload);
				createMieleAtHome(payload);

				this.sendSocketNotification("STARTUP", "<span class='logo'><span>Geräte werden geladen...</span></span>");

				// wait 0 milliseconds, send a message back to module
				//setTimeout(()=> { this.sendSocketNotification("message_from_helper",test)}, 0)
				break;

			case "UPDATEREQUEST":
				getUpdatedHTML(this);
				
				//this.sendSocketNotification("MMM-MieleAtHome_Update", html);					
				break;

			case "HTML":
				//console.log(this.name + " HTML changed to: " + payload);
				break;
		}
	},
});

var mieleathome = require('./utilities/mieleathome.js');
const { wrap } = require("lodash");
var tokenAvailable = false;
var _config;

function setConfig(config){
	_config = config;
}

function createMieleAtHome(config) {
	if(!!config){
			if (config.userName != "" && 
			config.password != "" && 
			config.client_ID != "" && 
			config.client_Secret != "" ){

			mieleathome = new mieleathome(config);
			
			mieleathome.ReadToken(function waitForToken() {
				tokenAvailable = true;
			});
		}
	}
}

function getUpdatedHTML(self) {
	updateMieleInfos(function waitForHTML(html) {
		self.sendSocketNotification("MMM-MieleAtHome_Update", html);
	});	
}

var deviceData;

function updateMieleInfos(callback) {
	var err;
	//https://wordtohtml.net/
	var wrapper = "";

	if(tokenAvailable){
		mieleathome.NGetDevices(function returnedDevices(err, data) {
			deviceData = data;		

			//Get All necessarc Device Infos
			var devices = getDeviceInfos(deviceData);

			devices.forEach(function (device) {
				var isIgnoreDevice = false;
				_config.ignoreDevices.forEach(function (itemOnIgnoreList) {
					if(device.deviceID == itemOnIgnoreList){
						isIgnoreDevice = true;						
					}
				});

				if(!isIgnoreDevice){
					wrapper = generateDeviceContainerHTML(wrapper, device);
				}
				
			});

			//If there is no device then tell it
			if(wrapper == ""){
				wrapper = "<span class='logo'><span>Kein aktives Gerät</span></span>";
			}

			callback(wrapper);

			//Devices += key + " -> " + deviceData[key] + "\n"
			//console.log(key + " -> " + deviceData[key]);			
		});
	}
	else{
		return "Token missing...";
	}
}

function generateDeviceContainerHTML(wrapper, device){

	//Check if Device should be ignored

	var IsSkipDevice = false;
	if(_config.showAlwaysAllDevices == false && device.StatusID == 1){

		IsSkipDevice = true;

		if(_config.showDeviceIfDoorIsOpen && device.DoorOpen){
			IsSkipDevice = false;
		}

		if(_config.showDeviceIfFailure && device.Failure){
			IsSkipDevice = false;
		}
				
		if(_config.showDeviceIfInfoIsAvailable && device.Failure){
			IsSkipDevice = false;
		}
	}

	if(!IsSkipDevice){
		var StatusString = device.Status;

		if(device.ProgramID != "") { StatusString += " | " + device.ProgramID; }

		if(device.ProgramPhase != "") { StatusString += " | " + device.ProgramPhase; }

		var Image;

		switch(device.TypeNumber){
			case 1:				
				Image = "Miele/1.png";
			break;

			case 2:				
				Image = "Miele/2.png";
			break;

			case 7:				
				Image = "Miele/7.png";
			break;

			case 10:				
				Image = "Miele/10.png";
			break;

			case 11:				
				Image = "Miele/11.png";
			break;

			case 12:				
				Image = "Miele/12.png";
			break;

			case 13:				
				Image = "Miele/13.png";
			break;

			case 14:				
				Image = "Miele/14.png";
			break;

			case 15:				
				Image = "Miele/15.png";
			break;

			case 16:				
				Image = "Miele/16.png";
			break;

			case 17:				
				Image = "Miele/17.png";
			break;

			case 18:
				//Dunstabzugshaube
				Image = "Miele/18.png";
			break;

			case 19:				
				Image = "Miele/19.png";
			break;

			case 20:				
				Image = "Miele/20.png";
			break;

			case 21:
				//Kühl-/Gefriekombination
				Image = "Miele/21.png";
			break;

			case 24:				
				Image = "Miele/24.png";
			break;

			case 27:
				//Induktionsherd
				Image = "Miele/27.png";
			break;

			case 31:
				//Combidampfgarer
				Image = "Miele/31.png";
			break;

			case 32:				
				Image = "Miele/32.png";
			break;

			case 33:				
				Image = "Miele/33.png";
			break;

			case 34:				
				Image = "Miele/34.png";
			break;

			default:
				Image = "Icon_000.png";
			break;
		}

		var DeviceName = device.Name;
		if(_config.useIndividualNames && device.TypeNumber){
			DeviceName = device.NameManual;
		}
		
		var container = "<div class='deviceContainerWithoutDeviceIcon'>"					
					    + "<div>";

		if(_config.showDeviceIcon){
			container = "<div class='deviceContainer'>"
					  	  + "<img src='/modules/MMM-MieleAtHome/Icons/" + Image + "' />"
					  + "<div>";
		}		

		if(device.StatusID != 1){
			container += "<div>"
					  	+"<img class='deviceStatusIcon' src='/modules/MMM-MieleAtHome/Icons/Status/Status_OnOff.png' />"
					  +"</div>";
		}

		if(device.DoorOpen){
			container += "<div>"
					  	+"<img class='deviceStatusIcon' src='/modules/MMM-MieleAtHome/Icons/Status/Status_DoorOpen.png' />"
					  +"</div>";
		}

		if(device.Light > 0){
			container += "<div>"
					  +"<img class='deviceStatusIcon' src='/modules/MMM-MieleAtHome/Icons/Status/Status_LightOn.png' />"
					  +"</div>";
		}

		if(device.InfoAvailable){
			container += "<div>"
					  	+"<img class='deviceStatusIcon' src='/modules/MMM-MieleAtHome/Icons/Status/Status_InfoAvailable.png' />"
					  +"</div>";
		}

		if(device.Failure){
			container += "<div>"
					  	+"<img class='deviceStatusIcon' src='/modules/MMM-MieleAtHome/Icons/Status/Status_Failure.png' />"
					  +"</div>";
		}

		container +="</div>"
			      	+"<div>"
				  		+"<div>"
				  			+"<span Class='deviceName'>" + DeviceName + "</span>"
				  		+"</div>"
				  		+"<div>"
				  			+"<span Class='deviceStatus'>${Status}</span>"
				  		+"</div>";

		//Add Timebar if there is remaining Time
		if(device.RemainingTime_Hours != 0 | device.RemainingTime_Minutes != 0){
			var StartTime = device.StartTime_Hours * 60 + device.StartTime_Minutes;
			var RemainingTime = device.RemainingTime_Hours * 60 + device.RemainingTime_Minutes;
			var ElapsedTime = device.ElapsedTime_Hours * 60 + device.ElapsedTime_Minutes;

			var ProgressBarLength = 250; //Progressbarlength from CSS
			var TimeBar = Math.round((ElapsedTime / (RemainingTime + ElapsedTime)) * 100);

			if(TimeBar > 100){ TimeBar = 100; }

			StatusString += " - fertig in " + (device.RemainingTime_Hours + device.StartTime_Hours).pad() + ":" + (device.RemainingTime_Minutes + device.StartTime_Minutes).pad() + "h";

			container+="<div>"
				+"<div Class='deviceProgress_Base'>"
					+"<div Class='deviceProgress' style='width:" + TimeBar + "%'></div>"
				+"</div>"
			+"</div>"
		}

		container+="</div>"
				 +"</div>";


		container = container.replace("${Status}", StatusString);

		if(wrapper == ""){
			wrapper=container;
		}
		else{
			wrapper+=container;
		}
	}

	return wrapper;

}

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

function getDeviceInfos(data) {
	var devices = [];

	for(var deviceID in data){
		var deviceInfos = data[deviceID]

		var device = new Object();
		device.deviceID = deviceID;

		for(var deviceInfo in deviceInfos){
			switch(deviceInfo){
				case "ident":
					var deviceIdentifications = deviceInfos[deviceInfo]

					for(var deviceDetail in deviceIdentifications){
						switch(deviceDetail){
							case "type":
								var typeInformation = deviceIdentifications[deviceDetail]

								for(var typeDetail in typeInformation){
									switch(typeDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.Name = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "deviceName":
								device.NameManual = deviceIdentifications[deviceDetail];
							break;
						}
					}
				break;

				case "state":
					var deviceStatus = deviceInfos[deviceInfo]
					
					for(var deviceStat in deviceStatus){
						switch(deviceStat){							
							case "status":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											device.StatusID = statusInformation[statusDetail];
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.Status = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "ProgramID":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.ProgramID = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "programType":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.ProgramType = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "programPhase":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.ProgramPhase = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "remainingTime":
								var statusInformation = deviceStatus[deviceStat]

								device.RemainingTime_Hours = statusInformation[0];
								device.RemainingTime_Minutes = statusInformation[1];
							break;

							case "startTime":
								var statusInformation = deviceStatus[deviceStat]

								device.StartTime_Hours = statusInformation[0];
								device.StartTime_Minutes = statusInformation[1];
							break;

							case "elapsedTime":
								var statusInformation = deviceStatus[deviceStat]

								device.ElapsedTime_Hours = statusInformation[0];
								device.ElapsedTime_Minutes = statusInformation[1];
							break;

							case "signalDoor":
								device.DoorOpen = deviceStatus[deviceStat];
							break;

							case "signalFailure":
								device.Failure = deviceStatus[deviceStat];
							break;

							case "signalInfo":
								device.InfoAvailable = deviceStatus[deviceStat];
							break;

							case "light":
								device.Light = deviceStatus[deviceStat];
							break;
						}
					}
				break;
			}			
		}

		devices.push(device);
	}

	return devices;
}