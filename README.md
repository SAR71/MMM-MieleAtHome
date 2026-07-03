# MMM-MieleAtHome

This is a module for [MagicMirror2](https://github.com/MichMich/MagicMirror/).

The module displays your Miele at Home appliances including live status, capabilities-aware details, and modern device cards with icons.

Notes:

- This module is community-maintained and not released by Miele.
- It uses the Miele 3rd party API and can break if the API changes.
- The UI is optimized for German labels but works with other API languages.

## Features

- OAuth authorization code flow and legacy username/password flow
- Automatic token refresh
- Docker-friendly token storage with writable-path fallback
- Capability-aware rendering (only show data a device type supports)
- Modern card UI with device icons and status indicators
- Optional capability debug overlay per device

## Install guide

SSH to your MagicMirror host and run:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/SAR71/MMM-MieleAtHome
cd MMM-MieleAtHome
npm install
```

## Using the module

Add the module to the modules array in `config/config.js`:

```js
let config = {
  modules: [
    {
      module: "MMM-MieleAtHome",
      position: "top_left",
      config: {
        authMode: "legacy", // "authorization_code" or "legacy"
        userName: "",
        password: "",
        client_ID: "",
        client_Secret: "",
        tokenFile: "/opt/magic_mirror/config/MMM-MieleAtHome-token.json",
        language: "de",
        debug: false,
        capabilityDebug: false,
        updateFrequency: 60000
      }
    }
  ]
};
```

## Configuration options

| Option | Default | Description |
|---|---:|---|
| `userName` | `""` | Required for legacy flow. Miele account email. |
| `password` | `""` | Required for legacy flow. Miele account password. |
| `client_ID` | `""` | Required. Miele API client id. |
| `client_Secret` | `""` | Required. Miele API client secret. |
| `authMode` | `"authorization_code"` | Auth mode: `authorization_code` (new OAuth flow) or `legacy` (username/password). |
| `tokenFile` | `""` | Optional token file path. Recommended in Docker, for example `/opt/magic_mirror/config/MMM-MieleAtHome-token.json`. |
| `authorizationCode` | `""` | OAuth authorization code (used with `authorization_code` flow). |
| `redirectUri` | `"https://www.miele.com/developer/swagger-ui/oauth2-redirect.html"` | OAuth redirect URI. |
| `oauthScopes` | `["openid", "mcs_thirdparty_read"]` | OAuth scopes for authorization code flow. |
| `debug` | `true` | Enables detailed module/helper logs. |
| `capabilityDebug` | `false` | Shows per-device capability debug details in the UI. |
| `showDeviceIcon` | `true` | Show/hide appliance icon on the left side of each card. |
| `showAlwaysAllDevices` | `false` | If true, show all devices regardless of activity. |
| `showDeviceIfDoorIsOpen` | `true` | If true, include devices with open door indication. |
| `showDeviceIfFailure` | `true` | If true, include devices with failure indication. |
| `showDeviceIfInfoIsAvailable` | `true` | If true, include devices with info indication. |
| `ignoreDevices` | `[]` | Array of device ids that should be hidden. |
| `useIndividualNames` | `false` | Reserved for app-specific naming behavior. |
| `vg` | `"de-DE"` | Legacy token endpoint locale parameter. |
| `language` | `"de"` | API language for localized values. |
| `updateFrequency` | `5000` | Polling interval in milliseconds (minimum enforced to 5000). |

## Authentication modes

### 1) Authorization code flow (new)

Set:

```js
authMode: "authorization_code"
```

Behavior:

- Module shows and logs a login URL if authorization is required.
- Exchange with `authorizationCode` and stores token.
- Uses refresh token automatically afterward.

### 2) Legacy flow

Set:

```js
authMode: "legacy"
```

Required:

- `userName`
- `password`
- `client_ID`
- `client_Secret`

Behavior:

- Uses legacy token endpoint.
- Performs automatic refresh when possible.

## Docker notes

If MagicMirror runs in Docker, permission issues are commonly caused by mounted directories.

Symptoms:

- `EACCES: permission denied, open '.../mieletoken.json'`

Recommended setup:

1. Mount config as writable.
2. Set `tokenFile` to a writable path inside the config mount.
3. Align host permissions with container UID/GID when required.

Example compose mounts:

```yaml
volumes:
  - ../mounts/config:/opt/magic_mirror/config
  - ../mounts/modules:/opt/magic_mirror/modules
  - ../mounts/css:/opt/magic_mirror/css
```

The helper also includes automatic writable-path fallback for token persistence.

## UI behavior and capabilities

The module now checks device capabilities before rendering details.

Examples:

- Devices without meaningful remaining time do not show `00:00`.
- Progress bar only appears if remaining/elapsed values are valid.
- Door/info/failure indicators are shown only if supported and present.

## Logging behavior

- Detailed logs are controlled by `debug`.
- Authorization URL is logged in browser context when auth is required.
- Capability diagnostics can be enabled in the UI with `capabilityDebug: true`.

## Example configurations

### Legacy in Docker

```js
{
  module: "MMM-MieleAtHome",
  position: "top_left",
  config: {
    authMode: "legacy",
    userName: "someone@example.com",
    password: "secret",
    client_ID: "12345678-1234-1234-1234-123456789ABC",
    client_Secret: "aaaabbbcccdddeee",
    tokenFile: "/opt/magic_mirror/config/MMM-MieleAtHome-token.json",
    language: "de",
    updateFrequency: 60000,
    debug: false,
    capabilityDebug: false
  }
}
```

### Authorization code flow

```js
{
  module: "MMM-MieleAtHome",
  position: "top_left",
  config: {
    authMode: "authorization_code",
    client_ID: "12345678-1234-1234-1234-123456789ABC",
    client_Secret: "aaaabbbcccdddeee",
    redirectUri: "https://www.miele.com/developer/swagger-ui/oauth2-redirect.html",
    oauthScopes: ["openid", "mcs_thirdparty_read"],
    tokenFile: "/opt/magic_mirror/config/MMM-MieleAtHome-token.json"
  }
}
```

## Updating

To update the module:

```bash
cd ~/MagicMirror/modules/MMM-MieleAtHome
git pull
```

If local changes exist, review them first with `git status`.

## Screenshots

![Screenshot](/Screenshots/Screenshot_001.png)
![Screenshot](/Screenshots/Screenshot_002.png)
![Screenshot](/Screenshots/Screenshot_003.png)
![Screenshot](/Screenshots/Screenshot_004.png)
