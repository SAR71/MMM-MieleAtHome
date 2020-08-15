var request = require("request");
var fs = require('fs');

var mieletoken;
const tokenFile = './modules/MMM-MieleAtHome/mieletoken.json';

var mieledevice = require('./devices.js');
var config;

var _success;

class mieleathome {
    
    constructor(_config) {
        config = _config;
        config.device = new mieledevice();
    }
    
    log (msg) {
        console.log(msg);
    }

    ReadToken(callback){
        var tokenFileExists = fs.existsSync(tokenFile);

        if(!tokenFileExists){
            //Create Token File

        }

        fs.readFile(tokenFile, (err, data) => {
                if (err) {
                    console.log('Failed to read file: ' + err);
                    NGetToken(function(err,token){

                        });
                    } 
                    else {
                        readTokenData(config, data, _success, function (err) {
                        console.log('Failed to use existing token from file, error ' + err + ', will request a new one');

                        if(err){
                            NGetToken(function(err){
                                if(!err){
                                    //Write token to json File

                                    fs.writeFile(tokenFile, data, function (err) {
                                        if(!err){
                                            console.log("New token file has been written to file " + tokenFile);      
                                            console.log('Token successfully requested');
                                            callback(true);
                                        }
                                        else{
                                            console.log("Tokenfile could not be written");  
                                            callback(false);
                                        }                    
                                    });                                    
                                }                    
                            });
                        }
                    });
                }
          });

    }
    
    NRefreshToken(Token,Refresh_Token,callback){
        var options = {
        url: 'https://api.mcs3.miele.com/thirdparty/token/',
        method: 'POST',
        form: {grant_type:'refresh_token',code:Token,password:this.Password,username:this.Username,client_id:this.Client_ID,client_secret:this.Client_Secret,refresh_token:Refresh_Token,vg:'de-DE'},
        headers: {accept: 'application/json'}
        };
        
        request(options, function (error, response, body){
                if (response.statusCode==200){
                P=JSON.parse(body);
                return callback(false,P.access_token,P.refresh_token);
                }
                else{
                console.error(response.statusCode+' Fehler bei Refresh Token !');
                return callback(true,null,null);
                }
                });
        
    }//End of Function RefreshToken
    
    NSendRequest(Refresh_Token, Endpoint, Method, Token, Send_Body, callback){
        var options;
        if (Method == 'GET')
            {
            options = {
            url: config.BaseURL + Endpoint + "?language=" + config.language,
            method: Method,
            headers: {Authorization: 'Bearer '+ Token, accept: 'application/json; charset=utf-8'},// Content-Type: 'application/json'},
            form:Send_Body
            }
            }
        else
            {
            options = {
            url: config.BaseURL + Endpoint + "?language=" + config.language,
            method: Method,
            json: true, 
	    headers: {Authorization: 'Bearer '+ Token, accept: '*/*'}, //,  'Content-Type': 'application/json;charset=UTF-8'},
            body:Send_Body
            }
            }
//    console.log(options);    
        request(options,function (error, response, body){
                    //console.log(response.statusCode);
                    //console.log(body);
                switch (response.statusCode){
                    case 200: // OK
                        //if (!body){return callback(false,JSON.parse(body),null,null);} else {callback(false,null,null,null)};
                        {
                            return callback(false, JSON.parse(body), null, null)
                        };
                        break;
                    case 202: //Accepted, processing has not been completed.
                        break;
                    case 204: // OK, No Content
                        return callback(false,null,null,null);
                        break;
                    case 400: //Bad Request, message body will contain more information
                        return callback(true,null,null,null);
                        break;
                    case 401: //Unauthorized
                        this.NRefreshToken(Token,Refresh_Token,function(err,access_token,refresh_token){
                                    if(!err){
                                    this.NSendRequest(Refresh_Token,Endpoint,Method,acsess_token,Send_Body,function(err,data){
                                                        if(!err){return callback(false,data,access_token,refresh_token)}
                                                        else{return callback(true,null,access_token,refresh_token)}
                                                        });
                                    }
                                    else{return callback(true,null,null,null);}
                                    });
                        break;
                    default:
                        return callback(true,null,null,null);
                    }
                });
    }
    NGetDevices(callback){
        this.NSendRequest(mieletoken.refresh_token,'v1/devices/','GET',mieletoken.access_token,'',function(err,data){
                          if(!err){
                              return callback(err,data)
                            }
                          });
    }
    NGetDeviceState(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/state';
        this.NSendRequest(Refresh_Token,path,'GET',Access_Token,'',function(err,data,atoken,rtoken){
                          if(!err){console.log('data'+JSON.stringify(data));return callback(err,data,atoken,rtoken)}
                          });
    }
    NGetDeviceStatus(Refresh_Token,Access_Token,deviceID,callback){
        this.NGetDeviceState(Refresh_Token,Access_Token,deviceID,function(err,data,atoken,rtoken){
                             if(!err){var st = JSON.stringify(data.status.value_raw);return callback(err,st,atoken,rtoken) } else
                             {return callback(err,st,atoken,rtoken)};
                             });
    }
    NGetDeviceStatusValue(Access_Token,Method,Path,deviceID){
        var res = req_sync(Method, config.BaseURL+Path+deviceID+'/state', {headers: { "Authorization": "Bearer "+Access_Token,
                           "accept": 'application/json' }, timeout: 60000} );
        if (res.statusCode === 200) {
            return JSON.parse(res.getBody('utf-8')).status.value_raw;
        } else {console.log(res.statusCode);
            return undefined;
        }
    }
    NGetDevicefRCValue(Access_Token,Method,Path,deviceID){
        var res = req_sync(Method, config.BaseURL+Path+deviceID+'/state', {headers: { "Authorization": "Bearer "+Access_Token,
                           "accept": 'application/json' }, timeout: 60000} );
        if (res.statusCode === 200) {
            return JSON.parse(res.getBody('utf-8')).remoteEnable.fullRemoteControl;
        } else {console.log(res.statusCode);
            return undefined;
        }
    }
    
