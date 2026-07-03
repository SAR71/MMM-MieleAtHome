const NodeHelper = require("node_helper");
const Log = require("logger");
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

const AUTHORIZATION_URL = "https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/auth";
const TOKEN_URL = "https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/token";
const LEGACY_TOKEN_URL = "https://api.mcs3.miele.com/thirdparty/token/";
const DEVICES_URL = "https://api.mcs3.miele.com/v1/devices";
const CAPABILITY_TYPES = {
    status: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 31, 32, 33, 34, 45, 67, 68, 74]),
    programPhase: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
    remainingTime: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19]),
    elapsedTime: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19]),
    targetTemperature: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23]),
    signalInfo: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 31, 32, 33, 34, 45]),
    signalFailure: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 31, 32, 33, 34, 45, 67, 68, 74]),
    signalDoor: new Set([1, 2, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
};

module.exports = NodeHelper.create({
    requiresVersion: "2.1.0",

    debugLog: function (message) {
        if (this.config && this.config.debug) {
            Log.log(message);
        }
    },

    start: function () {
        this.tokenFile = path.join(__dirname, "mieletoken.json");
        this.tokenData = null;
        this.pollTimer = null;
        this.availableTypeIcons = this.loadAvailableTypeIcons();
    },

    stop: function () {
        this.stopDevicePolling();
    },

    socketNotificationReceived: function (notification, payload) {
        this.debugLog(this.name + " received a socket notification: " + notification);
        switch (notification) {
            case "SET_CONFIG":
                this.config = payload;
                this.debugLog(this.name + " config set to: " + JSON.stringify(this.config));
                this.initializeAuth();
                break;
            case "EXCHANGE_AUTH_CODE":
                if (payload && payload.authorizationCode) {
                    this.config.authorizationCode = payload.authorizationCode;
                    this.initializeAuth();
                }
                break;
        }
    },

    initializeAuth: async function () {
        try {
            this.validateConfig();
            this.tokenFile = await this.selectTokenFilePath();
            Log.log(this.name + " using token file: " + this.tokenFile);

            if (this.isLegacyAuthMode()) {
                await this.initializeLegacyAuth();
                return;
            }

            await this.initializeOAuthAuth();
        } catch (error) {
            Log.error(this.name + " auth initialization failed: " + error.message);
            this.sendSocketNotification("MIELE_AUTH_ERROR", {
                message: error.message
            });
        }
    },

    validateConfig: function () {
        if (!this.config || !this.config.client_ID || !this.config.client_Secret) {
            throw new Error("Missing client_ID/client_Secret in module config");
        }

        const mode = this.getAuthMode();
        if (mode !== "authorization_code" && mode !== "legacy" && mode !== "password") {
            throw new Error("Invalid authMode. Use 'authorization_code' or 'legacy'.");
        }

        if ((mode === "legacy" || mode === "password") && (!this.config.userName || !this.config.password)) {
            throw new Error("Legacy auth requires userName and password in module config.");
        }
    },

    getAuthMode: function () {
        return String(this.config && this.config.authMode ? this.config.authMode : "authorization_code").toLowerCase();
    },

    isLegacyAuthMode: function () {
        const mode = this.getAuthMode();
        return mode === "legacy" || mode === "password";
    },

    getTokenFileCandidates: function () {
        const candidates = [];
        const configuredPath = this.config && this.config.tokenFile ? String(this.config.tokenFile).trim() : "";

        if (configuredPath) {
            candidates.push(path.isAbsolute(configuredPath) ? configuredPath : path.resolve(__dirname, configuredPath));
        }

        candidates.push(path.join(__dirname, "mieletoken.json"));
        candidates.push(path.join(os.homedir(), "MagicMirror", "config", "MMM-MieleAtHome-token.json"));
        candidates.push(path.join(os.tmpdir(), "MMM-MieleAtHome-token.json"));

        return [...new Set(candidates)];
    },

    selectTokenFilePath: async function (candidateList) {
        const candidates = Array.isArray(candidateList) && candidateList.length > 0
            ? candidateList
            : this.getTokenFileCandidates();

        for (const filePath of candidates) {
            const dirPath = path.dirname(filePath);

            try {
                await fs.promises.mkdir(dirPath, { recursive: true });
            } catch (error) {
                continue;
            }

            if (fs.existsSync(filePath)) {
                try {
                    await fs.promises.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
                    return filePath;
                } catch (error) {
                    continue;
                }
            }

            try {
                await fs.promises.access(dirPath, fs.constants.W_OK);
                return filePath;
            } catch (error) {
                continue;
            }
        }

        throw new Error("No writable token file location found. Set config.tokenFile to a writable path.");
    },

    writeTokenFile: async function (targetPath, data) {
        await fs.promises.writeFile(targetPath, JSON.stringify(data, null, 2) + "\n", "utf8");
    },

    initializeOAuthAuth: async function () {
        const tokenFromFile = await this.readTokenFile();

        if (this.isTokenValid(tokenFromFile)) {
            this.tokenData = tokenFromFile;
            this.handleTokenReady();
            return;
        }

        if (tokenFromFile && tokenFromFile.refresh_token) {
            const refreshed = await this.refreshAccessToken(tokenFromFile.refresh_token);
            this.tokenData = await this.saveToken(refreshed, "refresh_token");
            this.handleTokenReady();
            return;
        }

        if (this.config.authorizationCode) {
            const exchanged = await this.exchangeAuthorizationCode(this.config.authorizationCode);
            this.tokenData = await this.saveToken(exchanged, "authorization_code");
            this.handleTokenReady();
            return;
        }

        const authorizationUrl = this.buildAuthorizationUrl();
        Log.log(this.name + " authorization required. Login URL: " + authorizationUrl);
        this.sendSocketNotification("MIELE_AUTH_REQUIRED", {
            authorizationUrl: authorizationUrl,
            message: "Open login URL, authorize, and set authorizationCode in config."
        });
    },

    initializeLegacyAuth: async function () {
        const tokenFromFile = await this.readTokenFile();

        if (this.isTokenValid(tokenFromFile)) {
            this.tokenData = tokenFromFile;
            this.handleTokenReady();
            return;
        }

        if (tokenFromFile && tokenFromFile.refresh_token) {
            const refreshed = await this.refreshLegacyAccessToken(tokenFromFile.refresh_token);
            this.tokenData = await this.saveToken(refreshed, "legacy_refresh_token");
            this.handleTokenReady();
            return;
        }

        const token = await this.requestLegacyPasswordToken();
        this.tokenData = await this.saveToken(token, "legacy_password");
        this.handleTokenReady();
    },

    handleTokenReady: function () {
        this.sendSocketNotification("MIELE_TOKEN_READY", {
            expires_at: this.tokenData.expires_at
        });
        this.startDevicePolling();
    },

    startDevicePolling: function () {
        this.stopDevicePolling();

        const intervalMs = Math.max(5000, Number(this.config && this.config.updateFrequency) || 60000);

        this.updateDevices().catch((error) => {
            this.debugLog(this.name + " initial device update failed: " + error.message);
        });

        this.pollTimer = setInterval(() => {
            this.updateDevices().catch((error) => {
                this.debugLog(this.name + " periodic device update failed: " + error.message);
            });
        }, intervalMs);
    },

    stopDevicePolling: function () {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    },

    updateDevices: async function () {
        try {
            await this.ensureValidAccessToken();
            const response = await this.getDevices();
            const devices = this.normalizeDevices(response);
            this.sendSocketNotification("MIELE_DEVICES_UPDATE", {
                devices: devices,
                updatedAt: Date.now()
            });
        } catch (error) {
            Log.error(this.name + " device update failed: " + error.message);
            this.sendSocketNotification("MIELE_DEVICES_ERROR", {
                message: error.message
            });
            throw error;
        }
    },

    ensureValidAccessToken: async function () {
        if (this.isTokenValid(this.tokenData)) {
            return;
        }

        if (!this.tokenData || !this.tokenData.refresh_token) {
            throw new Error("No valid access token available");
        }

        const refreshed = this.isLegacyAuthMode()
            ? await this.refreshLegacyAccessToken(this.tokenData.refresh_token)
            : await this.refreshAccessToken(this.tokenData.refresh_token);

        this.tokenData = await this.saveToken(refreshed, this.isLegacyAuthMode() ? "legacy_refresh_token" : "refresh_token");
    },

    getDevices: async function () {
        const language = this.config && this.config.language ? this.config.language : "de";
        const url = new URL(DEVICES_URL);
        url.searchParams.set("language", language);

        try {
            return await this.getJson(url.toString(), this.tokenData.access_token);
        } catch (error) {
            if (error.statusCode !== 401) {
                throw error;
            }

            await this.ensureValidAccessToken();
            return this.getJson(url.toString(), this.tokenData.access_token);
        }
    },

    getJson: function (url, accessToken) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);

            const req = https.request({
                protocol: urlObj.protocol,
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + accessToken,
                    "Accept": "application/json"
                }
            }, (res) => {
                let responseData = "";

                res.on("data", (chunk) => {
                    responseData += chunk;
                });

                res.on("end", () => {
                    let parsed;

                    try {
                        parsed = responseData ? JSON.parse(responseData) : {};
                    } catch (error) {
                        reject(new Error("Miele API returned invalid JSON"));
                        return;
                    }

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                        return;
                    }

                    const err = new Error("Miele API request failed: HTTP " + res.statusCode);
                    err.statusCode = res.statusCode;
                    err.payload = parsed;
                    reject(err);
                });
            });

            req.on("error", (error) => reject(error));
            req.end();
        });
    },

    normalizeDevices: function (apiData) {
        const devicesObj = apiData && typeof apiData === "object" ? apiData : {};

        return Object.keys(devicesObj).map((deviceId) => {
            const device = devicesObj[deviceId] || {};
            const ident = device.ident || {};
            const state = device.state || {};
            const typeRaw = this.readValueRaw(ident.type);
            const supportsStatus = this.supportsCapability(typeRaw, "status", state, "status");
            const supportsProgramPhase = this.supportsCapability(typeRaw, "programPhase", state, "programPhase");
            const supportsRemainingTime = this.supportsCapability(typeRaw, "remainingTime", state, "remainingTime");
            const supportsElapsedTime = this.supportsCapability(typeRaw, "elapsedTime", state, "elapsedTime");
            const supportsTargetTemperature = this.supportsCapability(typeRaw, "targetTemperature", state, "targetTemperature");
            const supportsSignalDoor = this.supportsCapability(typeRaw, "signalDoor", state, "signalDoor");
            const supportsSignalInfo = this.supportsCapability(typeRaw, "signalInfo", state, "signalInfo");
            const supportsSignalFailure = this.supportsCapability(typeRaw, "signalFailure", state, "signalFailure");

            const statusText = supportsStatus ? this.localizedValue(state.status && state.status.value_localized) : "";
            const programText = supportsProgramPhase ? this.localizedValue(state.programPhase && state.programPhase.value_localized) : "";
            const targetTemp = supportsTargetTemperature ? this.extractTemperature(state.targetTemperature) : "";
            const remainingTime = supportsRemainingTime ? this.formatRemainingTime(state.remainingTime) : "";
            const elapsedMinutes = supportsElapsedTime ? this.durationArrayToMinutes(state.elapsedTime) : null;
            const remainingMinutes = supportsRemainingTime ? this.durationArrayToMinutes(state.remainingTime) : null;
            const progressPercent = this.calculateProgressPercent(elapsedMinutes, remainingMinutes);
            const doorLabel = supportsSignalDoor ? this.localizedValue(state.doorState && state.doorState.value_localized) : "";
            const doorOpen = supportsSignalDoor ? this.extractDoorOpen(state.doorState, doorLabel) : null;
            const hasFailure = supportsSignalFailure ? this.readStateFlag(state, ["signalFailure", "error", "failure"]) : false;
            const hasInfo = supportsSignalInfo ? this.readStateFlag(state, ["signalInfo", "info"]) : false;
            const isOn = this.isDeviceOn(statusText || "");
            const statusClass = this.statusClassFromText(statusText || "", hasFailure, isOn);

            return {
                id: deviceId,
                name: ident.deviceName || (ident.type && ident.type.value_localized && this.localizedValue(ident.type.value_localized)) || deviceId,
                type: ident.type && ident.type.value_localized ? this.localizedValue(ident.type.value_localized) : "",
                typeRaw: typeRaw,
                iconPath: this.resolveDeviceIconPath(typeRaw),
                status: statusText || "Unbekannt",
                programPhase: programText || "",
                targetTemperature: targetTemp,
                remainingTime: remainingTime,
                progressPercent: progressPercent,
                elapsedMinutes: elapsedMinutes,
                remainingMinutes: remainingMinutes,
                doorOpen: doorOpen,
                doorLabel: doorLabel || (doorOpen === true ? "Offen" : (doorOpen === false ? "Geschlossen" : "")),
                hasFailure: hasFailure,
                hasInfo: hasInfo,
                isOn: isOn,
                supports: {
                    status: supportsStatus,
                    programPhase: supportsProgramPhase,
                    remainingTime: supportsRemainingTime,
                    elapsedTime: supportsElapsedTime,
                    targetTemperature: supportsTargetTemperature,
                    signalDoor: supportsSignalDoor,
                    signalInfo: supportsSignalInfo,
                    signalFailure: supportsSignalFailure
                },
                statusClass: statusClass
            };
        });
    },

    readValueRaw: function (mieleValue) {
        if (mieleValue && typeof mieleValue === "object" && mieleValue.value_raw !== undefined) {
            return mieleValue.value_raw;
        }
        return null;
    },

    loadAvailableTypeIcons: function () {
        const iconsDir = path.join(__dirname, "Icons", "Miele");
        const icons = new Set();

        try {
            const files = fs.readdirSync(iconsDir, { withFileTypes: true });
            for (const entry of files) {
                if (!entry.isFile()) {
                    continue;
                }

                const match = entry.name.match(/^(\d+)\.png$/i);
                if (match) {
                    icons.add(match[1]);
                }
            }
        } catch (error) {
            this.debugLog(this.name + " could not read icon directory: " + error.message);
        }

        return icons;
    },

    resolveDeviceIconPath: function (typeRaw) {
        if (typeRaw === null || typeRaw === undefined || Number.isNaN(Number(typeRaw))) {
            return "/modules/MMM-MieleAtHome/Icons/Icon_000.png";
        }

        const typeString = String(typeRaw);
        if (this.availableTypeIcons && this.availableTypeIcons.has(typeString)) {
            return "/modules/MMM-MieleAtHome/Icons/Miele/" + typeString + ".png";
        }

        const fallbackMap = {
            "45": "31",
            "67": "31",
            "68": "21"
        };

        const mappedType = fallbackMap[typeString];
        if (mappedType && this.availableTypeIcons && this.availableTypeIcons.has(mappedType)) {
            return "/modules/MMM-MieleAtHome/Icons/Miele/" + mappedType + ".png";
        }

        return "/modules/MMM-MieleAtHome/Icons/Icon_000.png";
    },

    durationArrayToMinutes: function (durationValue) {
        if (!Array.isArray(durationValue) || durationValue.length < 2) {
            return null;
        }

        const hours = Number(durationValue[0]);
        const minutes = Number(durationValue[1]);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return null;
        }

        return (hours * 60) + minutes;
    },

    supportsCapability: function (typeRaw, capabilityName, state, stateFieldName) {
        const capabilitySet = CAPABILITY_TYPES[capabilityName];

        if (state && stateFieldName && state[stateFieldName] !== undefined) {
            return true;
        }

        if (!capabilitySet) {
            return false;
        }

        const typeNumber = Number(typeRaw);
        if (Number.isNaN(typeNumber)) {
            return false;
        }

        return capabilitySet.has(typeNumber);
    },

    calculateProgressPercent: function (elapsedMinutes, remainingMinutes) {
        if (elapsedMinutes === null || remainingMinutes === null) {
            return null;
        }

        const total = elapsedMinutes + remainingMinutes;
        if (total <= 0) {
            return null;
        }

        return Math.max(0, Math.min(100, Math.round((elapsedMinutes / total) * 100)));
    },

    readStateFlag: function (state, candidateKeys) {
        for (const key of candidateKeys) {
            if (state[key] === undefined || state[key] === null) {
                continue;
            }

            return this.valueToBoolean(state[key]);
        }

        return false;
    },

    valueToBoolean: function (value) {
        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value > 0;
        }

        if (typeof value === "string") {
            const normalized = value.toLowerCase();
            if (["1", "true", "yes", "on", "open", "offen", "active"].includes(normalized)) {
                return true;
            }
            if (["0", "false", "no", "off", "closed", "geschlossen", "inactive"].includes(normalized)) {
                return false;
            }
            return false;
        }

        if (value && typeof value === "object") {
            if (value.value_raw !== undefined) {
                return this.valueToBoolean(value.value_raw);
            }
            if (value.value_localized !== undefined) {
                return this.valueToBoolean(this.localizedValue(value.value_localized));
            }
        }

        return false;
    },

    extractDoorOpen: function (doorState, doorLabel) {
        if (doorState && doorState.value_raw !== undefined) {
            const raw = Number(doorState.value_raw);
            if (!Number.isNaN(raw)) {
                if (raw === 1) {
                    return false;
                }
                if (raw === 2) {
                    return true;
                }
            }
        }

        const label = String(doorLabel || "").toLowerCase();
        if (label.includes("offen") || label.includes("open")) {
            return true;
        }
        if (label.includes("geschlossen") || label.includes("closed")) {
            return false;
        }

        return null;
    },

    isDeviceOn: function (statusText) {
        const value = String(statusText || "").toLowerCase();
        if (value.includes("aus") || value.includes("off") || value.includes("idle") || value.includes("bereit")) {
            return false;
        }
        return true;
    },

    localizedValue: function (value) {
        if (!value) {
            return "";
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value !== "object") {
            return String(value);
        }

        const language = this.config && this.config.language ? this.config.language : "de";
        return value[language] || value.en || value.de || Object.values(value)[0] || "";
    },

    extractTemperature: function (tempObj) {
        if (!tempObj || typeof tempObj !== "object") {
            return "";
        }

        const keys = Object.keys(tempObj);
        for (const key of keys) {
            const item = tempObj[key];
            if (item && item.value !== undefined && item.value !== null) {
                return String(item.value) + " " + (item.unit || "");
            }
        }

        return "";
    },

    formatRemainingTime: function (remainingTime) {
        if (!Array.isArray(remainingTime) || remainingTime.length < 2) {
            return "";
        }

        const hours = Number(remainingTime[0]);
        const minutes = Number(remainingTime[1]);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return "";
        }

        if (hours <= 0 && minutes <= 0) {
            return "";
        }

        return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
    },

    statusClassFromText: function (statusText, hasFailure, isOn) {
        if (hasFailure) {
            return "error";
        }

        const value = String(statusText || "").toLowerCase();

        if (value.includes("running") || value.includes("laeuft") || value.includes("läuft") || value.includes("aktiv")) {
            return "running";
        }

        if (value.includes("aus") || value.includes("off") || value.includes("idle") || value.includes("bereit")) {
            return "idle";
        }

        if (value.includes("fehler") || value.includes("error") || value.includes("störung") || value.includes("stoerung")) {
            return "error";
        }

        if (isOn === false) {
            return "idle";
        }

        return "unknown";
    },

    buildAuthorizationUrl: function () {
        const scopeList = Array.isArray(this.config.oauthScopes) && this.config.oauthScopes.length > 0
            ? this.config.oauthScopes
            : ["openid", "mcs_thirdparty_read"];

        const params = new URLSearchParams({
            response_type: "code",
            client_id: this.config.client_ID,
            redirect_uri: this.config.redirectUri,
            scope: scopeList.join(" ")
        });

        return AUTHORIZATION_URL + "?" + params.toString();
    },

    exchangeAuthorizationCode: async function (authorizationCode) {
        return this.postForm(TOKEN_URL, {
            grant_type: "authorization_code",
            client_id: this.config.client_ID,
            client_secret: this.config.client_Secret,
            code: authorizationCode,
            redirect_uri: this.config.redirectUri
        });
    },

    refreshAccessToken: async function (refreshToken) {
        return this.postForm(TOKEN_URL, {
            grant_type: "refresh_token",
            client_id: this.config.client_ID,
            client_secret: this.config.client_Secret,
            refresh_token: refreshToken
        });
    },

    refreshLegacyAccessToken: async function (refreshToken) {
        return this.postForm(LEGACY_TOKEN_URL, {
            grant_type: "refresh_token",
            client_id: this.config.client_ID,
            client_secret: this.config.client_Secret,
            refresh_token: refreshToken,
            scope: "mcs_thirdparty_read",
            vg: this.config.vg || "de-DE"
        });
    },

    requestLegacyPasswordToken: async function () {
        return this.postForm(LEGACY_TOKEN_URL, {
            grant_type: "password",
            username: this.config.userName,
            password: this.config.password,
            client_id: this.config.client_ID,
            client_secret: this.config.client_Secret,
            scope: "mcs_thirdparty_read",
            vg: this.config.vg || "de-DE"
        });
    },

    postForm: function (url, formBody) {
        return new Promise((resolve, reject) => {
            const body = new URLSearchParams(formBody).toString();
            const urlObj = new URL(url);

            const req = https.request({
                protocol: urlObj.protocol,
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": Buffer.byteLength(body),
                    "Accept": "application/json"
                }
            }, (res) => {
                let responseData = "";

                res.on("data", (chunk) => {
                    responseData += chunk;
                });

                res.on("end", () => {
                    let parsed;
                    try {
                        parsed = responseData ? JSON.parse(responseData) : {};
                    } catch (error) {
                        reject(new Error("Token endpoint returned invalid JSON"));
                        return;
                    }

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                        return;
                    }

                    const errorMessage = parsed.error_description || parsed.error || ("HTTP " + res.statusCode);
                    reject(new Error("Token request failed: " + errorMessage));
                });
            });

            req.on("error", (error) => reject(error));
            req.write(body);
            req.end();
        });
    },

    readTokenFile: async function () {
        try {
            if (!fs.existsSync(this.tokenFile)) {
                return null;
            }
            const raw = await fs.promises.readFile(this.tokenFile, "utf8");
            if (!raw.trim()) {
                return null;
            }
            const token = JSON.parse(raw);

            if (!token.expires_at && token.expires_in) {
                const stat = await fs.promises.stat(this.tokenFile);
                const safetyWindowSeconds = 120;
                const derivedExpiresAt = stat.mtimeMs + Math.max(0, (Number(token.expires_in) - safetyWindowSeconds)) * 1000;
                token.expires_at = Math.floor(derivedExpiresAt);
            }

            return token;
        } catch (error) {
            Log.error(this.name + " failed reading token file: " + error.message);
            return null;
        }
    },

    isTokenValid: function (tokenData) {
        if (!tokenData || !tokenData.access_token) {
            return false;
        }

        if (!tokenData.expires_at) {
            return false;
        }

        const now = Date.now();
        return Number(tokenData.expires_at) > (now + 60 * 1000);
    },

    saveToken: async function (tokenResponse, source) {
        const now = Date.now();
        const expiresIn = Number(tokenResponse.expires_in) || 0;
        const tokenToSave = {
            ...tokenResponse,
            token_source: source,
            obtained_at: now,
            expires_at: expiresIn > 0 ? now + Math.max(0, (expiresIn - 120)) * 1000 : null
        };

        try {
            await this.writeTokenFile(this.tokenFile, tokenToSave);
        } catch (error) {
            const isPermissionError = error && (error.code === "EACCES" || error.code === "EPERM");
            if (!isPermissionError) {
                throw error;
            }

            const fallbackCandidates = this.getTokenFileCandidates().filter((filePath) => filePath !== this.tokenFile);
            const fallbackPath = await this.selectTokenFilePath(fallbackCandidates);
            Log.log(this.name + " token path not writable (" + this.tokenFile + "), using fallback: " + fallbackPath);
            this.tokenFile = fallbackPath;
            await this.writeTokenFile(this.tokenFile, tokenToSave);
        }

        this.debugLog(this.name + " token saved to " + this.tokenFile);

        return tokenToSave;
    }
});