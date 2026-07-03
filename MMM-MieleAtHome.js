Module.register("MMM-MieleAtHome", {
    requiresVersion: "2.1.0",
    defaults: {
		userName: "",
        password: "",
        client_ID: "",
        client_Secret: "",
        authMode: "authorization_code", // "authorization_code" (new OAuth flow) or "legacy" (username/password flow)
        tokenFile: "", // Optional absolute/relative path for token storage if module path is not writable
        authorizationCode: "",
        redirectUri: "https://www.miele.com/developer/swagger-ui/oauth2-redirect.html",
        oauthScopes: ["openid", "mcs_thirdparty_read"],
        debug: true,
        capabilityDebug: false,
        showDeviceIcon: true, //Show or hide the icon of the devices
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
    debugLog: function(message) {
        if (this.config && this.config.debug) {
            Log.log(message);
        }
    },

    start: function() {
        this.mySpecialProperty = "So much wow!";
        this.data.prompt = null;
        this.data.authorizationUrl = null;
        this.data.devices = [];
        this.data.lastUpdate = null;
        this.debugLog(this.name + " is started!");
    },

    notificationReceived: function(notification, payload, sender) {
        if (sender) {
            this.debugLog(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
            switch(notification) {
                case "":
                    
                    break;
            };
        } else {
            this.debugLog(this.name + " received a system notification: " + notification);
            switch(notification) {
                case "ALL_MODULES_STARTED":
                    this.debugLog(this.name + " setting CONFIG");
                    this.sendSocketNotification("SET_CONFIG", this.config);
                    break;
            };
        }
    },

    socketNotificationReceived(notification, payload) {
        this.debugLog(this.name + " received a socket notification: " + notification + " - Payload: " + JSON.stringify(payload));
        switch (notification) {
            case "MIELE_AUTH_REQUIRED":
                this.data.prompt = (payload && payload.message) ? payload.message : "Authentifizierung notwendig";
                this.data.authorizationUrl = payload && payload.authorizationUrl ? payload.authorizationUrl : null;
                if (this.data.authorizationUrl) {
                    Log.log(this.name + " Login URL: " + this.data.authorizationUrl);
                }
                this.updateDom();
                break;
            case "MIELE_AUTH_ERROR":
                this.data.prompt = "Miele Auth Fehler: " + (payload && payload.message ? payload.message : "Unbekannter Fehler");
                this.data.authorizationUrl = null;
                this.data.devices = [];
                this.updateDom();
                break;
            case "MIELE_TOKEN_READY":
                this.data.prompt = null;
                this.data.authorizationUrl = null;
                this.updateDom();
                break;
            case "MIELE_DEVICES_UPDATE":
                this.data.prompt = null;
                this.data.devices = payload && Array.isArray(payload.devices) ? payload.devices : [];
                this.data.lastUpdate = payload && payload.updatedAt ? payload.updatedAt : Date.now();
                this.updateDom();
                break;
            case "MIELE_DEVICES_ERROR":
                this.data.prompt = "Geraetedaten konnten nicht geladen werden: " + (payload && payload.message ? payload.message : "Unbekannter Fehler");
                this.updateDom();
                break;
        }
    },

    getScripts: function() {
        return []
    },

    getStyles: function() {
        return [
            'font-awesome.css',
            this.file('MMM-MieleAtHome.css')
        ]
    },

    getTranslations: function() {
        return false;
    },

    getTemplate: function() {
        return 'MMM-MieleAtHome.njk';
    },

    getTemplateData: function() {
    const visibleDevices = (this.data.devices || [])
        .filter((device) => this.shouldShowDevice(device))
        .map((device) => this.decorateDeviceForTemplate(device));

    return {
        prompt: this.data.prompt,
        authorizationUrl: this.data.authorizationUrl,
        devices: visibleDevices,
        lastUpdate: this.data.lastUpdate,
        showDeviceIcon: this.config.showDeviceIcon,
        capabilityDebug: !!this.config.capabilityDebug,
        statusIcons: {
            doorOpen: "/modules/MMM-MieleAtHome/Icons/Status/Status_DoorOpen.png",
            failure: "/modules/MMM-MieleAtHome/Icons/Status/Status_Failure.png",
            info: "/modules/MMM-MieleAtHome/Icons/Status/Status_InfoAvailable.png",
            power: "/modules/MMM-MieleAtHome/Icons/Status/Status_OnOff.png"
        }
    };

},

    decorateDeviceForTemplate: function(device) {
        const supports = device && device.supports && typeof device.supports === "object" ? device.supports : {};
        const enabledSupports = Object.keys(supports).filter((key) => supports[key]);

        return {
            ...device,
            supportsEnabledText: enabledSupports.length > 0 ? enabledSupports.join(", ") : "keine",
            debugTypeRaw: (device && device.typeRaw !== undefined && device.typeRaw !== null) ? String(device.typeRaw) : "-",
            debugRemainingRaw: (device && device.remainingMinutes !== null && device.remainingMinutes !== undefined) ? String(device.remainingMinutes) : "-",
            debugElapsedRaw: (device && device.elapsedMinutes !== null && device.elapsedMinutes !== undefined) ? String(device.elapsedMinutes) : "-"
        };
    },

    shouldShowDevice: function(device) {
        if (!device) {
            return false;
        }

        if (Array.isArray(this.config.ignoreDevices) && this.config.ignoreDevices.includes(device.id)) {
            return false;
        }

        if (this.config.showAlwaysAllDevices) {
            return true;
        }

        if (device.statusClass === "running" || device.isOn) {
            return true;
        }

        if (this.config.showDeviceIfDoorIsOpen && device.doorOpen === true) {
            return true;
        }

        if (this.config.showDeviceIfFailure && device.hasFailure) {
            return true;
        }

        if (this.config.showDeviceIfInfoIsAvailable && device.hasInfo) {
            return true;
        }

        return false;
}

});