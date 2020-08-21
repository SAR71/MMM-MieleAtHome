# MMM-MieleAtHome

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

*The module is currently optimized for german*

*The module is not released by the Miele company*

I used this repro for the API usage [ioBroker | MieleAtHome](https://github.com/hash99/ioBroker.mieleathome).

The module displays your Miele@Home devices on your mirror. You need to have a registred Miele@Home Account with eMail and password with connected Miele@Home devices. You also need to register for a Miele API Account [Miele API Registration](https://www.miele.com/f/com/en/register_api.aspx). You will recieve a client_ID and a client_Secret. The combinaton of username, passwort, client_ID and client_Secret will allow you to use this module.

The module was created using the Miele REST API. It is absolutely unsupported by Miele. If they change their API it will probably break the module. So use it at your own Risk.

## Install guide

login to your rapberry pi, cd into the modules folder and execute
```
git clone https://github.com/SAR71/MMM-MieleAtHome
cd MMM-MieleAtHome
npm install
```

## Using the module

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        {
            module: "MMM-MieleAtHome",
            position: "top_center",
            config: {
                userName: "",
                password: "",
                client_ID: "",
                client_Secret: "",
            }
        },
    ]
}
```

## Configuration options

| Option                            | Default                       | Description
|-----------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------
| `userName`                        | ''                            | *Required* The email adress to log in to your miele account 
| `password`                        | ''                            | *Required* The password to log in to your bring account 
| `client_ID`                       | ''                            | *Required* The number of colums in the table view (default = `4`)
| `client_Secret`                   | ''                            | *Required* The maximum number of rows to display in the table view (default = `4`)
| `BaseURL`                         | 'https://api.mcs3.miele.com/' | *Optional* Url to the Miele API
| `showAlwaysAllDevices`            | false                         | *Optional* If you alway want to see al devices on the mirror even if the device is off
| `showDeviceIfDoorIsOpen`          | true                          | *Optional* if showAlwaysAllDevices is true, a device will be shown if Door is open
| `showDeviceIfFailure`             | true                          | *Optional* if showAlwaysAllDevices is true, the device will be shown if there is a failure
| `showDeviceIfInfoIsAvailable`     | true                          | *Optional* if showAlwaysAllDevices is true, the device will be shown if info is aAvailable
| `ignoreDevices`                   | []                            | *Optional* array with DeviceIDs which should be ignored
| `useIndividualNames`              | false                         | *Optional* Show individual name (you can set them in the Miele App)
| `vg`                              | 'de-DE'                       | *Optional* Language (I actually don't know what this is for :-D )
| `language`                        | 'de'                          | *Optional* Language of the status etc. (only the language the API gives back) Some things are still in german
| `updateFrequency`                 | 5000                          | *Optional* Update Frequency in ms

### Example configuration:
```js
var config = {
    modules: [
        {
            module: "MMM-MieleAtHome",
            position: "top_center",
            config: {
                userName: "someone@example.de",
                password: "secretPassword",
                client_ID: "12345678-1234-1234-1234-123456789ABC",
                client_Secret: "aaaabbbccccdddeeeerrrr",
                showAllDevices: false,
                updateFrequency: 5000
            }
        },      
    ]
}
```
## Updating

To update the module to the latest version, use your terminal to go to your MMM-MieleAtHome module folder and type the following command:

````
git pull
```` 

If you haven't changed the modules, this should work without any problems. 
Type `git status` to see your changes, if there are any, you can reset them with `git reset --hard`. After that, git pull should be possible.


## Example Screen:
![Screenshot](/Screenshots/Screenshot_001.png)