    NSetLightEnable(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/actions';
        var body = {"light":1};
        var status = this.NGetDeviceStatusValue(Access_Token,'GET','v1/devices/',deviceID);
        this.NGetDeviceStatus(Refresh_Token,Access_Token,deviceID,function(err,data,atoken,rtoken){
                              if(!err){status = data;
                              if (status === "5"){ console.log('Body:'+body); console.log('Path:'+path);
                              this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                                                if(!err){return callback(err,data,atoken,rtoken)}
                                                });
                              }
                              else
                              {return callback('Status ne 5')
                              }
                              }});
    }
    NSetLightDisable(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/actions';
        var body = {"light":2};
        var status = this.NGetDeviceStatusValue(Access_Token,'GET','v1/devices/',deviceID);
        //console.log('Status-Value'+ status);
        if (status == "5"){
        /*    console.log('status erfüllt');
            console.log('Body:'+body);
            console.log('Path:'+path);
            console.log('rtoken'+Refresh_Token);
            console.log('atoken'+Access_Token); */
            this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                              if(!err){return callback(err,data,atoken,rtoken)}
                              });
        }
        else
            {return callback('Status ne 5',null, null, null)
            }
        
    }
    NSetProcessAction(Refresh_Token,Access_Token,processAction,deviceID,Type,callback){
    var status = this.NGetDeviceStatusValue(Access_Token,'GET','v1/devices/',deviceID);
    var fullRemoteControl = this.NGetDevicefRCValue(Access_Token,'GET','v1/devices/',deviceID);
    var dfunctions = this.device.readDevice(parseFloat(Type));
    for ( var i = 0; i<dfunctions.length; i++)
    {
    //adapter.log.info('Function:' + Pfad + dfunctions[i][0] + dfunctions[i][1] + dfunctions[i][2]);
    if (dfunctions[i][0] == processAction) {
       if (dfunctions[i][1]) {
        var path = 'v1/devices/' + deviceID + '/actions';
        var body = dfunctions[i][2];
          this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                              if(!err){return callback(err,data,atoken,rtoken)}
                              });
       
       }
    } 
    }     
     
    }
}

function readTokenData(_config, _data, _success, _error) {
    var json;
  
    try {
      json = JSON.parse(_data);
    } catch (err) {
      _error(err);
      return;
    }
  
    if (typeof (json.error) !== 'undefined') {
      _error(json.error + ": " + json.error_description);
      return;
    }
  
    if (typeof (json.token_type) === 'undefined' || typeof (json.access_token) === 'undefined') {
      _error("Couldn't find token in response");
      return;
    }
  
    var tokenType = json.token_type;
    var token = json.access_token;
  
    // CDP server seems to be picky, so be save and let the token expire two minutes earlier
    var tokenExpiresInSeconds = json.expires_in - 120;
    var expireDate;
    var tokenFileExists = fs.existsSync(tokenFile);
    var now = new Date();
  
    if (tokenFileExists) {
      var stat = fs.statSync(tokenFile);
      expireDate = new Date(stat.mtime);
    } else {
      expireDate = now;
    }
  
    var expireTimestamp = expireDate.valueOf() + tokenExpiresInSeconds * 1000;
    var nowTimestamp = now.valueOf();
    var expired = nowTimestamp > expireTimestamp;
  
    if (expired) {
      console.log("Token expired, requesting a new one");
      requestNewToken(_config, _success, _error);
    } else {
      if (!tokenFileExists) {
        fs.writeFile(tokenFile, _data, function () {
          console.log("New token file has been written to file " + tokenFile);
        });
      }
      _success(token, tokenType);
    }
  }

  function NGetToken(callback) {
    var options = {
    url: 'https://api.mcs3.miele.com/thirdparty/token/',
    method: 'POST',
    form: {grant_type:'password',password:config.password,username:config.userName,client_id:config.client_ID,client_secret:config.client_Secret,vg:config.vg},
    headers: {accept: 'application/json'}
    };
    
    request(options, function (err,response,body) {
            if (response.statusCode==200) {
            mieletoken = JSON.parse(body);
            //console.log(P.access_token);
            return callback(false);
            }
            else {
            console.warn(response.statusCode+' Login Error !');
            console.warn(response.status);
            return callback(true);
            }
            }
            )
    
}

module.exports = mieleathome;